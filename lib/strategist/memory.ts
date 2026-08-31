/**
 * Long-term per-user memory for the Strategist.
 *
 * Two responsibilities:
 *   1. *Retrieval* - given an incoming question, pick the most relevant
 *      facts already on file and inline them into the model's context.
 *   2. *Extraction* - after each user/assistant exchange, ask Gemma 4 to
 *      identify any durable new facts worth remembering and persist them.
 *
 * The store is intentionally simple: a single document per user with an
 * inline `facts` array. No vectors yet - keyword overlap is plenty until a
 * user has hundreds of memories.
 */

import { generateGemmaText } from "@/lib/llm/gemma";
import type { UserMemoryFact, MemoryFactCategory } from "@/lib/db/collections";

const FACT_CATEGORIES: MemoryFactCategory[] = [
  "goal",
  "preference",
  "constraint",
  "background",
  "interest",
];

/** Generates a short ID for new facts. */
function factId(): string {
  return Math.random().toString(36).slice(2, 12);
}

/* ─── Retrieval ──────────────────────────────────────────────────────── */

/**
 * Cheap keyword-overlap relevance score. We tokenize text into lowercased
 * words of 3+ chars and count Jaccard-style overlap against the query -
 * fast and good enough for <500 facts per user.
 */
function relevanceScore(query: string, factText: string): number {
  const tokens = (s: string) =>
    new Set(
      s
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, " ")
        .split(/\s+/)
        .filter((w) => w.length > 2),
    );
  const q = tokens(query);
  const f = tokens(factText);
  if (q.size === 0 || f.size === 0) return 0;
  let hits = 0;
  for (const w of q) if (f.has(w)) hits++;
  // Bias slightly toward higher-confidence facts.
  return hits / q.size;
}

/**
 * Picks the top-K most relevant facts to include in the model's prompt.
 * Always includes the most recent 3 facts as a "what we just learned"
 * floor - keeps memory feeling fresh across turns.
 */
export function selectRelevantFacts(
  facts: UserMemoryFact[],
  query: string,
  k = 8,
): UserMemoryFact[] {
  if (facts.length === 0) return [];
  const scored = facts.map((f) => ({
    fact: f,
    score: relevanceScore(query, f.text) * (0.5 + f.confidence * 0.5),
  }));
  scored.sort((a, b) => b.score - a.score);
  const relevant = scored.filter((s) => s.score > 0).map((s) => s.fact);

  // Always blend in the 3 most-recent facts even if they aren't keyword
  // matches - they're the closest thing we have to short-term context.
  const recent = [...facts]
    .sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt))
    .slice(0, 3);

  const seen = new Set<string>();
  const out: UserMemoryFact[] = [];
  for (const f of [...relevant, ...recent]) {
    if (seen.has(f.id)) continue;
    seen.add(f.id);
    out.push(f);
    if (out.length >= k) break;
  }
  return out;
}

/** Formats a fact list into a compact block for the system prompt. */
export function renderMemoryBlock(facts: UserMemoryFact[]): string {
  if (facts.length === 0) return "(no learned memories yet)";
  return facts
    .map((f) => `- [${f.category}] ${f.text}`)
    .join("\n");
}

/* ─── Extraction ─────────────────────────────────────────────────────── */

const EXTRACT_SCHEMA = {
  type: "object",
  properties: {
    facts: {
      type: "array",
      description:
        "Durable, useful facts about the student worth remembering for future conversations.",
      items: {
        type: "object",
        properties: {
          text: {
            type: "string",
            description:
              "One short, self-contained statement in third person, e.g. 'Wants to study quantum computing at MIT'.",
          },
          category: {
            type: "string",
            enum: FACT_CATEGORIES,
          },
          confidence: {
            type: "number",
            description: "0..1 how confident you are this is durable and useful.",
          },
        },
        required: ["text", "category", "confidence"],
      },
    },
  },
  required: ["facts"],
} as const;

const EXTRACT_SYSTEM = [
  "You are a memory curator for an AI college-admissions strategist.",
  "After each exchange, your job is to extract NEW durable facts about the student that will help future conversations.",
  "",
  "Keep ONLY facts that are:",
  "  • specific to this person (not generic advice they were given)",
  "  • likely true for weeks or months (not transient mood / day-of-week stuff)",
  "  • not already in the existing facts list",
  "",
  "Categories:",
  "  • goal - a target the student is working toward (university, score, deadline)",
  "  • preference - how they like to study, communicate, or be planned for",
  "  • constraint - limits on time, money, family situation, health",
  "  • background - academic history, current school, scores already achieved",
  "  • interest - subject or activity they care about",
  "",
  "Return at most 5 new facts. Return an empty array if nothing is worth remembering.",
  "Write each fact as a short third-person statement in plain English (under 140 chars).",
].join("\n");

type ExtractedRaw = {
  text: string;
  category: MemoryFactCategory;
  confidence: number;
};

/**
 * Runs an LLM pass over the user/assistant exchange to identify new durable
 * facts. Returns an empty array on failure / no key / nothing new - the
 * caller should treat this as best-effort enrichment, not core path.
 */
export async function extractFactsFromExchange(
  userMessage: string,
  assistantReply: string,
  existing: UserMemoryFact[],
): Promise<UserMemoryFact[]> {
  try {
    const prompt = [
      `EXISTING FACTS (do not repeat):`,
      existing.length
        ? existing.map((f) => `- ${f.text}`).join("\n")
        : "(none)",
      ``,
      `STUDENT MESSAGE:`,
      userMessage,
      ``,
      `ASSISTANT REPLY:`,
      assistantReply,
    ].join("\n");

    const text = await generateGemmaText({
      system: EXTRACT_SYSTEM,
      contents: prompt,
      responseJsonSchema: EXTRACT_SCHEMA,
      temperature: 0.2,
      maxOutputTokens: 800,
      thinkingLevel: "minimal",
    });
    if (!text) return [];
    const parsed = JSON.parse(text) as { facts: ExtractedRaw[] };
    const now = new Date();
    return (parsed.facts ?? [])
      .filter((f) => f.text && f.text.trim().length > 3 && f.text.length <= 240)
      .filter((f) => FACT_CATEGORIES.includes(f.category))
      .map<UserMemoryFact>((f) => ({
        id: factId(),
        text: f.text.trim(),
        category: f.category,
        confidence: Math.max(0, Math.min(1, f.confidence ?? 0.7)),
        source: "inferred",
        createdAt: now,
      }));
  } catch (err) {
    console.error("[memory] extraction failed:", err);
    return [];
  }
}

/** Helper for the explicit-add API (user manually tells Polaris something). */
export function makeExplicitFact(
  text: string,
  category: MemoryFactCategory = "background",
): UserMemoryFact {
  return {
    id: factId(),
    text: text.trim(),
    category,
    confidence: 1,
    source: "explicit",
    createdAt: new Date(),
  };
}

