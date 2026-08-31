/**
 * GET  /api/admin/rag  - index status
 * POST /api/admin/rag  - rebuild the shared KB index (incremental by default)
 *
 * Admin only. Ingestion re-embeds just the chunks whose content hash moved,
 * so running this after every content edit is cheap. `force: true` re-embeds
 * everything - use it after changing the embedding model or dimensionality.
 */

import { ok, withErrorHandling, parseJson } from "@/lib/api/respond";
import { requireRole } from "@/lib/authz";
import { buildKbChunks } from "@/lib/rag/flatten";
import { ingestKb } from "@/lib/rag/ingest";
import { kbIndexStats } from "@/lib/rag/store";
import { isEmbeddingEnabled, EMBED_MODEL, EMBED_DIM } from "@/lib/rag/embed";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
/** A cold full re-embed of the corpus takes tens of seconds. */
export const maxDuration = 300;

export const GET = withErrorHandling(async () => {
  await requireRole("admin");
  const [stats, chunks] = await Promise.all([kbIndexStats(), buildKbChunks()]);
  return ok({
    embeddings: {
      enabled: isEmbeddingEnabled(),
      model: EMBED_MODEL,
      dimensions: EMBED_DIM,
    },
    source: {
      chunks: chunks.length,
      documents: new Set(chunks.map((chunk) => chunk.docId)).size,
    },
    index: stats,
    /** Chunks the source produces that are not in the index yet. */
    pendingChunks: Math.max(chunks.length - stats.usable, 0),
  });
});

export const POST = withErrorHandling(async (req) => {
  await requireRole("admin");
  const body = (await parseJson(req).catch(() => ({}))) as { force?: boolean };
  const report = await ingestKb({ force: body?.force === true });
  return ok({ report, index: await kbIndexStats() });
});
