import { getDb } from "./mongodb";
import { ObjectId } from "mongodb";

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
