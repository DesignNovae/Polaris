import { z } from "zod";
import { ok, withErrorHandling } from "@/lib/api/respond";
import { requireRole } from "@/lib/authz";
import { noticeSchema } from "@/lib/notices/schema";
import { listNotices, saveNotice } from "@/lib/notices/service";
import { noticeJson } from "@/lib/notices/request";

export const dynamic = "force-dynamic";
export const GET = withErrorHandling(async (req) => {
  const user = await requireRole("admin");
  const page = z.coerce
    .number()
    .int()
    .min(0)
    .max(10000)
    .parse(req.nextUrl.searchParams.get("page") ?? 0);
  return ok(await listNotices(user, true, page));
});
export const POST = withErrorHandling(async (req) => {
  const user = await requireRole("admin");
  const input = noticeSchema.parse(await noticeJson(req));
  return ok({ notice: await saveNotice(input, user.id) }, 201);
});
