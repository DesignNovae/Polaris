/**
 * /api/tasks/weekly
 *
 * GET  - list the user's weekly tasks. Generates the plan on first access
 *        (LLM with deterministic fallback), so the response is never empty
 *        for a profiled user.
 * POST - { action: "regenerate" } wipes and regenerates the entire plan.
 */

import { z } from "zod";
import { ok, fail, withErrorHandling, parseJson } from "@/lib/api/respond";
import { requireSession } from "@/lib/authz";
import { deleteWeeklyTasks } from "@/lib/db/collections";
import { ensureWeeklyTasks, serializeWeeklyTask } from "@/lib/tasks/weekly";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = withErrorHandling(async () => {
  const session = await requireSession();
  const tasks = await ensureWeeklyTasks(session.id);
  return ok({ tasks: tasks.map(serializeWeeklyTask) });
});

const postSchema = z.object({ action: z.literal("regenerate") });

export const POST = withErrorHandling(async (req) => {
  const session = await requireSession();
  const body = postSchema.safeParse(await parseJson(req));
  if (!body.success) return fail(400, "Unknown action");
  await deleteWeeklyTasks(session.id);
  const tasks = await ensureWeeklyTasks(session.id);
  return ok({ tasks: tasks.map(serializeWeeklyTask) });
});

