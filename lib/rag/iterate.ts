/**
 * Second-pass retrieval.
 *
 * One-shot retrieval fails in a specific, visible way: the first pass comes
 * back with nothing, or with passages that are all adjacent to the question
 * without containing the fact. A human researcher notices and searches again
 * with different words. This does that.
 *
 * The trigger is the cheap part. A model call to ask "is this enough?" on
 * every turn would tax the ~90% of turns where the first pass was fine, so
 * the second pass only fires when round one is measurably thin. That keeps
 * the common path at zero extra latency and spends the call exactly where
 * one-shot retrieval was going to fail anyway.
 *
 * True agentic retrieval would let the model itself call the search tool
 * mid-answer. The provider interface here has no function calling, so the
 * loop lives in the orchestrator instead - same effect, fixed at two rounds.
 */

import { generateGemmaText } from "@/lib/llm/gemma";
import type { KbHit } from "./search";

/** Below this many first-pass hits, a second pass is worth a model call. */
const THIN_RESULT_THRESHOLD = 3;

/**
 * Cosine similarity below which the first pass counts as weak.
 *
 * Hit *count* is not a usable trigger: fusion returns a full five passages for
 * "how do I fix a leaking tap?" because the relevance floor is relative to the
 * best hit, and something is always the best hit. Raw cosine is absolutely
 * calibrated, so it can tell "found nothing" from "found things".
 *
 * Measured on this corpus: answerable questions top out at 0.578-0.737,
 * out-of-scope ones at 0.504-0.570. The bands nearly touch, so this is a
 * spending heuristic rather than a classifier - it only decides whether one
 * model call is worth making. 0.60 sits above the overlap deliberately, so
 * weakly-retrieved but answerable questions get a second pass too.
 */
const WEAK_SIMILARITY_THRESHOLD = Number(
  process.env.RAG_SECOND_PASS_THRESHOLD || 0.6,
);

const SECOND_PASS_TIMEOUT_MS = 5000;

export type SecondPassPlan = {
  triggered: boolean;
  queries: string[];
  reason: string;
};

const SYSTEM = [
  "A search over a curated education knowledge base returned weak results for a student's question. Propose better queries.",
  "Look at what came back and work out what is missing: a different vocabulary for the same idea, the official name of a thing the student described in their own words, or a narrower sub-question.",
  "Return JSON only:",
  '  "queries": 1-2 short search queries, each under 12 words, phrased the way the knowledge base would phrase it (institution names, scholarship names, exam names, "cost of living", "application deadline").',
  '  "sufficient": true if the passages already answer the question and no further search is needed.',
  "Never invent an institution or scholarship name that was not mentioned by the student or present in the passages.",
].join("\n");

const SCHEMA = {
  type: "object",
  properties: {
    queries: { type: "array", items: { type: "string" } },
    sufficient: { type: "boolean" },
  },
  required: ["queries", "sufficient"],
};

function timeoutSignal(signal?: AbortSignal): AbortSignal {
  const timeout = AbortSignal.timeout(SECOND_PASS_TIMEOUT_MS);
  if (!signal) return timeout;
  return typeof AbortSignal.any === "function"
    ? AbortSignal.any([signal, timeout])
    : timeout;
}

/**
 * Decides whether to search again, and with what. Returns `triggered: false`
 * whenever the first pass looked healthy, the feature is disabled, or the
 * planner failed - a second pass is an improvement, never a dependency.
 */
export async function planSecondPass(input: {
  question: string;
  hits: KbHit[];
  signal?: AbortSignal;
}): Promise<SecondPassPlan> {
  const none: SecondPassPlan = { triggered: false, queries: [], reason: "" };

  if (process.env.RAG_SECOND_PASS === "off") {
    return { ...none, reason: "second pass disabled" };
  }
  const topSimilarity = input.hits[0]?.similarity ?? null;
  const enough = input.hits.length >= THIN_RESULT_THRESHOLD;
  // With no vector index there is no calibrated signal, so fall back to count.
  const relevant = topSimilarity === null || topSimilarity >= WEAK_SIMILARITY_THRESHOLD;
  if (enough && relevant) {
    return {
      ...none,
      reason:
        topSimilarity === null
          ? `first pass returned ${input.hits.length} passages`
          : `first pass looked relevant (top similarity ${topSimilarity.toFixed(3)})`,
    };
  }

  const weakness = !enough
    ? `only ${input.hits.length} passages came back`
    : `the closest passage scored ${topSimilarity?.toFixed(3)} similarity, which is weak`;

  const summary = input.hits.length
    ? input.hits.map((h) => `[${h.id}] ${h.title}: ${h.snippet}`).join("\n\n")
    : "(the search returned nothing at all)";

  try {
    const raw = await generateGemmaText({
      system: SYSTEM,
      contents: `<question>${input.question}</question>\n\n<why-weak>${weakness}</why-weak>\n\n<weak-results>\n${summary}\n</weak-results>`,
      temperature: 0.2,
      maxOutputTokens: 160,
      thinkingLevel: "minimal",
      responseJsonSchema: SCHEMA,
      abortSignal: timeoutSignal(input.signal),
    });
    if (!raw) return { ...none, reason: "second-pass planner returned nothing" };

    const parsed = JSON.parse(raw) as { queries?: string[]; sufficient?: boolean };
    if (parsed.sufficient === true) {
      return { ...none, reason: "planner judged first pass sufficient" };
    }
    const queries = (parsed.queries ?? [])
      .filter((q): q is string => typeof q === "string")
      .map((q) => q.trim().slice(0, 200))
      .filter((q) => q.length > 1)
      .slice(0, 2);
    if (queries.length === 0) {
      return { ...none, reason: "planner proposed no queries" };
    }
    return {
      triggered: true,
      queries,
      reason: `weak first pass (${weakness}), retrying with ${queries.length} ${queries.length === 1 ? "query" : "queries"}`,
    };
  } catch (err) {
    return { ...none, reason: `second-pass planning failed: ${(err as Error).message}` };
  }
}

/**
 * Drops the whole passage set when even the best of it is off-topic.
 *
 * "How do I fix a leaking tap?" retrieves five IELTS writing lessons, because
 * ranking always produces a ranking. Handing those to a model told to ground
 * its answer in <kb> is worse than handing it nothing: it invites the model to
 * build an answer out of whatever is in front of it. An empty block makes the
 * prompt's own refusal path the obvious move.
 *
 * Only fires with a vector index present - a lexical-only run has no
 * calibrated score to judge with, so it keeps today's behaviour.
 */
export function dropIfIrrelevant(hits: KbHit[]): { hits: KbHit[]; dropped: boolean } {
  const topSimilarity = hits[0]?.similarity ?? null;
  if (topSimilarity === null || topSimilarity >= WEAK_SIMILARITY_THRESHOLD) {
    return { hits, dropped: false };
  }
  return { hits: [], dropped: true };
}

/** Merges a second round into the first, keeping first-round order and
 *  dropping anything already present. */
export function mergeHits(first: KbHit[], second: KbHit[], cap: number): KbHit[] {
  const seen = new Set(first.map((hit) => hit.id));
  const merged = [...first];
  for (const hit of second) {
    if (seen.has(hit.id)) continue;
    seen.add(hit.id);
    merged.push(hit);
    if (merged.length >= cap) break;
  }
  return merged;
}
