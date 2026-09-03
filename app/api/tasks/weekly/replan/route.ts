/**
 * POST /api/tasks/weekly/replan
 *
 * The Strategist evaluates progress, performance, notes, and (optionally)
 * the student's stated reason, then rewrites the upcoming not-yet-completed
 * weeks. Completed tasks are never modified.
 *
 * Body: { reason?: string, fromWeek?: number }
 */

import { z } from "zod";
import { ok, fail, withErrorHandling, parseJson } from "@/lib/api/respond";
import { requireSession } from "@/lib/authz";
import { rateLimit, rateLimitHeaders } from "@/lib/ratelimit";
import { replanWeeklyTasks, serializeWeeklyTask } from "@/lib/tasks/weekly";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const schema = z.object({
  reason: z.string().max(2000).optional(),
  fromWeek: z.number().int().min(1).max(52).optional(),
});

export const POST = withErrorHandling(async (req) => {
  const session = await requireSession();

  const rl = await rateLimit(session.id, session.plan, "planning");
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "Rate limit reached. Try the replan again in a few minutes." },
      { status: 429, headers: rateLimitHeaders(rl) },
    );
  }

  const body = schema.parse(await parseJson(req).catch(() => ({})));
  const result = await replanWeeklyTasks(session.id, body);
  if (!result.ok) return fail(422, result.error);
  return ok({ tasks: result.tasks.map(serializeWeeklyTask) });
});

