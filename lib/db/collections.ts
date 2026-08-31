import { getDb } from "./mongodb";
import { ObjectId } from "mongodb";
import type { StudentProfile } from "@/lib/profile";
import type { RoadmapMilestone, RoadmapResponse } from "@/lib/llm/gemma";

export type UserRole = "student" | "parent" | "partner" | "admin";
export type Plan = "free" | "pro" | "elite";

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

export type Subscription = {
  lsCustomerId?: string;
  lsSubscriptionId?: string;
  variantId?: string;
  status?: string; // active, canceled, expired, past_due, etc.
  renewsAt?: string;
  /* Sandbox-billing fields - written by /api/transactions/[id]/confirm. */
  planId?: Plan;
  billingCycle?: "monthly" | "yearly";
  startedAt?: string;
  canceledAt?: string;
  /** Minor units (cents / paisa) of the last charge. */
  priceMinor?: number;
  currency?: string;
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

export type DbProfile = StudentProfile & {
  _id?: ObjectId;
  userId: string;
  preferences?: AccountPreferences;
  updatedAt: Date;
};

export type NotificationPreferences = {
  weeklyDigest: boolean;
  deadlineReminders: boolean;
  strategistInsights: boolean;
  familyDigest: boolean;
};

export type AccountPreferences = {
  notifications?: NotificationPreferences;
  hidePartnerOffers?: boolean;
};

export type MilestoneStatus = "pending" | "in-progress" | "done";

export type DbMilestone = RoadmapMilestone & {
  id: string;
  status: MilestoneStatus;
  completedAt?: Date;
  deadline?: string;
};

export type DbRoadmap = {
  _id?: ObjectId;
  userId: string;
  roadmap: Omit<RoadmapResponse, "milestones"> & { milestones: DbMilestone[] };
  retrieved: Array<{ id: string; title: string; source: string; score: number }>;
  source: "gemma4" | "fallback";
  version: number;
  createdAt: Date;
};

function milestoneId(): string {
  return Math.random().toString(36).slice(2, 10);
}

export function toDbMilestones(milestones: RoadmapMilestone[]): DbMilestone[] {
  return milestones.map((m) => ({
    ...m,
    id: milestoneId(),
    status: "pending" as MilestoneStatus,
  }));
}

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

export async function updateAccountPreferences(
  userId: string,
  preferences: AccountPreferences,
): Promise<AccountPreferences> {
  const db = await getDb();
  const set: Record<string, unknown> = { userId, updatedAt: new Date() };
  if (preferences.notifications) {
    set["preferences.notifications"] = preferences.notifications;
  }
  if (preferences.hidePartnerOffers !== undefined) {
    set["preferences.hidePartnerOffers"] = preferences.hidePartnerOffers;
  }
  await db.collection<DbProfile>("profiles").updateOne(
    { userId },
    { $set: set },
    { upsert: true },
  );
  return (await getProfile(userId))?.preferences ?? {};
}

export async function saveRoadmap(userId: string, data: Omit<DbRoadmap, "_id" | "userId" | "version" | "createdAt">) {
  const db = await getDb();
  const existing = await db.collection<DbRoadmap>("roadmaps").findOne(
    { userId },
    { sort: { version: -1 }, projection: { version: 1 } },
  );
  const version = existing ? existing.version + 1 : 1;
  await db.collection<DbRoadmap>("roadmaps").insertOne({
    ...data,
    userId,
    version,
    createdAt: new Date(),
  });
}

export async function getLatestRoadmap(userId: string): Promise<DbRoadmap | null> {
  const db = await getDb();
  return db.collection<DbRoadmap>("roadmaps").findOne(
    { userId },
    { sort: { version: -1 } },
  );
}

export async function updateMilestoneStatus(
  userId: string,
  milestoneId: string,
  status: MilestoneStatus,
) {
  const db = await getDb();
  const update: Record<string, unknown> = {
    "roadmap.milestones.$.status": status,
  };
  if (status === "done") {
    update["roadmap.milestones.$.completedAt"] = new Date();
  }
  await db.collection<DbRoadmap>("roadmaps").updateOne(
    { userId, "roadmap.milestones.id": milestoneId },
    { $set: update },
    { sort: { version: -1 } } as any,
  );
}

export async function setMilestoneDeadline(
  userId: string,
  milestoneId: string,
  deadline: string,
) {
  const db = await getDb();
  await db.collection<DbRoadmap>("roadmaps").updateOne(
    { userId, "roadmap.milestones.id": milestoneId },
    { $set: { "roadmap.milestones.$.deadline": deadline } },
    { sort: { version: -1 } } as any,
  );
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

/* ─── Weekly tasks (granular, week-by-week roadmap) ─────────────────────── */

/**
 * One granular weekly task. The roadmap is rendered week-by-week from these,
 * each carrying a hands-on practice deliverable, user progress (0–100), a
 * notes thread, an optional work submission, and the Strategist's review
 * feedback after completion.
 */
export type WeeklyTaskNote = {
  id: string;
  author: "user" | "strategist";
  text: string;
  at: Date;
};

export type DbWeeklyTask = {
  _id?: ObjectId;
  userId: string;
  /** 1-based week index in the plan. */
  week: number;
  /** Short theme line shared by the week's tasks (e.g. "SAT diagnostics"). */
  weekTheme: string;
  /** Short random id (stable across replans for unchanged tasks). */
  id: string;
  title: string;
  /** What to do, written to the student. */
  summary: string;
  /** The hands-on exercise / deliverable that closes the task. */
  practice: string;
  category: string;
  priority: "high" | "medium" | "low";
  status: MilestoneStatus;
  /** 0–100, user-updated. Status auto-derives at 0 / 1-99 / 100. */
  progress: number;
  notes: WeeklyTaskNote[];
  /** The student's submitted work (free text / links). */
  submission?: string;
  /** Strategist's review of the submission. */
  feedback?: string;
  feedbackAt?: Date;
  source: "generated" | "replanned";
  createdAt: Date;
  updatedAt: Date;
  completedAt?: Date;
};

export function weeklyTaskId(): string {
  return Math.random().toString(36).slice(2, 10);
}

export async function listWeeklyTasks(userId: string): Promise<DbWeeklyTask[]> {
  const db = await getDb();
  return db
    .collection<DbWeeklyTask>("weekly_tasks")
    .find({ userId })
    .sort({ week: 1, priority: 1, createdAt: 1 })
    .toArray();
}

export async function getWeeklyTask(
  userId: string,
  taskId: string,
): Promise<DbWeeklyTask | null> {
  const db = await getDb();
  return db.collection<DbWeeklyTask>("weekly_tasks").findOne({ userId, id: taskId });
}

export async function insertWeeklyTasks(
  tasks: Array<Omit<DbWeeklyTask, "_id">>,
): Promise<void> {
  if (!tasks.length) return;
  const db = await getDb();
  await db.collection<DbWeeklyTask>("weekly_tasks").insertMany(tasks.map((t) => ({ ...t })));
}

/** Replace all NOT-yet-completed tasks in weeks >= fromWeek with a new set. */
export async function replaceUpcomingWeeklyTasks(
  userId: string,
  fromWeek: number,
  tasks: Array<Omit<DbWeeklyTask, "_id">>,
): Promise<void> {
  const db = await getDb();
  await db.collection<DbWeeklyTask>("weekly_tasks").deleteMany({
    userId,
    week: { $gte: fromWeek },
    status: { $ne: "done" },
  });
  if (tasks.length) {
    await db.collection<DbWeeklyTask>("weekly_tasks").insertMany(tasks.map((t) => ({ ...t })));
  }
}

export async function deleteWeeklyTasks(userId: string): Promise<void> {
  const db = await getDb();
  await db.collection<DbWeeklyTask>("weekly_tasks").deleteMany({ userId });
}

export async function updateWeeklyTask(
  userId: string,
  taskId: string,
  patch: Partial<
    Pick<DbWeeklyTask, "status" | "progress" | "submission" | "feedback" | "feedbackAt" | "completedAt">
  >,
): Promise<boolean> {
  const db = await getDb();
  const res = await db.collection<DbWeeklyTask>("weekly_tasks").updateOne(
    { userId, id: taskId },
    { $set: { ...patch, updatedAt: new Date() } },
  );
  return res.matchedCount > 0;
}

export async function addWeeklyTaskNote(
  userId: string,
  taskId: string,
  note: WeeklyTaskNote,
): Promise<boolean> {
  const db = await getDb();
  const res = await db.collection<DbWeeklyTask>("weekly_tasks").updateOne(
    { userId, id: taskId },
    {
      $push: { notes: note },
      $set: { updatedAt: new Date() },
    },
  );
  return res.matchedCount > 0;
}

/* ─── Users ─── */

export async function getUserById(userId: string): Promise<DbUser | null> {
  const db = await getDb();
  if (!ObjectId.isValid(userId)) return null;
  return db.collection<DbUser>("users").findOne({ _id: new ObjectId(userId) });
}

export async function getUserByEmail(email: string): Promise<DbUser | null> {
  const db = await getDb();
  return db.collection<DbUser>("users").findOne({ email: email.toLowerCase() });
}

export async function setUserPlan(
  userId: string,
  plan: Plan,
  subscription?: Subscription,
) {
  const db = await getDb();
  const update: Record<string, unknown> = { plan };
  if (subscription) update.subscription = subscription;
  await db
    .collection<DbUser>("users")
    .updateOne({ _id: new ObjectId(userId) }, { $set: update });
}

export async function setUserRole(userId: string, role: UserRole) {
  const db = await getDb();
  await db
    .collection<DbUser>("users")
    .updateOne({ _id: new ObjectId(userId) }, { $set: { role } });
}

/** Update mutable account fields (name / password hash / phone / avatarUrl). */
export async function updateUser(
  userId: string,
  fields: Partial<Pick<DbUser, "name" | "password" | "phone" | "avatarUrl">>,
) {
  const db = await getDb();
  await db
    .collection<DbUser>("users")
    .updateOne({ _id: new ObjectId(userId) }, { $set: fields });
}

/* ─── Transactions (simulated payment ledger) ──────────────────────── */

export type PaymentMethod = "card" | "bkash" | "nagad" | "rocket";
export type TransactionStatus = "pending" | "processing" | "succeeded" | "failed" | "refunded";

export type DbTransaction = {
  _id?: ObjectId;
  userId: string;
  /** Human-readable id we show to the user (POL-XXXX-XXXX). */
  reference: string;
  method: PaymentMethod;
  /** Amount in minor units (cents / paisa) for accuracy. */
  amount: number;
  /** ISO currency. We default to USD; BDT for bKash/Nagad/Rocket. */
  currency: string;
  /** "Polaris Pro (annual)" etc. */
  description: string;
  status: TransactionStatus;
  /** Last-4 digits for card; phone tail for mobile wallet. */
  maskedAccount?: string;
  /** Card brand (visa, mastercard, amex), set only for card. */
  cardBrand?: string;
  /** Reason if failed. */
  failureReason?: string;
  createdAt: Date;
  updatedAt: Date;
};

function makeReference(): string {
  const seg = () => Math.floor(Math.random() * 9000 + 1000).toString();
  return `POL-${seg()}-${seg()}`;
}

export async function createTransaction(
  row: Omit<DbTransaction, "_id" | "reference" | "status" | "createdAt" | "updatedAt">,
): Promise<DbTransaction> {
  const db = await getDb();
  const now = new Date();
  const doc: DbTransaction = {
    ...row,
    reference: makeReference(),
    status: "pending",
    createdAt: now,
    updatedAt: now,
  };
  const res = await db.collection<DbTransaction>("transactions").insertOne(doc);
  return { ...doc, _id: res.insertedId };
}

export async function setTransactionStatus(
  userId: string,
  txId: string,
  status: TransactionStatus,
  failureReason?: string,
): Promise<DbTransaction | null> {
  if (!ObjectId.isValid(txId)) return null;
  const db = await getDb();
  const now = new Date();
  const update: Record<string, unknown> = { status, updatedAt: now };
  if (failureReason) update.failureReason = failureReason;
  await db
    .collection<DbTransaction>("transactions")
    .updateOne({ _id: new ObjectId(txId), userId }, { $set: update });
  return db
    .collection<DbTransaction>("transactions")
    .findOne({ _id: new ObjectId(txId), userId });
}

export async function listTransactions(userId: string, limit = 100): Promise<DbTransaction[]> {
  const db = await getDb();
  return db
    .collection<DbTransaction>("transactions")
    .find({ userId })
    .sort({ createdAt: -1 })
    .limit(limit)
    .toArray();
}

export async function getTransaction(userId: string, txId: string): Promise<DbTransaction | null> {
  if (!ObjectId.isValid(txId)) return null;
  const db = await getDb();
  return db
    .collection<DbTransaction>("transactions")
    .findOne({ _id: new ObjectId(txId), userId });
}

/* Strategist chat threads and message history. */

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
  /** Number of messages currently saved on this thread. */
  messageCount: number;
  /** Last mode used on this thread - informational. */
  lastMode?: "general" | "research" | "study" | "coding";
};

export type DbChatMessage = {
  _id?: ObjectId;
  threadId: string;
  userId: string;
  role: ChatRole;
  text: string;
  sources?: ChatSource[];
  /** Provider + model that generated this message (assistant only). */
  providerId?: string;
  modelId?: string;
  mode?: "general" | "research" | "study" | "coding";
  tokensIn?: number;
  tokensOut?: number;
  createdAt: Date;
};

export async function createThread(
  userId: string,
  title = "New chat",
): Promise<DbChatThread> {
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
  const res = await db.collection<DbChatThread>("chat_threads").insertOne(doc);
  return { ...doc, _id: res.insertedId };
}

export async function listThreads(userId: string): Promise<DbChatThread[]> {
  const db = await getDb();
  return db
    .collection<DbChatThread>("chat_threads")
    .find({ userId })
    .sort({ lastMessageAt: -1 })
    .limit(200)
    .toArray();
}

export async function getThread(
  userId: string,
  threadId: string,
): Promise<DbChatThread | null> {
  if (!ObjectId.isValid(threadId)) return null;
  const db = await getDb();
  return db
    .collection<DbChatThread>("chat_threads")
    .findOne({ _id: new ObjectId(threadId), userId });
}

export async function renameThread(
  userId: string,
  threadId: string,
  title: string,
): Promise<boolean> {
  if (!ObjectId.isValid(threadId)) return false;
  const db = await getDb();
  const res = await db
    .collection<DbChatThread>("chat_threads")
    .updateOne(
      { _id: new ObjectId(threadId), userId },
      { $set: { title: title.slice(0, 120), updatedAt: new Date() } },
    );
  return res.matchedCount > 0;
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
  msg: Omit<DbChatMessage, "_id" | "createdAt">,
): Promise<DbChatMessage> {
  const db = await getDb();
  const now = new Date();
  const doc: DbChatMessage = { ...msg, createdAt: now };
  const res = await db.collection<DbChatMessage>("chat_messages").insertOne(doc);
  // Bump the parent thread's lastMessageAt + messageCount.
  if (ObjectId.isValid(msg.threadId)) {
    await db.collection<DbChatThread>("chat_threads").updateOne(
      { _id: new ObjectId(msg.threadId), userId: msg.userId },
      {
        $set: { lastMessageAt: now, updatedAt: now, lastMode: msg.mode },
        $inc: { messageCount: 1 },
      },
    );
  }
  return { ...doc, _id: res.insertedId };
}

export async function getMessages(
  userId: string,
  threadId: string,
  limit = 200,
): Promise<DbChatMessage[]> {
  const db = await getDb();
  return db
    .collection<DbChatMessage>("chat_messages")
    .find({ userId, threadId })
    .sort({ createdAt: 1 })
    .limit(limit)
    .toArray();
}

/* ─── Strategist long-term memory ───────────────────────────────────────── */

/**
 * Durable facts the Strategist has learned about a single student across
 * conversations. Stored as an inline `facts` array on a single document per
 * user (keeps reads cheap - most users will have <100 facts).
 *
 * Source: "explicit" means the user typed/edited it themselves; "inferred"
 * means the LLM extracted it from a conversation. Confidence lets us decay
 * or rank uncertain inferred facts later.
 */
export type MemoryFactCategory =
  | "goal"
  | "preference"
  | "constraint"
  | "background"
  | "interest";

export type UserMemoryFact = {
  id: string;
  text: string;
  category: MemoryFactCategory;
  confidence: number; // 0..1
  source: "explicit" | "inferred";
  createdAt: Date;
};

export type DbUserMemory = {
  _id?: ObjectId;
  userId: string;
  facts: UserMemoryFact[];
  updatedAt: Date;
};

/** Reads everything Polaris remembers about a single student. */
export async function getUserMemory(userId: string): Promise<DbUserMemory | null> {
  const db = await getDb();
  return db.collection<DbUserMemory>("user_memory").findOne({ userId });
}

/**
 * Appends new facts. Dedupes against existing rows by lowercased text so the
 * memory store never accumulates obvious duplicates (the LLM extractor is
 * separately responsible for higher-order semantic dedup).
 */
export async function addMemoryFacts(
  userId: string,
  facts: UserMemoryFact[],
): Promise<UserMemoryFact[]> {
  if (facts.length === 0) return [];
  const existing = await getUserMemory(userId);
  const known = new Set((existing?.facts ?? []).map((f) => f.text.trim().toLowerCase()));
  const fresh = facts.filter((f) => {
    const key = f.text.trim().toLowerCase();
    if (key.length < 4 || known.has(key)) return false;
    known.add(key);
    return true;
  });
  if (fresh.length === 0) return [];
  const db = await getDb();
  await db.collection<DbUserMemory>("user_memory").updateOne(
    { userId },
    {
      $push: { facts: { $each: fresh } },
      $set: { updatedAt: new Date() },
      $setOnInsert: { userId },
    },
    { upsert: true },
  );
  return fresh;
}

/** Removes a single fact by id (user-initiated forget). */
export async function deleteMemoryFact(
  userId: string,
  factId: string,
): Promise<void> {
  const db = await getDb();
  await db
    .collection<DbUserMemory>("user_memory")
    .updateOne(
      { userId },
      { $pull: { facts: { id: factId } }, $set: { updatedAt: new Date() } },
    );
}

/** Wipes every learned fact for a user (privacy / fresh start). */
export async function clearMemory(userId: string): Promise<void> {
  const db = await getDb();
  await db
    .collection<DbUserMemory>("user_memory")
    .updateOne(
      { userId },
      { $set: { facts: [], updatedAt: new Date() } },
      { upsert: true },
    );
}

/* ─── LLM usage telemetry ────────────────────────────────────────────── */

export type LlmUsageRow = {
  _id?: ObjectId;
  userId: string;
  providerId: string;
  modelId: string;
  tier: "free" | "paid" | "local";
  mode: "general" | "research" | "study" | "coding";
  tokensIn: number;
  tokensOut: number;
  latencyMs: number;
  /** True when the orchestrator had to fall back from the initial pick. */
  fallback: boolean;
  /** "ok" | "error" - high-level outcome. */
  outcome: "ok" | "error";
  errorCode?: string;
  createdAt: Date;
};

export async function recordUsage(row: Omit<LlmUsageRow, "_id" | "createdAt">) {
  try {
    const db = await getDb();
    await db.collection<LlmUsageRow>("llm_usage").insertOne({
      ...row,
      createdAt: new Date(),
    });
  } catch (err) {
    // Telemetry is best-effort - never crash a chat over it.
    console.error("[usage] insert failed:", err);
  }
}

export type UsageSummary = {
  totalCalls: number;
  totalTokensIn: number;
  totalTokensOut: number;
  byProvider: Array<{
    providerId: string;
    modelId: string;
    tier: "free" | "paid" | "local";
    calls: number;
    tokensIn: number;
    tokensOut: number;
    avgLatencyMs: number;
    errors: number;
  }>;
  recent: Array<Pick<
    LlmUsageRow,
    "providerId" | "modelId" | "mode" | "tokensIn" | "tokensOut" | "latencyMs" | "outcome" | "fallback" | "createdAt"
  >>;
};

/** Summarize the last N days of usage for a single user. */
export async function getUsageSummary(
  userId: string,
  sinceDays = 30,
): Promise<UsageSummary> {
  const db = await getDb();
  const since = new Date(Date.now() - sinceDays * 24 * 60 * 60 * 1000);

  const rows = await db
    .collection<LlmUsageRow>("llm_usage")
    .find({ userId, createdAt: { $gte: since } })
    .sort({ createdAt: -1 })
    .limit(2000)
    .toArray();

  const totalCalls = rows.length;
  const totalTokensIn = rows.reduce((s, r) => s + (r.tokensIn ?? 0), 0);
  const totalTokensOut = rows.reduce((s, r) => s + (r.tokensOut ?? 0), 0);

  const groups = new Map<
    string,
    UsageSummary["byProvider"][number]
  >();
  for (const r of rows) {
    const key = `${r.providerId}::${r.modelId}`;
    const g = groups.get(key) ?? {
      providerId: r.providerId,
      modelId: r.modelId,
      tier: r.tier,
      calls: 0,
      tokensIn: 0,
      tokensOut: 0,
      avgLatencyMs: 0,
      errors: 0,
    };
    g.calls += 1;
    g.tokensIn += r.tokensIn ?? 0;
    g.tokensOut += r.tokensOut ?? 0;
    g.avgLatencyMs += r.latencyMs ?? 0;
    if (r.outcome === "error") g.errors += 1;
    groups.set(key, g);
  }
  for (const g of groups.values()) {
    g.avgLatencyMs = g.calls ? Math.round(g.avgLatencyMs / g.calls) : 0;
  }
  const byProvider = [...groups.values()].sort((a, b) => b.calls - a.calls);

  const recent = rows.slice(0, 25).map((r) => ({
    providerId: r.providerId,
    modelId: r.modelId,
    mode: r.mode,
    tokensIn: r.tokensIn,
    tokensOut: r.tokensOut,
    latencyMs: r.latencyMs,
    outcome: r.outcome,
    fallback: r.fallback,
    createdAt: r.createdAt,
  }));

  return { totalCalls, totalTokensIn, totalTokensOut, byProvider, recent };
}

/** Find a user by their LemonSqueezy subscription id (for update/cancel webhooks). */
export async function getUserBySubscriptionId(
  lsSubscriptionId: string,
): Promise<DbUser | null> {
  const db = await getDb();
  return db
    .collection<DbUser>("users")
    .findOne({ "subscription.lsSubscriptionId": lsSubscriptionId });
}

/* ─── Admin ─── */

export type AdminUserRow = {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  plan: Plan;
  createdAt: Date;
};

export async function listUsers(): Promise<AdminUserRow[]> {
  const db = await getDb();
  const users = await db
    .collection<DbUser>("users")
    .find({}, { projection: { password: 0 } })
    .sort({ createdAt: -1 })
    .toArray();
  return users.map((u) => ({
    id: u._id!.toString(),
    name: u.name,
    email: u.email,
    role: u.role ?? "student",
    plan: u.plan ?? "free",
    createdAt: u.createdAt,
  }));
}

/** Delete a user and all their associated data. */
export async function deleteUserCascade(userId: string) {
  const db = await getDb();
  if (!ObjectId.isValid(userId)) return;
  await Promise.all([
    db.collection("users").deleteOne({ _id: new ObjectId(userId) }),
    db.collection("profiles").deleteMany({ userId }),
    db.collection("roadmaps").deleteMany({ userId }),
    db.collection("links").deleteMany({ studentId: userId }),
    db.collection("user_memory").deleteMany({ userId }),
    // Per-student retrieval index (lib/rag) - deleted with the account.
    db.collection("user_chunks").deleteMany({ userId }),
    db.collection("llm_usage").deleteMany({ userId }),
    db.collection("chat_threads").deleteMany({ userId }),
    db.collection("chat_messages").deleteMany({ userId }),
    db.collection("transactions").deleteMany({ userId }),
  ]);
}

export async function getPlatformStats() {
  const db = await getDb();
  const users = db.collection<DbUser>("users");
  const [
    totalUsers,
    free,
    pro,
    elite,
    students,
    parents,
    partners,
    admins,
    roadmaps,
    links,
    profiles,
  ] = await Promise.all([
    users.countDocuments({}),
    users.countDocuments({ plan: "free" }),
    users.countDocuments({ plan: "pro" }),
    users.countDocuments({ plan: "elite" }),
    users.countDocuments({ role: "student" }),
    users.countDocuments({ role: "parent" }),
    users.countDocuments({ role: "partner" }),
    users.countDocuments({ role: "admin" }),
    db.collection("roadmaps").countDocuments({}),
    db.collection("links").countDocuments({}),
    db.collection("profiles").countDocuments({}),
  ]);
  return {
    totalUsers,
    plans: { free, pro, elite },
    roles: { student: students, parent: parents, partner: partners, admin: admins },
    roadmaps,
    links,
    profiles,
  };
}

export type AdminRoadmapRow = {
  id: string;
  userId: string;
  userEmail: string;
  version: number;
  source: string;
  milestones: number;
  done: number;
  summary: string;
  createdAt: Date;
};

export async function listRoadmaps(): Promise<AdminRoadmapRow[]> {
  const db = await getDb();
  const roadmaps = await db
    .collection<DbRoadmap>("roadmaps")
    .find({})
    .sort({ createdAt: -1 })
    .limit(200)
    .toArray();

  // Resolve emails in one batch.
  const userIds = [...new Set(roadmaps.map((r) => r.userId))].filter((id) =>
    ObjectId.isValid(id),
  );
  const users = await db
    .collection<DbUser>("users")
    .find(
      { _id: { $in: userIds.map((id) => new ObjectId(id)) } },
      { projection: { email: 1 } },
    )
    .toArray();
  const emailById = new Map(users.map((u) => [u._id!.toString(), u.email]));

  return roadmaps.map((r) => ({
    id: r._id!.toString(),
    userId: r.userId,
    userEmail: emailById.get(r.userId) ?? "(unknown)",
    version: r.version,
    source: r.source,
    milestones: r.roadmap.milestones.length,
    done: r.roadmap.milestones.filter((m) => m.status === "done").length,
    summary: r.roadmap.summary,
    createdAt: r.createdAt,
  }));
}

export async function deleteRoadmap(roadmapId: string) {
  const db = await getDb();
  if (!ObjectId.isValid(roadmapId)) return;
  await db.collection("roadmaps").deleteOne({ _id: new ObjectId(roadmapId) });
}

/* ─── Parent/partner links ─── */

export type LinkRelationship = "parent" | "partner";
export type LinkStatus = "pending" | "accepted";

export type DbLink = {
  _id?: ObjectId;
  studentId: string;
  studentName?: string;
  viewerEmail: string;
  viewerId?: string;
  relationship: LinkRelationship;
  status: LinkStatus;
  inviteToken: string;
  createdAt: Date;
  acceptedAt?: Date;
};

function token(): string {
  return (
    Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2)
  );
}

export async function createLink(
  studentId: string,
  studentName: string | undefined,
  viewerEmail: string,
  relationship: LinkRelationship,
): Promise<DbLink> {
  const db = await getDb();
  const link: DbLink = {
    studentId,
    studentName,
    viewerEmail: viewerEmail.toLowerCase(),
    relationship,
    status: "pending",
    inviteToken: token(),
    createdAt: new Date(),
  };
  await db.collection<DbLink>("links").insertOne(link);
  return link;
}

export async function getLinksForStudent(studentId: string): Promise<DbLink[]> {
  const db = await getDb();
  return db.collection<DbLink>("links").find({ studentId }).toArray();
}

/** Accepted links where this user is the viewer (parent/partner side). */
export async function getLinksForViewer(
  viewerEmail: string,
): Promise<DbLink[]> {
  const db = await getDb();
  return db
    .collection<DbLink>("links")
    .find({ viewerEmail: viewerEmail.toLowerCase(), status: "accepted" })
    .toArray();
}

export async function acceptLink(
  inviteToken: string,
  viewerId: string,
  viewerEmail: string,
): Promise<boolean> {
  const db = await getDb();
  const res = await db.collection<DbLink>("links").updateOne(
    { inviteToken, viewerEmail: viewerEmail.toLowerCase(), status: "pending" },
    { $set: { status: "accepted", viewerId, acceptedAt: new Date() } },
  );
  return res.modifiedCount > 0;
}

/** Revoke an invite. Scoped to the owning student so a user can only delete their own. */
export async function deleteLink(studentId: string, linkId: string): Promise<void> {
  if (!ObjectId.isValid(linkId)) return;
  const db = await getDb();
  await db
    .collection<DbLink>("links")
    .deleteOne({ _id: new ObjectId(linkId), studentId });
}

export async function updateLinkRelationship(
  studentId: string,
  linkId: string,
  relationship: LinkRelationship,
): Promise<boolean> {
  if (!ObjectId.isValid(linkId)) return false;
  const db = await getDb();
  const result = await db.collection<DbLink>("links").updateOne(
    { _id: new ObjectId(linkId), studentId },
    { $set: { relationship } },
  );
  return result.matchedCount > 0;
}

/* ─── Mock Questions (AI-generated question bank) ─── */

export type DbMockQuestion = {
  _id?: ObjectId;
  id: string;
  fingerprint: string;
  exam: "IELTS" | "SAT";
  section: string;
  skill: string;
  passage?: string;
  prompt: string;
  options: string[];
  answer: number;
  explanation: string;
  difficulty: "Foundation" | "Medium" | "Advanced";
  source: "gemma4" | "deterministic-fallback" | "question-bank";
  model: string;
  qualityVersion: number;
  servedCount: number;
  status: "active" | "retired";
  createdAt: Date;
  updatedAt: Date;
};

function questionFingerprint(q: { prompt: string; options: string[] }): string {
  const raw = q.prompt + q.options.join("");
  let hash = 0;
  for (let i = 0; i < raw.length; i++) {
    hash = ((hash << 5) - hash + raw.charCodeAt(i)) | 0;
  }
  return Math.abs(hash).toString(16).padStart(8, "0");
}

export async function saveMockQuestions(
  questions: Array<Omit<DbMockQuestion, "_id" | "fingerprint" | "servedCount" | "status" | "qualityVersion" | "createdAt" | "updatedAt">>,
): Promise<DbMockQuestion[]> {
  const db = await getDb();
  const col = db.collection<DbMockQuestion>("mock_questions");
  const now = new Date();
  const docs: DbMockQuestion[] = questions.map((q) => ({
    ...q,
    fingerprint: questionFingerprint(q),
    qualityVersion: 1,
    servedCount: 0,
    status: "active" as const,
    createdAt: now,
    updatedAt: now,
  }));
  // Skip duplicates by fingerprint
  const existing = await col.find({
    fingerprint: { $in: docs.map((d) => d.fingerprint) },
  }).toArray();
  const existingFps = new Set(existing.map((e) => e.fingerprint));
  const newDocs = docs.filter((d) => !existingFps.has(d.fingerprint));
  if (newDocs.length) await col.insertMany(newDocs);
  return docs;
}

/* ─── Mock Attempts (user exam submissions) ─── */

export type DbMockAttempt = {
  _id?: ObjectId;
  userId: string;
  exam: "IELTS" | "SAT";
  section: string;
  difficulty: "Foundation" | "Medium" | "Advanced";
  questionIds: string[];
  answers: Record<string, number>;
  score: number;
  total: number;
  feedback: string;
  source: "gemma4" | "deterministic-fallback";
  model: string;
  createdAt: Date;
};

export async function saveMockAttempt(
  attempt: Omit<DbMockAttempt, "_id" | "createdAt">,
): Promise<DbMockAttempt> {
  const db = await getDb();
  const doc: DbMockAttempt = { ...attempt, createdAt: new Date() };
  const result = await db.collection<DbMockAttempt>("mock_attempts").insertOne(doc);
  return { ...doc, _id: result.insertedId };
}

export async function listMockAttempts(userId: string, limit = 50): Promise<DbMockAttempt[]> {
  const db = await getDb();
  return db.collection<DbMockAttempt>("mock_attempts")
    .find({ userId }).sort({ createdAt: -1 }).limit(limit).toArray();
}

/* ─── Monitor invitations (new viewer dashboard) ─── */

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
  return db.collection<DbMonitorInvite>("monitorInvites").find({ studentId }).sort({ createdAt: -1 }).toArray();
}

export async function getMonitorInviteByStudentAndEmail(studentId: string, email: string): Promise<DbMonitorInvite | null> {
  const db = await getDb();
  return db.collection<DbMonitorInvite>("monitorInvites").findOne({ studentId, email: email.toLowerCase() });
}

export async function getMonitorInviteByToken(tokenValue: string): Promise<DbMonitorInvite | null> {
  const db = await getDb();
  return db.collection<DbMonitorInvite>("monitorInvites").findOne({ token: tokenValue });
}

export async function acceptMonitorInvite(
  tokenValue: string,
  viewerId: string,
  acceptedEmail: string,
): Promise<DbMonitorInvite | null> {
  const db = await getDb();
  const result = await db.collection<DbMonitorInvite>("monitorInvites").updateOne(
    { token: tokenValue, acceptedAt: { $exists: false } },
    { $set: { acceptedAt: new Date(), viewerId, acceptedEmail: acceptedEmail.toLowerCase() } },
  );
  if (result.matchedCount === 0) return null;
  return db.collection<DbMonitorInvite>("monitorInvites").findOne({ token: tokenValue });
}

export async function getMonitorConnectionsForViewer(viewerId: string): Promise<DbMonitorInvite[]> {
  const db = await getDb();
  return db.collection<DbMonitorInvite>("monitorInvites")
    .find({ viewerId, acceptedAt: { $exists: true } })
    .sort({ acceptedAt: -1 })
    .toArray();
}
