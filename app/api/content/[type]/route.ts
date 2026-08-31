import { ok, withErrorHandling, HttpError } from "@/lib/api/respond";
import { getContent, isContentType } from "@/lib/content";

export const dynamic = "force-dynamic";

export const GET = withErrorHandling(async (_req, ctx) => {
  const { type } = await (ctx as { params: Promise<{ type: string }> }).params;
  if (!isContentType(type)) throw new HttpError(404, "Unknown content type");
  const items = await getContent(type);
  return ok({ items });
});

