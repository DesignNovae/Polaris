/**
 * GET /api/streak - the user's real day streak.
 *
 * No POST here on purpose: streaks are earned by meaningful mutations
 * (roadmap progress, scores, replans, weekly tasks, deadlines), which call
 * recordStreakActivity server-side. Refreshing a page can't farm a streak.
 */

import { ok, withErrorHandling } from "@/lib/api/respond";
import { requireSession } from "@/lib/authz";
import { getStreak } from "@/lib/streak/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = withErrorHandling(async () => {
  const user = await requireSession();
  return ok(await getStreak(user.id));
});
