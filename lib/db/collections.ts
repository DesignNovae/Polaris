import { getDb } from "./mongodb";
import { ObjectId } from "mongodb";
import type { StudentProfile } from "@/lib/profile";

/* ─── Types ─── */

export type UserRole = "student" | "parent" | "partner" | "admin";
export type Plan = "free" | "pro" | "elite";

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

export async function recordUsage(usage: Omit<DbLlmUsage, "createdAt">) {
  const db = await getDb();
  await db.collection<DbLlmUsage>("llm_usage").insertOne({
    ...usage,
    createdAt: new Date(),
  });
}

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
