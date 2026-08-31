/**
 * Admin CRUD for long-form knowledge documents.
 *
 *   GET    /api/admin/rag/documents  - list
 *   POST   /api/admin/rag/documents  - create   { item }
 *   PUT    /api/admin/rag/documents  - update   { id, item }
 *   DELETE /api/admin/rag/documents  - delete   { id }
 *
 * Writes invalidate the retrieval caches, so keyword search reflects a change
 * immediately. Semantic search needs the vectors rebuilt - POST /api/admin/rag
 * does that incrementally, embedding only the chunks whose text moved.
 */

import { ok, withErrorHandling, parseJson, HttpError } from "@/lib/api/respond";
import { requireRole } from "@/lib/authz";
import {
  createDocument,
  deleteDocument,
  listDocuments,
  updateDocument,
  DocumentValidationError,
  type KbDocumentInput,
} from "@/lib/rag/documents";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Validation failures are the author's problem to fix, so they read as 400s. */
function asHttpError(err: unknown): never {
  if (err instanceof DocumentValidationError) throw new HttpError(400, err.message);
  throw err;
}

export const GET = withErrorHandling(async () => {
  await requireRole("admin");
  return ok({ items: await listDocuments() });
});

export const POST = withErrorHandling(async (req) => {
  await requireRole("admin");
  const { item } = (await parseJson(req)) as { item?: KbDocumentInput };
  if (!item) throw new HttpError(400, "Missing item");
  try {
    return ok({ id: await createDocument(item) }, 201);
  } catch (err) {
    asHttpError(err);
  }
});

export const PUT = withErrorHandling(async (req) => {
  await requireRole("admin");
  const { id, item } = (await parseJson(req)) as { id?: string; item?: KbDocumentInput };
  if (!id || !item) throw new HttpError(400, "Missing id or item");
  try {
    await updateDocument(id, item);
    return ok({ ok: true });
  } catch (err) {
    asHttpError(err);
  }
});

export const DELETE = withErrorHandling(async (req) => {
  await requireRole("admin");
  const { id } = (await parseJson(req)) as { id?: string };
  if (!id) throw new HttpError(400, "Missing id");
  await deleteDocument(id);
  return ok({ ok: true });
});
