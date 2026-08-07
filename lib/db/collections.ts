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
