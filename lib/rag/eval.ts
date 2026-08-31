/**
 * Retrieval evaluation harness.
 *
 * Runs the golden set in data/rag-eval.json through each retriever and reports
 * recall@k and MRR. This is the only honest way to tell whether a change to
 * chunking, fusion or the query planner actually helped - "it feels better"
 * is not a measurement.
 *
 * A query counts as recalled when any of its accepted document ids appears in
 * the top k. MRR uses the rank of the first accepted document.
 */

import goldenSet from "@/data/rag-eval.json";
import { hybridSearch, lexicalOnlySearch, vectorOnlySearch, type SearchHit } from "./search";
import { isEmbeddingEnabled } from "./embed";
import { loadKbVectors } from "./store";
import { rerank } from "./rerank";
import { createLimiter, FREE_TIER_GENERATE_RPM } from "./limiter";

export type EvalCase = {
  id: string;
  kind: string;
  q: string;
  expect: string[];
};

export type RetrieverName = "lexical" | "vector" | "hybrid" | "reranked";

export type EvalRow = {
  id: string;
  kind: string;
  q: string;
  /** 1-based rank of the first accepted document, or null if not in top k. */
  ranks: Record<RetrieverName, number | null>;
  /** Top hit per retriever, for eyeballing failures. */
  topHit: Record<RetrieverName, string | null>;
};

export type RetrieverSummary = {
  retriever: RetrieverName;
  queries: number;
  recallAt1: number;
  recallAt3: number;
  recallAt5: number;
  mrr: number;
  /** Query ids where nothing accepted appeared in the top k. */
  missed: string[];
};

export type EvalResult = {
  k: number;
  /** Whether the reranked retriever was scored (costs a model call per query). */
  rerankScored: boolean;
  /** How many rerank calls actually succeeded. A failed call silently returns
   *  the fused order, so without this a quota outage looks like "no effect". */
  rerankApplied: number;
  /** Retries the pacer had to absorb, and time spent waiting on the budget. */
  rerankRetries: number;
  throttledMs: number;
  /**
   * Why rerank calls did not apply, counted by reason. Zero retries alongside
   * a low applied count means the losses were not quota - without this the
   * only available conclusion is a wrong one.
   */
  rerankFailures: Record<string, number>;
  vectorsAvailable: boolean;
  embeddingsEnabled: boolean;
  indexedChunks: number;
  summaries: RetrieverSummary[];
  byKind: Array<{ kind: string; retriever: RetrieverName; recallAt3: number }>;
  rows: EvalRow[];
  ms: number;
};

export function loadGoldenSet(): EvalCase[] {
  return (goldenSet as { queries: EvalCase[] }).queries;
}

/** Chunk ids carry a `#n` suffix; comparison happens at document level. */
function documentIdOf(hit: SearchHit): string {
  return hit.docId ?? hit.id.split("#")[0];
}

function rankOf(hits: SearchHit[], expect: string[]): number | null {
  const accepted = new Set(expect);
  for (let i = 0; i < hits.length; i++) {
    if (accepted.has(documentIdOf(hits[i]))) return i + 1;
  }
  return null;
}

function summarize(
  retriever: RetrieverName,
  rows: EvalRow[],
): RetrieverSummary {
  const ranks = rows.map((row) => row.ranks[retriever]);
  const within = (n: number) =>
    ranks.filter((rank) => rank !== null && rank <= n).length / Math.max(rows.length, 1);
  const mrr =
    ranks.reduce<number>((sum, rank) => sum + (rank ? 1 / rank : 0), 0) /
    Math.max(rows.length, 1);
  return {
    retriever,
    queries: rows.length,
    recallAt1: round(within(1)),
    recallAt3: round(within(3)),
    recallAt5: round(within(5)),
    mrr: round(mrr),
    missed: rows.filter((row) => row.ranks[retriever] === null).map((row) => row.id),
  };
}

function round(value: number): number {
  return Math.round(value * 1000) / 1000;
}

export async function runEval(
  k = 5,
  options: { rerank?: boolean } = {},
): Promise<EvalResult> {
  const startedAt = Date.now();
  const scoreRerank = options.rerank === true;
  const cases = loadGoldenSet();
  const vectors = await loadKbVectors();
  const vectorsAvailable = vectors.length > 0 && isEmbeddingEnabled();

  // Rerank issues one model call per query. Unpaced, a long run loses calls to
  // quota - and a lost rerank call silently returns the fused order, so the
  // damage shows up as "the reranker did nothing" rather than as an error.
  const limiter = createLimiter({ requestsPerMinute: FREE_TIER_GENERATE_RPM });

  const rows: EvalRow[] = [];
  const rerankFailures: Record<string, number> = {};
  let rerankApplied = 0;
  for (const testCase of cases) {
    const [lexical, vector, hybrid] = await Promise.all([
      lexicalOnlySearch(testCase.q, k),
      vectorsAvailable ? vectorOnlySearch(testCase.q, k) : Promise.resolve([]),
      hybridSearch(testCase.q, k),
    ]);
    // Rerank a deeper candidate pool than we score, which is the only way the
    // reranker can promote something fusion buried below k.
    let reranked: SearchHit[] = [];
    if (scoreRerank) {
      const pool = await hybridSearch(testCase.q, k * 3);
      // rerank() never throws - it degrades to the fused order, which is
      // correct in production and useless here. Rethrow a rate-limit result so
      // the pacer can actually back off and retry it.
      const outcome = await limiter
        .run(async () => {
          const result = await rerank(testCase.q, pool, k);
          if (result.rateLimited) throw Object.assign(new Error("rate limited"), { status: 429 });
          return result;
        })
        .catch(() => rerank(testCase.q, pool, k));
      reranked = outcome.hits;
      if (outcome.applied) {
        rerankApplied++;
      } else {
        // Collapse the variable part of a message so reasons aggregate.
        const reason = outcome.reason.replace(/\d+/g, "N").slice(0, 60);
        rerankFailures[reason] = (rerankFailures[reason] ?? 0) + 1;
      }
    }
    rows.push({
      id: testCase.id,
      kind: testCase.kind,
      q: testCase.q,
      ranks: {
        lexical: rankOf(lexical, testCase.expect),
        vector: vectorsAvailable ? rankOf(vector, testCase.expect) : null,
        hybrid: rankOf(hybrid, testCase.expect),
        reranked: scoreRerank ? rankOf(reranked, testCase.expect) : null,
      },
      topHit: {
        lexical: lexical[0] ? documentIdOf(lexical[0]) : null,
        vector: vector[0] ? documentIdOf(vector[0]) : null,
        hybrid: hybrid[0] ? documentIdOf(hybrid[0]) : null,
        reranked: reranked[0] ? documentIdOf(reranked[0]) : null,
      },
    });
  }

  const retrievers: RetrieverName[] = [
    "lexical",
    ...(vectorsAvailable ? (["vector"] as const) : []),
    "hybrid",
    ...(scoreRerank ? (["reranked"] as const) : []),
  ];

  const kinds = [...new Set(cases.map((c) => c.kind))];
  const byKind = kinds.flatMap((kind) => {
    const subset = rows.filter((row) => row.kind === kind);
    return retrievers.map((retriever) => ({
      kind,
      retriever,
      recallAt3: summarize(retriever, subset).recallAt3,
    }));
  });

  return {
    k,
    rerankScored: scoreRerank,
    rerankApplied,
    rerankRetries: limiter.stats().retried,
    throttledMs: limiter.stats().throttledMs,
    rerankFailures,
    vectorsAvailable,
    embeddingsEnabled: isEmbeddingEnabled(),
    indexedChunks: vectors.length,
    summaries: retrievers.map((retriever) => summarize(retriever, rows)),
    byKind,
    rows,
    ms: Date.now() - startedAt,
  };
}

/** Plain-text report - what goes in the write-up. */
export function formatEval(result: EvalResult): string {
  const lines: string[] = [];
  lines.push(
    `Retrieval eval - ${result.rows.length} queries, k=${result.k}, ${result.indexedChunks} indexed chunks` +
      (result.vectorsAvailable ? "" : " (vector index empty - lexical only)"),
  );
  lines.push("");
  lines.push("retriever   R@1    R@3    R@5    MRR");
  for (const summary of result.summaries) {
    lines.push(
      [
        summary.retriever.padEnd(10),
        summary.recallAt1.toFixed(3).padStart(5),
        summary.recallAt3.toFixed(3).padStart(6),
        summary.recallAt5.toFixed(3).padStart(6),
        summary.mrr.toFixed(3).padStart(6),
      ].join(" "),
    );
  }
  if (result.rerankScored) {
    lines.push("");
    lines.push(
      `rerank applied on ${result.rerankApplied}/${result.rows.length} queries` +
        (result.rerankApplied < result.rows.length
          ? " - the rest fell back to fused order, so treat the row as a floor"
          : "") +
        (result.rerankRetries
          ? ` (${result.rerankRetries} retried after rate limiting, ${Math.round(result.throttledMs / 1000)}s spent waiting)`
          : ""),
    );
    const reasons = Object.entries(result.rerankFailures);
    if (reasons.length) {
      lines.push(
        `  did not apply: ${reasons.map(([reason, n]) => `${n}x ${reason}`).join("; ")}`,
      );
    }
  }
  lines.push("");
  lines.push("R@3 by query type:");
  const kinds = [...new Set(result.byKind.map((row) => row.kind))];
  for (const kind of kinds) {
    const parts = result.byKind
      .filter((row) => row.kind === kind)
      .map((row) => `${row.retriever} ${row.recallAt3.toFixed(2)}`);
    lines.push(`  ${kind.padEnd(11)} ${parts.join("   ")}`);
  }
  const missedByHybrid = result.summaries.find((s) => s.retriever === "hybrid")?.missed ?? [];
  if (missedByHybrid.length) {
    lines.push("");
    lines.push(`Hybrid missed: ${missedByHybrid.join(", ")}`);
    for (const id of missedByHybrid) {
      const row = result.rows.find((r) => r.id === id);
      if (row) lines.push(`  ${id}: "${row.q}" -> top hit ${row.topHit.hybrid ?? "(none)"}`);
    }
  }
  lines.push("");
  lines.push(`Completed in ${result.ms}ms.`);
  return lines.join("\n");
}
