import { z } from "zod";
import { ok, withErrorHandling } from "@/lib/api/respond";
import { requireSession } from "@/lib/authz";
import { markNoticeRead } from "@/lib/notices/service";
import { noticeJson } from "@/lib/notices/request";

export const POST = withErrorHandling(
  async (req, ctx: { params: Promise<{ id: string }> }) => {
    const user = await requireSession();
    const { id } = await ctx.params;
    const { revision } = z
      .object({ revision: z.number().int().positive() })
      .strict()
      .parse(await noticeJson(req));
    await markNoticeRead(id, revision, user);
    return ok({ ok: true });
  },
);
