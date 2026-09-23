import { z } from "zod";
import { ok, withErrorHandling } from "@/lib/api/respond";
import { requireSession } from "@/lib/authz";
import { listNotices, unreadCount } from "@/lib/notices/service";

export const dynamic = "force-dynamic";
export const GET = withErrorHandling(async (req) => {
  const user = await requireSession();
  if (req.nextUrl.searchParams.get("count") === "1")
    return ok({ unread: await unreadCount(user) });
  const page = z.coerce
    .number()
    .int()
    .min(0)
    .max(10000)
    .parse(req.nextUrl.searchParams.get("page") ?? 0);
  return ok(await listNotices(user, false, page));
});
