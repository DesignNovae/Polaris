/**
 * GET  /api/xp - the student's effort-point state.
 * PATCH /api/xp - set the self-set weekly goal.
 *
 * There is no POST that awards points, for the same reason /api/streak has no
 * POST: points are earned by the server, inside the action that earned them.
 * An endpoint a client could call to grant itself points is not a reward
 * system, it is a text box.
 */

import { z } from "zod";
import { ok, withErrorHandling, parseJson } from "@/lib/api/respond";
import { requireSession } from "@/lib/authz";
import { getXpState, setWeeklyGoal } from "@/lib/xp/service";
import { WEEKLY_GOAL_MAX, WEEKLY_GOAL_MIN } from "@/lib/xp/rules";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = withErrorHandling(async () => {
  const user = await requireSession();
  return ok(await getXpState(user.id));
});

const goalSchema = z.object({
  weeklyGoal: z.number().int().min(WEEKLY_GOAL_MIN).max(WEEKLY_GOAL_MAX),
});

export const PATCH = withErrorHandling(async (req) => {
  const user = await requireSession();
  const { weeklyGoal } = goalSchema.parse(await parseJson(req));
  // The service clamps to the allowed step as well as the band, so a value
  // that passes the schema but lands between steps is snapped rather than
  // rejected - the student moved a slider, not typed a number.
  const saved = await setWeeklyGoal(user.id, weeklyGoal);
  return ok({ weeklyGoal: saved });
});
