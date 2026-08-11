import { getDb } from "./mongodb";
import { ObjectId } from "mongodb";
import type { StudentProfile } from "@/lib/profile";

/* ─── Types ─── */

export type UserRole = "student" | "parent" | "partner" | "admin";
export type Plan = "free" | "pro" | "elite";

export type LlmUsageRecord = {
  userId: string;
  providerId: string;
  modelId: string;
  tier: "free" | "paid" | "local";
  mode: string;
  tokensIn: number;
  tokensOut: number;
  latencyMs: number;
  fallback: boolean;
  outcome: "ok" | "error";
  errorCode?: string;
};

export type DbUser = {
  _id?: ObjectId;
  name: string;
  email: string;
  password: string;
  role: UserRole;
  plan: Plan;
  /* Optional contact + avatar (editable from /account). */
  phone?: string;
  avatarUrl?: string;
  createdAt: Date;
};

/* ─── Queries ─── */

export async function getUserById(id: string): Promise<DbUser | null> {
  const db = await getDb();
  const user = await db
    .collection<DbUser>("users")
    .findOne({ _id: new ObjectId(id) });
  return user;
}

export async function updateUser(
  userId: string,
  fields: Partial<Pick<DbUser, "name" | "password" | "phone" | "avatarUrl">>,
) {
  const db = await getDb();
  await db
    .collection<DbUser>("users")
    .updateOne({ _id: new ObjectId(userId) }, { $set: fields });
}

/* ─── Student profiles ─── */

export type DbProfile = StudentProfile & {
  _id?: ObjectId;
  userId: string;
  updatedAt: Date;
};

export async function upsertProfile(userId: string, profile: StudentProfile) {
  const db = await getDb();
  const { _id, ...safeProfile } = profile as StudentProfile & { _id?: unknown };
  void _id;
  await db.collection<DbProfile>("profiles").updateOne(
    { userId },
    { $set: { ...safeProfile, userId, updatedAt: new Date() } },
    { upsert: true },
  );
}

export async function getProfile(userId: string): Promise<DbProfile | null> {
  const db = await getDb();
  return db.collection<DbProfile>("profiles").findOne({ userId });
}

export async function recordUsage(record: LlmUsageRecord): Promise<void> {
  const db = await getDb();
  await db.collection<LlmUsageRecord & { createdAt: Date }>("llm_usage").insertOne({
    ...record,
    createdAt: new Date(),
  });
}

export type ChatRole = "user" | "assistant";
export type ChatSource = {
  label: string;
  uri: string;
  kind: "kb" | "case" | "web" | "profile" | "roadmap";
};

export type DbChatThread = {
  _id?: ObjectId;
  userId: string;
  title: string;
  createdAt: Date;
  updatedAt: Date;
  lastMessageAt: Date;
  messageCount: number;
  lastMode?: "general" | "research" | "study" | "coding";
};

export type DbChatMessage = {
  _id?: ObjectId;
  threadId: string;
  userId: string;
  role: ChatRole;
  text: string;
  sources?: ChatSource[];
  providerId?: string;
  modelId?: string;
  mode?: "general" | "research" | "study" | "coding";
  tokensIn?: number;
  tokensOut?: number;
  createdAt: Date;
};

export async function createThread(userId: string, title = "New chat"): Promise<DbChatThread> {
  const db = await getDb();
  const now = new Date();
  const doc: DbChatThread = {
    userId,
    title: title.slice(0, 120),
    createdAt: now,
    updatedAt: now,
    lastMessageAt: now,
    messageCount: 0,
  };
  const result = await db.collection<DbChatThread>("chat_threads").insertOne(doc);
  return { ...doc, _id: result.insertedId };
}

export async function listThreads(userId: string): Promise<DbChatThread[]> {
  const db = await getDb();
  return db.collection<DbChatThread>("chat_threads")
    .find({ userId }).sort({ lastMessageAt: -1 }).limit(200).toArray();
}

export async function getThread(userId: string, threadId: string): Promise<DbChatThread | null> {
  if (!ObjectId.isValid(threadId)) return null;
  const db = await getDb();
  return db.collection<DbChatThread>("chat_threads")
    .findOne({ _id: new ObjectId(threadId), userId });
}

export async function renameThread(userId: string, threadId: string, title: string): Promise<boolean> {
  if (!ObjectId.isValid(threadId)) return false;
  const db = await getDb();
  const result = await db.collection<DbChatThread>("chat_threads").updateOne(
    { _id: new ObjectId(threadId), userId },
    { $set: { title: title.slice(0, 120), updatedAt: new Date() } },
  );
  return result.matchedCount > 0;
}

export async function deleteThread(userId: string, threadId: string): Promise<void> {
  if (!ObjectId.isValid(threadId)) return;
  const db = await getDb();
  await Promise.all([
    db.collection<DbChatThread>("chat_threads").deleteOne({ _id: new ObjectId(threadId), userId }),
    db.collection<DbChatMessage>("chat_messages").deleteMany({ threadId, userId }),
  ]);
}

export async function appendMessage(
  message: Omit<DbChatMessage, "_id" | "createdAt">,
): Promise<DbChatMessage> {
  const db = await getDb();
  const doc: DbChatMessage = { ...message, createdAt: new Date() };
  const result = await db.collection<DbChatMessage>("chat_messages").insertOne(doc);
  if (ObjectId.isValid(message.threadId)) {
    await db.collection<DbChatThread>("chat_threads").updateOne(
      { _id: new ObjectId(message.threadId), userId: message.userId },
      {
        $set: { lastMessageAt: doc.createdAt, updatedAt: doc.createdAt, lastMode: message.mode },
        $inc: { messageCount: 1 },
      },
    );
  }
  return { ...doc, _id: result.insertedId };
}

export async function getMessages(userId: string, threadId: string, limit = 200): Promise<DbChatMessage[]> {
  const db = await getDb();
  return db.collection<DbChatMessage>("chat_messages")
    .find({ userId, threadId }).sort({ createdAt: 1 }).limit(limit).toArray();
}
