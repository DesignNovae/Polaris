/**
 * GET /api/progress/summary - the small numbers the top bar shows.
 *
 * Deliberately its own endpoint rather than the top bar calling /api/xp and
 * /api/coins: this runs on every workspace page load, and two round trips for
 * a level badge and a coin count is two round trips too many. It returns only
 * what the bar renders, so it never grows into a second copy of either.
 */

import { ok, withErrorHandling } from "@/lib/api/respond";
import { requireSession } from "@/lib/authz";
import { getXpState } from "@/lib/xp/service";
import { getWallet } from "@/lib/coins/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = withErrorHandling(async () => {
  const user = await requireSession();
  // getWallet also settles any coins the student's points have earned since
  // last time, so simply opening a page keeps the balance current.
  const [xp, wallet] = await Promise.all([getXpState(user.id), getWallet(user.id)]);

  return ok({
    level: xp.level.level,
    levelName: xp.level.name,
    levelPercent: xp.level.percent,
    points: xp.total,
    today: xp.today,
    dailyCap: xp.dailyCap,
    week: xp.week,
    weeklyGoal: xp.weeklyGoal,
    coins: wallet.balance,
  });
});
