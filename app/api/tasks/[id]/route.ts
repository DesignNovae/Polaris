/**
 * PATCH /api/tasks/[id]
 *
 * Update a single milestone (status, deadline, note). Server-side authz
 * (only the owning student) and Zod validation. Returns 204 on success.
 *
 * DELETE - currently disabled. Roadmap milestones are immutable; the
 * Strategist proposes new versions through the replan flow.
 */

import { NextResponse } from "next/server";
import { requireSession } from "@/lib/authz";
import { withErrorHandling, parseJson, HttpError } from "@/lib/api/respond";
import { TaskIdSchema, TaskPatchSchema } from "@/lib/tasks/schema";
import { applyTaskPatch, listMilestones } from "@/lib/tasks/service";

export const runtime = "nodejs";

export const PATCH = withErrorHandling(async (req, ctx) => {
  const user = await requireSession();
  // Next.js 15 - params is a Promise.
  const { id } = await (ctx as { params: Promise<{ id: string }> }).params;
  const milestoneId = TaskIdSchema.parse(id);

  const body = TaskPatchSchema.parse(await parseJson(req));

  // Confirm ownership before mutating - the task must belong to this user's
  // current roadmap. listMilestones() reads only this user's documents.
  const owned = await listMilestones(user.id);
  if (!owned.some(m => m.id === milestoneId)) {
    throw new HttpError(404, "Task not found");
  }

  await applyTaskPatch(user.id, milestoneId, body);
  return new NextResponse(null, { status: 204 });
});

