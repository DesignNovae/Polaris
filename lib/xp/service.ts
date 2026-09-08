/**
 * Effort points - persistence.
 *
 * Two collections, on purpose:
 *
 *   xp_days     one row per student per day, holding what that day earned and
 *               what earned it. This is what the daily cap is enforced against
 *               and what the week view is built from.
 *
 *   xp_profile  one row per student, holding only the self-set weekly goal.
 *
 * There is deliberately no stored lifetime total. A running total kept
 * alongside per-day rows is a second source of truth that drifts the first
 * time an award is retried or a write half-lands, and a wrong lifetime number
 * is worse than a slightly slower one. The total is summed from xp_days, which
 * is at most a few hundred small rows per student per year and is indexed.
 *
 * The cap is enforced inside a single update using an aggregation pipeline, so
 * two concurrent awards cannot both read "today = 140" and each add 40.
 */

import { getDb } from "@/lib/db/mongodb";
import {
  DAILY_CAP,
  WEEKLY_GOAL_DEFAULT,
  clampWeeklyGoal,
  dayKey,
  levelFor,
  weekDayKeys,
  weightOf,
  type LevelState,
  type XpSource,
} from "./rules";

export type DbXpDay = {
  userId: string;
  /** YYYY-MM-DD. */
  day: string;
  earned: number;
  /** What earned it today, most recent last. Capped for size. */
  sources: string[];
  updatedAt: Date;
};

export type DbXpProfile = {
  userId: string;
  weeklyGoal: number;
  updatedAt: Date;
};

const SOURCE_LOG_CAP = 20;

async function days() {
  const db = await getDb();
  return db.collection<DbXpDay>("xp_days");
}

async function profiles() {
  const db = await getDb();
  return db.collection<DbXpProfile>("xp_profile");
}

export type AwardResult = {
  /** Points that actually landed after the cap. Zero once the day is full. */
  granted: number;
  /** The day's total after this award. */
  dayTotal: number;
  /** True when this award is what filled the day. */
  reachedCap: boolean;
};

/**
 * Award points for one event.
 *
 * Never throws - a points failure must not fail the exam submission that
 * earned them. Returns zeros on error so callers can treat it uniformly.
 */
export async function awardXp(userId: string, source: XpSource): Promise<AwardResult> {
  const none: AwardResult = { granted: 0, dayTotal: 0, reachedCap: false };
  try {
    const col = await days();
    const day = dayKey(new Date());
    const weight = weightOf(source);

    // The clamp happens inside the update, not around it: `$min` against the
    // cap makes a concurrent second award land on the already-updated value
    // rather than on a stale read.
    const before = await col.findOne({ userId, day });
    const earnedBefore = before?.earned ?? 0;

    await col.updateOne(
      { userId, day },
      [
        {
          $set: {
            userId,
            day,
            earned: {
              $min: [DAILY_CAP, { $add: [{ $ifNull: ["$earned", 0] }, weight] }],
            },
            sources: {
              $slice: [
                { $concatArrays: [{ $ifNull: ["$sources", []] }, [source]] },
                -SOURCE_LOG_CAP,
              ],
            },
            updatedAt: "$$NOW",
          },
        },
      ],
      { upsert: true },
    );

    const after = await col.findOne({ userId, day });
    const dayTotal = after?.earned ?? Math.min(DAILY_CAP, earnedBefore + weight);

    return {
      granted: Math.max(0, dayTotal - earnedBefore),
      dayTotal,
      reachedCap: dayTotal >= DAILY_CAP && earnedBefore < DAILY_CAP,
    };
  } catch (err) {
    console.error("[xp] award failed for", userId, source, err);
    return none;
  }
}

export type XpState = {
  /** Lifetime points, summed from the day rows. */
  total: number;
  /** Points earned today, and how much of the cap is left. */
  today: number;
  dailyCap: number;
  /** Points this week (Mon-Sun) and the student's own target. */
  week: number;
  weeklyGoal: number;
  weekPercent: number;
  /** Per-day points for the current week, Monday first. */
  weekDays: Array<{ day: string; earned: number }>;
  level: LevelState;
};

export async function getXpState(userId: string): Promise<XpState> {
  const [col, profileCol] = await Promise.all([days(), profiles()]);
  const today = dayKey(new Date());
  const week = weekDayKeys(new Date());

  const [totalAgg, rows, profile] = await Promise.all([
    col
      .aggregate<{ total: number }>([
        { $match: { userId } },
        { $group: { _id: null, total: { $sum: "$earned" } } },
        { $project: { _id: 0, total: 1 } },
      ])
      .toArray(),
    col.find({ userId, day: { $in: week } }).toArray(),
    profileCol.findOne({ userId }),
  ]);

  const byDay = new Map(rows.map((r) => [r.day, r.earned]));
  const weekDays = week.map((day) => ({ day, earned: byDay.get(day) ?? 0 }));
  const weekTotal = weekDays.reduce((sum, d) => sum + d.earned, 0);
  const weeklyGoal = profile?.weeklyGoal ?? WEEKLY_GOAL_DEFAULT;
  const total = totalAgg[0]?.total ?? 0;

  return {
    total,
    today: byDay.get(today) ?? 0,
    dailyCap: DAILY_CAP,
    week: weekTotal,
    weeklyGoal,
    weekPercent: Math.min(100, Math.round((weekTotal / Math.max(1, weeklyGoal)) * 100)),
    weekDays,
    level: levelFor(total),
  };
}

/** Set the student's own weekly target. Clamped to the allowed band. */
export async function setWeeklyGoal(userId: string, points: number): Promise<number> {
  const goal = clampWeeklyGoal(points);
  const col = await profiles();
  await col.updateOne(
    { userId },
    { $set: { weeklyGoal: goal, updatedAt: new Date() }, $setOnInsert: { userId } },
    { upsert: true },
  );
  return goal;
}

/** Lifetime total only - used where the full state would be wasteful. */
export async function getXpTotal(userId: string): Promise<number> {
  try {
    const col = await days();
    const agg = await col
      .aggregate<{ total: number }>([
        { $match: { userId } },
        { $group: { _id: null, total: { $sum: "$earned" } } },
      ])
      .toArray();
    return agg[0]?.total ?? 0;
  } catch {
    return 0;
  }
}
