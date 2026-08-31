/**
 * GET /api/admin/rag/eval - run the retrieval golden set.
 *
 * Compares BM25, dense vectors and the fused hybrid on the same queries and
 * returns recall@k / MRR for each. Admin only: it issues one embedding call
 * per query, and the failure rows quote KB content.
 *
 * `?k=5` sets the cutoff, `?format=text` returns the plain-text report,
 * `?rerank=1` also scores the reranked retriever (one extra model call per
 * query), and `?faithfulness=N` grades N generated answers for groundedness
 * and citation validity instead of running the retrieval set.
 */

import { ok, withErrorHandling } from "@/lib/api/respond";
import { requireRole } from "@/lib/authz";
import { formatEval, runEval } from "@/lib/rag/eval";
import { formatFaithfulness, runFaithfulnessEval } from "@/lib/rag/faithfulness";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

export const GET = withErrorHandling(async (req) => {
  await requireRole("admin");
  const url = new URL(req.url);
  const asText = url.searchParams.get("format") === "text";

  // Generation-side eval: costs two model calls per sampled answer, so the
  // sample size is explicit rather than defaulted to the whole set.
  const faithParam = url.searchParams.get("faithfulness");
  if (faithParam) {
    const sample = Math.min(Math.max(Number(faithParam) || 6, 1), 20);
    const result = await runFaithfulnessEval({ sample });
    return asText
      ? new Response(formatFaithfulness(result), {
          headers: { "Content-Type": "text/plain; charset=utf-8" },
        })
      : ok(result);
  }

  const k = Math.min(Math.max(Number(url.searchParams.get("k")) || 5, 1), 20);
  const result = await runEval(k, { rerank: url.searchParams.get("rerank") === "1" });

  return asText
    ? new Response(formatEval(result), {
        headers: { "Content-Type": "text/plain; charset=utf-8" },
      })
    : ok(result);
});
