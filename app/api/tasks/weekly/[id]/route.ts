/**
 * PATCH /api/tasks/weekly/[id]
 *
 * Update a weekly task: progress (0–100), status, work submission, or
 * append a note. When the patch completes the task (status "done" or
 * progress 100), the Strategist reviews the submission + notes and writes
 * feedback onto the task before the response returns - so the UI can show
 * the review immediately.
 */

import { z } from "zod";
import { ok, fail, withErrorHandling, parseJson } from "@/lib/api/respond";
import { requireSession } from "@/lib/authz";
import {
  addWeeklyTaskNote,
  getWeeklyTask,
  updateWeeklyTask,
  weeklyTaskId,
  type MilestoneStatus,
} from "@/lib/db/collections";
import { reviewSubmission, serializeWeeklyTask } from "@/lib/tasks/weekly";
import { recordStreakActivity } from "@/lib/streak/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60; // feedback review can take a moment

const patchSchema = z.object({
  progress: z.number().int().min(0).max(100).optional(),
  status: z.enum(["pending", "in-progress", "done"]).optional(),
  submission: z.string().max(8000).optional(),
  note: z.string().min(1).max(2000).optional(),
}).refine(
  (v) => v.progress !== undefined || v.status !== undefined || v.submission !== undefined || v.note !== undefined,
  { message: "At least one field must be provided" },
);

export const PATCH = withErrorHandling(async (req, ctx: { params: Promise<{ id: string }> }) => {
  const session = await requireSession();
  const { id } = await ctx.params;
  const body = patchSchema.parse(await parseJson(req));

  const task = await getWeeklyTask(session.id, id);
  if (!task) return fail(404, "Task not found");

  // Append note first so a completion review can see it.
  if (body.note) {
    await addWeeklyTaskNote(session.id, id, {
      id: weeklyTaskId(),
      author: "user",
      text: body.note,
      at: new Date(),
    });
  }

  // Resolve status/progress together so they stay coherent.
  let progress = body.progress ?? task.progress;
  let status: MilestoneStatus = body.status ?? task.status;
  if (body.status === "done") progress = 100;
  else if (body.progress !== undefined) {
    status = progress >= 100 ? "done" : progress > 0 ? "in-progress" : "pending";
  }

  const becameDone = status === "done" && task.status !== "done";

  const patch: Parameters<typeof updateWeeklyTask>[2] = { status, progress };
  if (body.submission !== undefined) patch.submission = body.submission;
  if (becameDone) patch.completedAt = new Date();
  await updateWeeklyTask(session.id, id, patch);

  // Completion → Strategist reviews the work and stores feedback.
  if (becameDone) {
    const fresh = await getWeeklyTask(session.id, id);
    if (fresh) {
      const feedback = await reviewSubmission(session.id, fresh).catch((err) => {
        console.error("[weekly] feedback review failed:", err);
        return null;
      });
      if (feedback) {
        await updateWeeklyTask(session.id, id, { feedback, feedbackAt: new Date() });
        await addWeeklyTaskNote(session.id, id, {
          id: weeklyTaskId(),
          author: "strategist",
          text: "I reviewed your work - see the feedback section on this task.",
          at: new Date(),
        });
      }
    }
  }

  await recordStreakActivity(session.id, becameDone ? "Completed a weekly task" : "Worked on a weekly task");

  const updated = await getWeeklyTask(session.id, id);
  return ok({ task: updated ? serializeWeeklyTask(updated) : null });
});

