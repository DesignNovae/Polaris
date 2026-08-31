/**
 * Task service - server-only helpers that wrap the existing roadmap
 * collection. All mutations go through here so we get a single audit-log
 * surface and consistent caching invalidation.
 */

import {
  getLatestRoadmap,
  updateMilestoneStatus,
  setMilestoneDeadline,
  type DbMilestone,
  type MilestoneStatus,
} from "@/lib/db/collections";
import { getDb } from "@/lib/db/mongodb";
import { revalidatePath } from "next/cache";
import type { TaskPatch } from "./schema";

export type TaskAudit = {
  userId: string;
  milestoneId: string;
  field: "status" | "deadline" | "note";
  value: string;
  at: Date;
};

async function audit(entry: TaskAudit) {
  const db = await getDb();
  await db.collection<TaskAudit>("task_audit").insertOne(entry);
}

export async function listMilestones(userId: string): Promise<DbMilestone[]> {
  const rm = await getLatestRoadmap(userId);
  return rm?.roadmap.milestones ?? [];
}

export async function applyTaskPatch(
  userId: string,
  milestoneId: string,
  patch: TaskPatch,
): Promise<void> {
  const promises: Promise<unknown>[] = [];

  if (patch.status) {
    promises.push(updateMilestoneStatus(userId, milestoneId, patch.status));
    promises.push(audit({ userId, milestoneId, field: "status", value: patch.status, at: new Date() }));
  }
  if (patch.deadline) {
    promises.push(setMilestoneDeadline(userId, milestoneId, patch.deadline));
    promises.push(audit({ userId, milestoneId, field: "deadline", value: patch.deadline, at: new Date() }));
  }
  if (patch.note) {
    promises.push(audit({ userId, milestoneId, field: "note", value: patch.note, at: new Date() }));
  }
  await Promise.all(promises);

  // Invalidate the server-rendered roadmap.
  revalidatePath("/roadmap");
}

/** Strategist-side helper: how many milestones are closed vs. open. */
export function summarizeMilestoneProgress(ms: DbMilestone[]) {
  const total = ms.length;
  const done = ms.filter(m => m.status === "done").length;
  const inProgress = ms.filter(m => m.status === "in-progress").length;
  return { total, done, inProgress, openHigh: ms.filter(m => m.status !== "done" && m.priority === "high").length };
}

export type { MilestoneStatus, DbMilestone };

