import { z } from "zod";
import { ok, withErrorHandling } from "@/lib/api/respond";
import { requireRole } from "@/lib/authz";
import { noticeSchema } from "@/lib/notices/schema";
import { saveNotice } from "@/lib/notices/service";
import { noticeJson } from "@/lib/notices/request";

export const PATCH = withErrorHandling(
  async (req, ctx: { params: Promise<{ id: string }> }) => {
    const user = await requireRole("admin");
    const { id } = await ctx.params;
    const { notice, revision } = z
      .object({ notice: noticeSchema, revision: z.number().int().positive() })
      .strict()
      .parse(await noticeJson(req));
    return ok({ notice: await saveNotice(notice, user.id, id, revision) });
  },
);
