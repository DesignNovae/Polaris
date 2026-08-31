/**
 * Query planning for retrieval.
 *
 * A chat agent's questions are not standalone. "What about the second one?"
 * retrieves noise, because the thing being asked about is three turns back.
 * This module turns the live turn into one or more retrieval queries:
 *
 *   1. the raw message (best input for the dense retriever),
 *   2. a stopword-stripped variant (better input for BM25) - free, deterministic,
 *   3. for follow-ups only, a Gemma-written standalone question plus up to two
 *      sub-queries.
 *
 * Step 3 is the only one that costs a model call, and it is gated on a cheap
 * heuristic so ordinary self-contained questions add zero latency.
 */

import { generateGemmaText } from "@/lib/llm/gemma";

export type PlannedQueries = {
  queries: string[];
  /** True when the model was asked to resolve the reference. */
  rewritten: boolean;
  /** Short explanation, surfaced in the Strategist's tool trace. */
  reason: string;
};

export type TurnHistory = Array<{ role: "user" | "assistant"; text: string }>;

const STOPWORDS = new Set([
  "a", "an", "the", "and", "or", "but", "if", "of", "to", "in", "on", "for",
  "with", "at", "by", "from", "about", "as", "is", "are", "was", "were", "be",
  "been", "am", "do", "does", "did", "can", "could", "should", "would", "will",
  "shall", "may", "might", "must", "have", "has", "had", "i", "me", "my", "we",
  "our", "you", "your", "it", "its", "this", "that", "these", "those", "there",
  "what", "which", "who", "whom", "how", "when", "where", "why", "please",
  "tell", "give", "get", "want", "need", "help", "know", "think", "just",
]);

/** Markers that a turn depends on something said earlier. */
const FOLLOW_UP = [
  /^(and|but|so|also|ok(ay)?|then|what about|how about|why|why not|elaborate|more|go on|continue|explain)\b/i,
  /\b(that|those|these|it|them|they|the (first|second|third|last|other) one|the same|instead)\b/i,
];

function keywordVariant(message: string): string {
  const words = message
    .toLowerCase()
    .match(/[\p{L}\p{N}][\p{L}\p{N}'-]*/gu) ?? [];
  const kept = words.filter((word) => word.length > 2 && !STOPWORDS.has(word));
  return kept.slice(0, 18).join(" ");
}

function looksLikeFollowUp(message: string, history: TurnHistory): boolean {
  if (history.length === 0) return false;
  const text = message.trim();
  if (text.length < 30) return true;
  return FOLLOW_UP.some((pattern) => pattern.test(text));
}

const REWRITE_SYSTEM = [
  "You rewrite the latest turn of a student-advisor conversation into search queries for a document index.",
  "Return JSON only.",
  "`standalone`: the latest question rewritten so it makes sense with no conversation history. Resolve every pronoun and reference using the transcript. Keep it under 20 words.",
  "`subQueries`: 0-2 additional short queries covering distinct facts the answer needs (for example a specific university's deadline, or a scholarship's eligibility). Empty array if the standalone question already covers it.",
  "Never invent university names, scholarship names, or facts that do not appear in the transcript.",
].join("\n");

const REWRITE_SCHEMA = {
  type: "object",
  properties: {
    standalone: { type: "string" },
    subQueries: { type: "array", items: { type: "string" } },
  },
  required: ["standalone"],
};

const REWRITE_TIMEOUT_MS = 4500;

function timeoutSignal(signal?: AbortSignal): AbortSignal {
  const timeout = AbortSignal.timeout(REWRITE_TIMEOUT_MS);
  if (!signal) return timeout;
  // AbortSignal.any is Node 20+; fall back to the timeout alone if absent.
  return typeof AbortSignal.any === "function"
    ? AbortSignal.any([signal, timeout])
    : timeout;
}

function dedupe(queries: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const query of queries) {
    const clean = query.trim().slice(0, 200);
    const key = clean.toLowerCase();
    if (clean.length < 2 || seen.has(key)) continue;
    seen.add(key);
    out.push(clean);
  }
  return out.slice(0, 4);
}

export async function planQueries(input: {
  message: string;
  history?: TurnHistory;
  signal?: AbortSignal;
}): Promise<PlannedQueries> {
  const message = input.message.trim();
  const history = (input.history ?? []).slice(-6);
  const keywords = keywordVariant(message);
  const base = dedupe([message, keywords]);

  if (process.env.RAG_QUERY_REWRITE === "off") {
    return { queries: base, reason: "rewriting disabled", rewritten: false };
  }
  if (!looksLikeFollowUp(message, history)) {
    return { queries: base, reason: "self-contained question", rewritten: false };
  }

  const transcript = history
    .map((turn) => `${turn.role === "user" ? "Student" : "Polaris"}: ${turn.text.slice(0, 400)}`)
    .join("\n");

  try {
    const raw = await generateGemmaText({
      system: REWRITE_SYSTEM,
      contents: `<transcript>\n${transcript}\n</transcript>\n\n<latest>${message}</latest>`,
      temperature: 0.1,
      maxOutputTokens: 200,
      thinkingLevel: "minimal",
      responseJsonSchema: REWRITE_SCHEMA,
      abortSignal: timeoutSignal(input.signal),
    });
    if (!raw) return { queries: base, reason: "rewrite unavailable", rewritten: false };

    const parsed = JSON.parse(raw) as { standalone?: string; subQueries?: string[] };
    const standalone = typeof parsed.standalone === "string" ? parsed.standalone : "";
    const subQueries = Array.isArray(parsed.subQueries)
      ? parsed.subQueries.filter((q): q is string => typeof q === "string")
      : [];
    const queries = dedupe([standalone, ...subQueries, message]);
    if (queries.length === 0) {
      return { queries: base, reason: "rewrite returned nothing", rewritten: false };
    }
    return {
      queries,
      reason: `follow-up resolved to "${standalone.slice(0, 80)}"`,
      rewritten: true,
    };
  } catch (err) {
    // Retrieval must never fail because the rewriter did.
    console.error("[rag] query rewrite failed:", (err as Error).message);
    return { queries: base, reason: "rewrite failed", rewritten: false };
  }
}
