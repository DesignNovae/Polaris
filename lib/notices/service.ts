import { ObjectId, type Filter, type Db } from "mongodb";
import { getDb } from "@/lib/db/mongodb";
import { HttpError } from "@/lib/api/respond";
import {
  canReadNotice,
  type Notice,
  type NoticeInput,
  type NoticeViewer,
} from "./schema";

export type StoredNotice = NoticeInput & {
  _id: ObjectId;
  revision: number;
  createdAt: string;
  updatedAt: string;
  publishedAt: string | null;
  authorId: string;
  updatedBy: string;
};
export function noticeId(id: string) {
  if (!/^[a-f0-9]{24}$/.test(id)) throw new HttpError(400, "Invalid notice ID");
  return new ObjectId(id);
}
function publicNotice(doc: StoredNotice): Notice {
  const { _id, authorId: _author, updatedBy: _editor, ...rest } = doc;
  void _author;
  void _editor;
  return { ...rest, id: _id.toHexString() };
}
export function audienceFilter(user: NoticeViewer): Filter<StoredNotice> {
  return {
    status: "published",
    "audience.roles": user.role,
    "audience.plans": user.plan,
    $or: [
      { expiresAt: null },
      { expiresAt: { $gt: new Date().toISOString() } },
    ],
  };
}
export async function listNotices(
  user: NoticeViewer,
  admin = false,
  page = 0,
  database?: Db,
) {
  const db = database ?? (await getDb());
  const filter = admin ? {} : audienceFilter(user);
  const col = db.collection<StoredNotice>("notices");
  const items = await col
    .find(filter)
    .sort({ publishedAt: -1, updatedAt: -1, _id: -1 })
    .skip(page * 20)
    .limit(21)
    .toArray();
  const ids = items.slice(0, 20).map((n) => n._id.toHexString());
  const receipts = admin
    ? []
    : await db
        .collection("notice_reads")
        .find({ userId: user.id, noticeId: { $in: ids } })
        .toArray();
  const read = new Map(receipts.map((r) => [r.noticeId, r.revision]));
  return {
    notices: items
      .slice(0, 20)
      .map((n) => ({
        ...publicNotice(n),
        read: read.get(n._id.toHexString()) === n.revision,
      })),
    hasMore: items.length > 20,
  };
}
export async function unreadCount(user: NoticeViewer, database?: Db) {
  const db = database ?? (await getDb());
  const result = await db
    .collection<StoredNotice>("notices")
    .aggregate([
      { $match: audienceFilter(user) },
      {
        $lookup: {
          from: "notice_reads",
          let: { nid: { $toString: "$_id" }, rev: "$revision" },
          pipeline: [
            {
              $match: {
                userId: user.id,
                $expr: {
                  $and: [
                    { $eq: ["$noticeId", "$$nid"] },
                    { $eq: ["$revision", "$$rev"] },
                  ],
                },
              },
            },
            { $limit: 1 },
          ],
          as: "receipt",
        },
      },
      { $match: { "receipt.0": { $exists: false } } },
      { $count: "count" },
    ])
    .toArray();
  return result[0]?.count ?? 0;
}
export async function getNotice(
  id: string,
  user: NoticeViewer,
  admin = false,
  database?: Db,
) {
  const db = database ?? (await getDb());
  const doc = await db
    .collection<StoredNotice>("notices")
    .findOne({ _id: noticeId(id) });
  if (!doc || (!admin && !canReadNotice(publicNotice(doc), user)))
    throw new HttpError(404, "Notice not found");
  return publicNotice(doc);
}
export async function saveNotice(
  input: NoticeInput,
  userId: string,
  id?: string,
  revision?: number,
  database?: Db,
) {
  const db = database ?? (await getDb());
  const now = new Date().toISOString();
  if (input.status === "published" && input.expiresAt && input.expiresAt <= now)
    throw new HttpError(400, "Choose an expiry time in the future");
  const assetIds = [
    ...new Set(
      [input.imageUrl, input.logoUrl]
        .filter(Boolean)
        .map((url) => url.split("/").pop()!),
    ),
  ];
  if (assetIds.length) {
    const count = await db
      .collection("notice_media")
      .countDocuments({ _id: { $in: assetIds.map(noticeId) } });
    if (count !== assetIds.length)
      throw new HttpError(
        400,
        "An uploaded image has expired. Upload it again.",
      );
    // Keep assets once attached to a saved draft or publication.
    await db
      .collection("notice_media")
      .updateMany(
        { _id: { $in: assetIds.map(noticeId) } },
        { $unset: { expiresAt: "" } },
      );
  }
  const col = db.collection<StoredNotice>("notices");
  if (id) {
    const old = await col.findOne({ _id: noticeId(id) });
    if (!old) throw new HttpError(404, "Notice not found");
    const result = await col.findOneAndUpdate(
      { _id: old._id, revision },
      {
        $set: {
          ...input,
          updatedAt: now,
          updatedBy: userId,
          publishedAt:
            input.status === "published"
              ? old.status === "published"
                ? old.publishedAt
                : now
              : old.publishedAt,
        },
        $inc: { revision: 1 },
      },
      { returnDocument: "after" },
    );
    if (!result)
      throw new HttpError(
        409,
        "This notice changed in another session. Reload it before saving.",
      );
    return publicNotice(result);
  }
  const doc: StoredNotice = {
    ...input,
    _id: new ObjectId(),
    revision: 1,
    createdAt: now,
    updatedAt: now,
    publishedAt: input.status === "published" ? now : null,
    authorId: userId,
    updatedBy: userId,
  };
  await col.insertOne(doc);
  return publicNotice(doc);
}
export async function markNoticeRead(
  id: string,
  revision: number,
  user: NoticeViewer,
  database?: Db,
) {
  const notice = await getNotice(id, user, false, database);
  if (notice.revision !== revision)
    throw new HttpError(
      409,
      "This notice has been updated. Refresh to read the latest version.",
    );
  const db = database ?? (await getDb());
  // Deterministic key makes concurrent reads idempotent without a race on an upsert index.
  await db
    .collection<{
      _id: string;
      userId: string;
      noticeId: string;
      revision: number;
      readAt: string;
    }>("notice_reads")
    .updateOne(
      { _id: `${user.id}:${id}` },
      {
        $set: {
          userId: user.id,
          noticeId: id,
          readAt: new Date().toISOString(),
        },
        $max: { revision },
      },
      { upsert: true },
    );
}
