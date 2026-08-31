/**
 * LLM reranking.
 *
 * Fusion (search.ts) merges two rank lists, but neither retriever ever reads
 * the query and the passage *together* - BM25 counts terms, cosine compares
 * two independent encodings. A reranker does the thing both skip: score each
 * candidate against the actual question.
 *
 * This is the classic cross-encoder slot. There is no cross-encoder in the
 * Gemma API, so the model itself scores candidates in one batched call.
 *
 * Measured on the 50-query golden set, 114 chunks, 48/50 calls applied
 * (npm run rag:eval -- --rerank):
 *
 *     retriever   R@1     R@3     R@5     MRR
 *     hybrid      0.840   0.980   0.980   0.897
 *     reranked    0.940   0.960   0.980   0.955
 *
 * It buys ordering, not coverage: R@1 +0.10 and MRR +0.06, while R@5 is
 * unchanged at 0.98 and R@3 is marginally worse. Since the Strategist hands
 * the model all five passages, the right passage is already in front of it
 * either way - reranking only changes which one it reads first.
 *
 * So this ships off, which is a judgement call rather than a verdict from the
 * data: one extra second on every turn is a certain cost, and better ordering
 * is an uncertain benefit until answer quality is shown to depend on it. Turn
 * it on with RAG_RERANK=on - retrieval depth widens to 15 automatically so the
 * reranker has something to promote.
 */

import { generateGemmaText } from "@/lib/llm/gemma";

/** Anything with an id, a title and body text can be reranked. */
export type Rerankable = { id: string; title: string; text: string };

export function isRerankEnabled(): boolean {
  return process.env.RAG_RERANK === "on";
}

const RERANK_SYSTEM = [
  "You score how well each passage answers a specific question. You are a ranking function, not an assistant - never answer the question itself.",
  "For each passage, give an integer 0-10:",
  "  10 - directly and completely answers the question",
  "  7-9 - contains the specific fact asked for, with other material around it",
  "  4-6 - same topic, but does not contain the fact asked for",
  "  1-3 - loosely related",
  "  0 - irrelevant",
  "Judge only what the passage actually says. Do not reward a passage for being about a famous institution.",
  'Return JSON: {"scores": [{"id": "<passage id>", "score": <0-10>}]} with one entry per passage, ids copied exactly.',
].join("\n");

const RERANK_SCHEMA = {
  type: "object",
  properties: {
    scores: {
      type: "array",
      items: {
        type: "object",
        properties: { id: { type: "string" }, score: { type: "integer" } },
        required: ["id", "score"],
      },
    },
  },
  required: ["scores"],
};

/** Passage text sent to the judge. Long enough to contain the fact, short
 *  enough that 12 candidates fit comfortably in one call. */
const SNIPPET_CHARS = 400;
const RERANK_TIMEOUT_MS = 8000;

function timeoutSignal(signal?: AbortSignal): AbortSignal {
  const timeout = AbortSignal.timeout(RERANK_TIMEOUT_MS);
  if (!signal) return timeout;
  return typeof AbortSignal.any === "function"
    ? AbortSignal.any([signal, timeout])
    : timeout;
}

export type RerankOutcome<T extends Rerankable> = {
  hits: T[];
  /** False when the reranker was skipped or failed - hits are the fused order. */
  applied: boolean;
  reason: string;
  /**
   * True when the failure was rate limiting.
   *
   * This catch block is right for production - a reranker that throws must
   * never cost a student their answer - but it also swallows the 429 that a
   * batch harness needs to see in order to back off and retry. Reporting it
   * lets the eval decide to retry while the request path still degrades
   * silently. Without this the eval measured a quota outage as "the reranker
   * had no effect", which is the flattering direction to be wrong in.
   */
  rateLimited: boolean;
};

/**
 * Reorders candidates by relevance to `query`. Returns the input order
 * unchanged on any failure: a reranker that throws must not cost the student
 * their answer.
 */
export async function rerank<T extends Rerankable>(
  query: string,
  hits: T[],
  topK: number,
  options: { signal?: AbortSignal } = {},
): Promise<RerankOutcome<T>> {
  if (hits.length <= 1) {
    return {
      hits: hits.slice(0, topK),
      applied: false,
      reason: "nothing to reorder",
      rateLimited: false,
    };
  }

  const passages = hits
    .map((hit, i) => `[${i}] id=${hit.id}\n${hit.title}: ${hit.text.slice(0, SNIPPET_CHARS)}`)
    .join("\n\n");

  try {
    const raw = await generateGemmaText({
      system: RERANK_SYSTEM,
      contents: `<question>${query}</question>\n\n<passages>\n${passages}\n</passages>`,
      temperature: 0,
      maxOutputTokens: 500,
      thinkingLevel: "minimal",
      responseJsonSchema: RERANK_SCHEMA,
      abortSignal: timeoutSignal(options.signal),
    });
    if (!raw) {
      return {
        hits: hits.slice(0, topK),
        applied: false,
        reason: "reranker returned nothing",
        rateLimited: false,
      };
    }

    const parsed = JSON.parse(raw) as { scores?: Array<{ id?: string; score?: number }> };
    const scores = new Map<string, number>();
    for (const row of parsed.scores ?? []) {
      if (typeof row?.id === "string" && Number.isFinite(row?.score)) {
        scores.set(row.id, Number(row.score));
      }
    }
    if (scores.size === 0) {
      return {
        hits: hits.slice(0, topK),
        applied: false,
        reason: "no usable scores",
        rateLimited: false,
      };
    }

    // Anything the reranker failed to score keeps its fused position by
    // falling back to a score derived from that position - never dropped.
    const reordered = hits
      .map((hit, i) => ({
        hit,
        // Ties broken by original rank, so fusion still speaks when the
        // reranker is indifferent between two passages.
        score: scores.get(hit.id) ?? 5 - i * 0.01,
        original: i,
      }))
      .sort((left, right) =>
        right.score === left.score
          ? left.original - right.original
          : right.score - left.score,
      )
      .slice(0, topK)
      .map(({ hit }) => hit);

    return {
      hits: reordered,
      applied: true,
      reason: `scored ${scores.size}/${hits.length}`,
      rateLimited: false,
    };
  } catch (err) {
    const e = err as { status?: number; message?: string };
    const rateLimited =
      e?.status === 429 ||
      e?.status === 503 ||
      /quota|rate.?limit|exceeded|\b(?:429|503)\b/i.test(e?.message ?? "");
    return {
      hits: hits.slice(0, topK),
      applied: false,
      reason: rateLimited ? "rate limited" : `rerank failed: ${e?.message ?? "unknown"}`,
      rateLimited,
    };
  }
}
