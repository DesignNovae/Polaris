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

/* ─── Telemetry (Mock) ─── */
export async function recordUsage(_opts: unknown) {
  // Mocked until full telemetry implementation
}
