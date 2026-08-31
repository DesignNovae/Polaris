/**
 * /api/community/messages
 *
 * GET  ?channel=visa&after=ISO - messages in a channel (oldest→newest),
 *       hidden + blocked-author rows filtered server-side. `after` enables
 *       cheap polling.
 * POST - { channel, text } - post a message. Safety guard (no links, no
 *       payment numbers) + per-plan rate limit run server-side.
 *
 * Open to every signed-in user regardless of plan.
 */

import { z } from "zod";
import { NextResponse } from "next/server";
import { ok, withErrorHandling, parseJson, HttpError } from "@/lib/api/respond";
import { requireSession } from "@/lib/authz";
import { rateLimit, rateLimitHeaders } from "@/lib/ratelimit";
import { listMessages, postMessage } from "@/lib/community/service";
import { getChannel } from "@/lib/community/registry";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const postSchema = z.object({
  channel: z.string().min(1).max(40),
  text: z.string().min(1).max(800),
});

function shape(m: Awaited<ReturnType<typeof listMessages>>[number], viewerId: string) {
  return {
    id: m._id?.toString(),
    channel: m.channel,
    userId: m.userId,
    userName: m.userName,
    authorRole: m.authorRole,
    mine: m.userId === viewerId,
    text: m.text,
    createdAt: m.createdAt,
  };
}

export const GET = withErrorHandling(async (req) => {
  const session = await requireSession();
  const url = new URL(req.url);
  const channel = url.searchParams.get("channel") ?? "general";
  if (!getChannel(channel)) throw new HttpError(404, "Unknown channel");
  const after = url.searchParams.get("after") ?? undefined;
  const rows = await listMessages(channel, session.id, { afterIso: after });
  return ok({ messages: rows.map((m) => shape(m, session.id)) });
});

export const POST = withErrorHandling(async (req) => {
  const session = await requireSession();

  const rl = await rateLimit(session.id, session.plan, "community");
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "Slow down a little - try again in a few minutes." },
      { status: 429, headers: rateLimitHeaders(rl) },
    );
  }

  const body = postSchema.parse(await parseJson(req));
  const res = await postMessage({
    channel: body.channel,
    userId: session.id,
    userName: session.name ?? "Student",
    authorRole: session.role ?? "student",
    text: body.text,
  });
  if (!res.ok) throw new HttpError(422, res.error);
  return ok({ message: shape(res.message, session.id) });
});

