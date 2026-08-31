import { ok, withErrorHandling, parseJson, HttpError } from "@/lib/api/respond";
import { requireRole } from "@/lib/authz";
import {
  getContentAdmin,
  createContentItem,
  updateContentItem,
  deleteContentItem,
  isContentType,
} from "@/lib/content";

export const dynamic = "force-dynamic";

async function getType(ctx: unknown): Promise<"universities" | "scholarships" | "case-studies"> {
  const { type } = await (ctx as { params: Promise<{ type: string }> }).params;
  if (!isContentType(type)) throw new HttpError(404, "Unknown content type");
  return type;
}

export const GET = withErrorHandling(async (_req, ctx) => {
  await requireRole("admin");
  const type = await getType(ctx);
  const items = await getContentAdmin(type);
  return ok({ items });
});

export const POST = withErrorHandling(async (req, ctx) => {
  await requireRole("admin");
  const type = await getType(ctx);
  const { item } = (await parseJson(req)) as { item?: Record<string, unknown> };
  if (!item || typeof item !== "object") throw new HttpError(400, "Missing item");
  const id = await createContentItem(type, item);
  return ok({ id }, 201);
});

export const PUT = withErrorHandling(async (req, ctx) => {
  await requireRole("admin");
  const type = await getType(ctx);
  const { id, item } = (await parseJson(req)) as {
    id?: string;
    item?: Record<string, unknown>;
  };
  if (!id || !item) throw new HttpError(400, "Missing id or item");
  await updateContentItem(type, id, item);
  return ok({ ok: true });
});

export const DELETE = withErrorHandling(async (req, ctx) => {
  await requireRole("admin");
  const type = await getType(ctx);
  const { id } = (await parseJson(req)) as { id?: string };
  if (!id) throw new HttpError(400, "Missing id");
  await deleteContentItem(type, id);
  return ok({ ok: true });
});

