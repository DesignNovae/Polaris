import { getDb } from "./mongodb";
import { ObjectId } from "mongodb";
import type { StudentProfile } from "@/lib/profile";

/* ─── Types ─── */

export type UserRole = "student" | "parent" | "partner" | "admin";
export type Plan = "free" | "pro" | "elite";

export type Subscription = {
  status?: string;
  planId?: Plan;
  billingCycle?: "monthly" | "yearly";
  startedAt?: string;
  renewsAt?: string;
  canceledAt?: string;
  priceMinor?: number;
  currency?: string;
};

export type LlmUsageRecord = {
  createdAt?: Date;
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
  subscription?: Subscription;
  /* Optional contact + avatar (editable from /account). */
  phone?: string;
  avatarUrl?: string;
  createdAt: Date;
};

export type ViewerRole = "parent" | "partner";

export type DbMonitorInvite = {
  _id?: ObjectId;
  token: string;
  email: string;
  role: ViewerRole;
  studentId: string;
  studentName: string;
  createdAt: Date;
  expiresAt: Date;
  acceptedAt?: Date;
  viewerId?: string;
  acceptedEmail?: string;
};

export type DbLlmUsage = {
  _id?: ObjectId;
  userId: string;
  providerId: string;
  modelId: string;
  tier: string;
  mode: string;
  tokensIn: number;
  tokensOut: number;
  latencyMs: number;
  fallback: boolean;
  outcome: "ok" | "error";
  errorCode?: string;
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

export async function setUserPlan(
  userId: string,
  plan: Plan,
  subscription?: Subscription,
): Promise<void> {
  const db = await getDb();
  const fields: Record<string, unknown> = { plan };
  if (subscription) fields.subscription = subscription;
  await db.collection<DbUser>("users").updateOne(
    { _id: new ObjectId(userId) },
    { $set: fields },
  );
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

export async function createMonitorInvite(
  studentId: string,
  studentName: string,
  email: string,
  role: ViewerRole,
): Promise<DbMonitorInvite> {
  const db = await getDb();
  const invite: DbMonitorInvite = {
    token: crypto.randomUUID(),
    email: email.toLowerCase(),
    role,
    studentId,
    studentName,
    createdAt: new Date(),
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
  };
  await db.collection<DbMonitorInvite>("monitorInvites").insertOne(invite);
  return invite;
}

export async function getMonitorInvitesByStudent(studentId: string): Promise<DbMonitorInvite[]> {
  const db = await getDb();
  return db
    .collection<DbMonitorInvite>("monitorInvites")
    .find({ studentId })
    .sort({ createdAt: -1 })
    .toArray();
}

export async function getMonitorInviteByStudentAndEmail(
  studentId: string,
  email: string,
): Promise<DbMonitorInvite | null> {
  const db = await getDb();
  return db
    .collection<DbMonitorInvite>("monitorInvites")
    .findOne({ studentId, email: email.toLowerCase() });
}

export async function getMonitorInviteByToken(token: string): Promise<DbMonitorInvite | null> {
  const db = await getDb();
  return db.collection<DbMonitorInvite>("monitorInvites").findOne({ token });
}

export async function acceptMonitorInvite(
  token: string,
  viewerId: string,
  acceptedEmail: string,
): Promise<DbMonitorInvite | null> {
  const db = await getDb();
  const update = await db
    .collection<DbMonitorInvite>("monitorInvites")
    .updateOne(
      { token, acceptedAt: { $exists: false } },
      {
        $set: {
          acceptedAt: new Date(),
          viewerId,
          acceptedEmail: acceptedEmail.toLowerCase(),
        },
      },
    );

  if (update.matchedCount === 0) {
    return null;
  }

  return db.collection<DbMonitorInvite>("monitorInvites").findOne({ token });
}

export async function getMonitorConnectionsForViewer(
  viewerId: string,
): Promise<DbMonitorInvite[]> {
  const db = await getDb();
  return db
    .collection<DbMonitorInvite>("monitorInvites")
    .find({ viewerId, acceptedAt: { $exists: true } })
    .sort({ acceptedAt: -1 })
    .toArray();
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

/* ─── Roadmap v2 (tree / skill-map) ─────────────────────────────────────── */

import type { RoadmapDoc } from "@/lib/roadmap/types";

export type DbRoadmapV2 = {
  _id?: ObjectId;
  userId: string;
  doc: RoadmapDoc;
  updatedAt: Date;
};

/** One live roadmap per user - replaced wholesale on every mutation. */
export async function getRoadmapV2(userId: string): Promise<RoadmapDoc | null> {
  const db = await getDb();
  const row = await db.collection<DbRoadmapV2>("roadmaps_v2").findOne({ userId });
  return row?.doc ?? null;
}

export async function saveRoadmapV2(userId: string, doc: RoadmapDoc): Promise<void> {
  const db = await getDb();
  await db.collection<DbRoadmapV2>("roadmaps_v2").updateOne(
    { userId },
    { $set: { doc, updatedAt: new Date() } },
    { upsert: true },
  );
}

export async function deleteRoadmapV2(userId: string): Promise<void> {
  const db = await getDb();
  await db.collection<DbRoadmapV2>("roadmaps_v2").deleteOne({ userId });
}

/* ─── Transactions (sandbox payment ledger) ───────────────────────────── */

export type PaymentMethod = "card" | "bkash" | "nagad" | "rocket";
export type TransactionStatus = "pending" | "processing" | "succeeded" | "failed" | "refunded";

export type DbTransaction = {
  _id?: ObjectId;
  userId: string;
  reference: string;
  method: PaymentMethod;
  amount: number;
  currency: string;
  description: string;
  status: TransactionStatus;
  maskedAccount?: string;
  cardBrand?: string;
  failureReason?: string;
  createdAt: Date;
  updatedAt: Date;
};

function makeTransactionReference(): string {
  const segment = () => Math.floor(Math.random() * 9000 + 1000).toString();
  return `POL-${segment()}-${segment()}`;
}

export async function createTransaction(
  row: Omit<DbTransaction, "_id" | "reference" | "status" | "createdAt" | "updatedAt">,
): Promise<DbTransaction> {
  const db = await getDb();
  const now = new Date();
  const doc: DbTransaction = {
    ...row,
    reference: makeTransactionReference(),
    status: "pending",
    createdAt: now,
    updatedAt: now,
  };
  const result = await db.collection<DbTransaction>("transactions").insertOne(doc);
  return { ...doc, _id: result.insertedId };
}

export async function setTransactionStatus(
  userId: string,
  transactionId: string,
  status: TransactionStatus,
  failureReason?: string,
): Promise<DbTransaction | null> {
  if (!ObjectId.isValid(transactionId)) return null;
  const db = await getDb();
  const update: Record<string, unknown> = { status, updatedAt: new Date() };
  if (failureReason) update.failureReason = failureReason;
  await db.collection<DbTransaction>("transactions").updateOne(
    { _id: new ObjectId(transactionId), userId },
    { $set: update },
  );
  return db.collection<DbTransaction>("transactions").findOne({
    _id: new ObjectId(transactionId),
    userId,
  });
}

export async function listTransactions(userId: string, limit = 100): Promise<DbTransaction[]> {
  const db = await getDb();
  return db.collection<DbTransaction>("transactions")
    .find({ userId })
    .sort({ createdAt: -1 })
    .limit(limit)
    .toArray();
}

export async function getTransaction(userId: string, transactionId: string): Promise<DbTransaction | null> {
  if (!ObjectId.isValid(transactionId)) return null;
  const db = await getDb();
  return db.collection<DbTransaction>("transactions").findOne({
    _id: new ObjectId(transactionId),
    userId,
  });
}

/* ─── Strategist chat history ─────────────────────────────────────────── */
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
    .find({ userId })
    .sort({ lastMessageAt: -1 })
    .limit(200)
    .toArray();
}

export async function getThread(userId: string, threadId: string): Promise<DbChatThread | null> {
  if (!ObjectId.isValid(threadId)) return null;
  const db = await getDb();
  return db.collection<DbChatThread>("chat_threads").findOne({
    _id: new ObjectId(threadId),
    userId,
  });
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
  const now = new Date();
  const doc: DbChatMessage = { ...message, createdAt: now };
  const result = await db.collection<DbChatMessage>("chat_messages").insertOne(doc);
  if (ObjectId.isValid(message.threadId)) {
    await db.collection<DbChatThread>("chat_threads").updateOne(
      { _id: new ObjectId(message.threadId), userId: message.userId },
      {
        $set: { lastMessageAt: now, updatedAt: now, lastMode: message.mode },
        $inc: { messageCount: 1 },
      },
    );
  }
  return { ...doc, _id: result.insertedId };
}

export async function getMessages(userId: string, threadId: string, limit = 200): Promise<DbChatMessage[]> {
  const db = await getDb();
  return db.collection<DbChatMessage>("chat_messages")
    .find({ userId, threadId })
    .sort({ createdAt: 1 })
    .limit(limit)
    .toArray();
}

/* ─── LLM telemetry ─── */
export async function recordUsage(opts: LlmUsageRecord & { createdAt?: Date }): Promise<void> {
  try {
    const db = await getDb();
    await db.collection<LlmUsageRecord & { createdAt: Date }>("llm_usage").insertOne({
      ...opts,
      createdAt: opts.createdAt ?? new Date(),
    });
  } catch {
    // Usage logging is best-effort and must never break a user request.
  }
}
