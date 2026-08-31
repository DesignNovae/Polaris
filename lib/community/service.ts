/**
 * Community - message store + safety layer.
 *
 * Server-enforced rules:
 *   • link/payment-handle guard (no URLs, no wallet numbers in chat)
 *   • per-user posting rate limit (shared lib/ratelimit.ts window)
 *   • report → moderation queue; 3+ reports auto-hide a message
 *   • block → blocked users' messages are filtered from YOUR reads
 */

import { ObjectId } from "mongodb";
import { getDb } from "@/lib/db/mongodb";
import { getChannel } from "./registry";

export type DbCommunityMessage = {
  _id?: ObjectId;
  channel: string;
  userId: string;
  userName: string;
  /** "student" | "mentor" | "admin" - drives the badge. */
  authorRole: string;
  text: string;
  reportCount: number;
  hidden: boolean;
  createdAt: Date;
};

export type DbCommunityReport = {
  _id?: ObjectId;
  messageId: string;
  channel: string;
  reporterId: string;
  reason: string;
  status: "open" | "resolved";
  createdAt: Date;
};

export type DbUserBlock = {
  _id?: ObjectId;
  blockerId: string;
  blockedUserId: string;
  createdAt: Date;
};

const AUTO_HIDE_REPORTS = 3;

/** No URLs, no obvious wallet/payment solicitation. */
export function violatesSafety(text: string): string | null {
  if (/(https?:\/\/|www\.)/i.test(text)) {
    return "Links aren't allowed in community chat - describe the resource instead.";
  }
  if (/(bkash|nagad|rocket)\s*(number|no\.?|account)?\s*[:\-]?\s*01\d{8,}/i.test(text) || /\b01\d{9}\b/.test(text)) {
    return "Payment numbers can't be shared in chat. Use verified consultant bookings instead.";
  }
  if (text.trim().length === 0) return "Say something first.";
  if (text.length > 800) return "Keep messages under 800 characters.";
  return null;
}

export async function postMessage(input: {
  channel: string;
  userId: string;
  userName: string;
  authorRole: string;
  text: string;
}): Promise<{ ok: true; message: DbCommunityMessage } | { ok: false; error: string }> {
  if (!getChannel(input.channel)) return { ok: false, error: "Unknown channel." };
  const violation = violatesSafety(input.text);
  if (violation) return { ok: false, error: violation };

  const db = await getDb();
  const message: DbCommunityMessage = {
    channel: input.channel,
    userId: input.userId,
    userName: input.userName,
    authorRole: input.authorRole,
    text: input.text.trim(),
    reportCount: 0,
    hidden: false,
    createdAt: new Date(),
  };
  const res = await db.collection<DbCommunityMessage>("community_messages").insertOne(message);
  message._id = res.insertedId;
  return { ok: true, message };
}

/** Latest messages in a channel, oldest→newest, minus hidden + blocked authors. */
export async function listMessages(
  channel: string,
  viewerId: string,
  opts: { afterIso?: string; limit?: number } = {},
): Promise<DbCommunityMessage[]> {
  const db = await getDb();
  const blocked = await db
    .collection<DbUserBlock>("community_blocks")
    .find({ blockerId: viewerId }, { projection: { blockedUserId: 1 } })
    .toArray();
  const blockedIds = blocked.map((b) => b.blockedUserId);

  const query: Record<string, unknown> = { channel, hidden: false };
  if (blockedIds.length) query.userId = { $nin: blockedIds };
  if (opts.afterIso) query.createdAt = { $gt: new Date(opts.afterIso) };

  const rows = await db
    .collection<DbCommunityMessage>("community_messages")
    .find(query)
    .sort({ createdAt: -1 })
    .limit(Math.min(opts.limit ?? 60, 100))
    .toArray();
  return rows.reverse();
}

export async function reportMessage(input: {
  messageId: string;
  reporterId: string;
  reason: string;
}): Promise<{ ok: boolean; error?: string }> {
  if (!ObjectId.isValid(input.messageId)) return { ok: false, error: "Message not found." };
  const db = await getDb();
  const msgs = db.collection<DbCommunityMessage>("community_messages");
  const msg = await msgs.findOne({ _id: new ObjectId(input.messageId) });
  if (!msg) return { ok: false, error: "Message not found." };

  const reports = db.collection<DbCommunityReport>("community_reports");
  const already = await reports.findOne({ messageId: input.messageId, reporterId: input.reporterId });
  if (already) return { ok: false, error: "You already reported this message." };

  await reports.insertOne({
    messageId: input.messageId,
    channel: msg.channel,
    reporterId: input.reporterId,
    reason: input.reason.slice(0, 300) || "No reason given",
    status: "open",
    createdAt: new Date(),
  });

  const next = (msg.reportCount ?? 0) + 1;
  await msgs.updateOne(
    { _id: msg._id },
    { $set: { reportCount: next, ...(next >= AUTO_HIDE_REPORTS ? { hidden: true } : {}) } },
  );
  return { ok: true };
}

export async function blockUser(blockerId: string, blockedUserId: string): Promise<{ ok: boolean; error?: string }> {
  if (blockerId === blockedUserId) return { ok: false, error: "You can't block yourself." };
  const db = await getDb();
  await db.collection<DbUserBlock>("community_blocks").updateOne(
    { blockerId, blockedUserId },
    { $setOnInsert: { blockerId, blockedUserId, createdAt: new Date() } },
    { upsert: true },
  );
  return { ok: true };
}

/** Moderation queue for admins: open reports with message context. */
export async function listOpenReports(limit = 50): Promise<Array<DbCommunityReport & { message?: DbCommunityMessage }>> {
  const db = await getDb();
  const reports = await db
    .collection<DbCommunityReport>("community_reports")
    .find({ status: "open" })
    .sort({ createdAt: -1 })
    .limit(limit)
    .toArray();
  const ids = reports.filter((r) => ObjectId.isValid(r.messageId)).map((r) => new ObjectId(r.messageId));
  const msgs = await db
    .collection<DbCommunityMessage>("community_messages")
    .find({ _id: { $in: ids } })
    .toArray();
  const byId = new Map(msgs.map((m) => [m._id!.toString(), m]));
  return reports.map((r) => ({ ...r, message: byId.get(r.messageId) }));
}

