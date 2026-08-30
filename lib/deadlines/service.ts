import { ObjectId } from "mongodb";
import { getDb } from "@/lib/db/mongodb";
import { HttpError } from "@/lib/api/respond";
import type { ChecklistItem, DeadlineCreate, DeadlinePatch, DeadlineType } from "./schema";

type DeadlineKind = "hard" | "soft" | "repeat";

export type DbDeadline = {
  _id?: ObjectId;
  userId: string;
  date: string;
  title: string;
  kind: DeadlineKind;
  milestoneId?: string;
  source: "user" | "ai" | "external" | "university";
  createdAt: Date;
  /** Legacy alias used by older consumers; current deadline records use date. */
  dueAt?: string;
  // ── extended model (all optional for back-compat with old rows) ──
  type?: DeadlineType;
  priority?: "high" | "medium" | "low";
  status?: "pending" | "done";
  universityId?: string;
  universityName?: string;
  officialLink?: string;
  notes?: string;
  checklist?: ChecklistItem[];
  reminderDays?: number[];
};

const COLL = "deadlines";

export async function listDeadlines(userId: string, opts?: { from?: string; to?: string }) {
  const db = await getDb();
  const q: Record<string, unknown> = { userId };
  if (opts?.from || opts?.to) {
    q.date = {} as Record<string, string>;
    if (opts.from) (q.date as Record<string, string>).$gte = opts.from;
    if (opts.to)   (q.date as Record<string, string>).$lte = opts.to;
  }
  return db.collection<DbDeadline>(COLL).find(q).sort({ date: 1 }).toArray();
}

export async function createDeadline(userId: string, body: DeadlineCreate) {
  const db = await getDb();
  const doc: DbDeadline = {
    userId,
    date: body.date,
    title: body.title,
    kind: body.kind,
    milestoneId: body.milestoneId,
    source: body.universityId ? "university" : "user",
    createdAt: new Date(),
    type: body.type,
    priority: body.priority,
    status: "pending",
    universityId: body.universityId,
    universityName: body.universityName,
    officialLink: body.officialLink,
    notes: body.notes,
    checklist: body.checklist,
    reminderDays: body.reminderDays,
  };
  const res = await db.collection<DbDeadline>(COLL).insertOne(doc);
  return { ...doc, _id: res.insertedId };
}

export async function patchDeadline(userId: string, id: string, body: DeadlinePatch) {
  if (!ObjectId.isValid(id)) throw new HttpError(400, "Invalid deadline id");
  const db = await getDb();
  const res = await db.collection<DbDeadline>(COLL).updateOne(
    { _id: new ObjectId(id), userId },
    { $set: body },
  );
  if (res.matchedCount === 0) throw new HttpError(404, "Deadline not found");
}

export async function deleteDeadline(userId: string, id: string) {
  if (!ObjectId.isValid(id)) throw new HttpError(400, "Invalid deadline id");
  const db = await getDb();
  const res = await db.collection<DbDeadline>(COLL).deleteOne({ _id: new ObjectId(id), userId });
  if (res.deletedCount === 0) throw new HttpError(404, "Deadline not found");
}
