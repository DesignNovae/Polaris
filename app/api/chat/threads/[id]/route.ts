import { z } from "zod";
import { ok, withErrorHandling, parseJson } from "@/lib/api/respond";
import { requireSession } from "@/lib/authz";
import { deleteThread, renameThread } from "@/lib/db/collections";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const renameSchema = z.object({ title: z.string().min(1).max(120) });

export const PATCH = withErrorHandling(async (req, ctx: { params: Promise<{ id: string }> }) => {
  const session = await requireSession();
  const { id } = await ctx.params;
  const body = renameSchema.parse(await parseJson(req));
  return ok({ renamed: await renameThread(session.id, id, body.title) });
});

export const DELETE = withErrorHandling(async (_req, ctx: { params: Promise<{ id: string }> }) => {
  const session = await requireSession();
  const { id } = await ctx.params;
  await deleteThread(session.id, id);
  return ok({ deleted: true });
});
