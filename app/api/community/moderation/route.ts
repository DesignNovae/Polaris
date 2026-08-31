/**
 * POST /api/community/moderation
 *
 * { action: "report", messageId, reason? }  - file a report; 3+ distinct
 *   reports auto-hide the message into the moderation queue.
 * { action: "block", userId }               - hide that user's messages
 *   from your feed everywhere.
 *
 * GET - admins only: the open moderation queue.
 */

import { z } from "zod";
import { ok, withErrorHandling, parseJson, HttpError } from "@/lib/api/respond";
import { requireSession, requireRole } from "@/lib/authz";
import { reportMessage, blockUser, listOpenReports } from "@/lib/community/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const schema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("report"),
    messageId: z.string().min(1).max(40),
    reason: z.string().max(300).optional(),
  }),
  z.object({
    action: z.literal("block"),
    userId: z.string().min(1).max(40),
  }),
]);

export const POST = withErrorHandling(async (req) => {
  const session = await requireSession();
  const body = schema.parse(await parseJson(req));

  if (body.action === "report") {
    const res = await reportMessage({
      messageId: body.messageId,
      reporterId: session.id,
      reason: body.reason ?? "",
    });
    if (!res.ok) throw new HttpError(409, res.error ?? "Couldn't report");
    return ok({ reported: true });
  }

  const res = await blockUser(session.id, body.userId);
  if (!res.ok) throw new HttpError(409, res.error ?? "Couldn't block");
  return ok({ blocked: true });
});

export const GET = withErrorHandling(async () => {
  await requireRole("admin");
  const queue = await listOpenReports();
  return ok({
    reports: queue.map((r) => ({
      id: r._id?.toString(),
      messageId: r.messageId,
      channel: r.channel,
      reason: r.reason,
      createdAt: r.createdAt,
      message: r.message
        ? { text: r.message.text, userName: r.message.userName, hidden: r.message.hidden, reportCount: r.message.reportCount }
        : null,
    })),
  });
});

