/**
 * Day streak - server-side, earned only by meaningful work.
 *
 * `recordStreakActivity(userId, action)` is called from mutation routes that
 * represent real progress. Page loads, refreshes and pure read-shaped
 * computations never touch it: a streak has to mean the student did something,
 * or it means nothing at all. Every call site is asserted by
 * tests/streak-coverage.test.ts, so a new surface cannot quietly go silent.
 *
 * The arithmetic lives in ./rules - this file is only persistence.
 *
 * On freezes: losing a long run to a single missed day is the classic way
 * these systems lose the people they were built for - a student who breaks a
 * 40-day streak tends not to restart it. One freeze is banked per completed
 * week, up to two, spent automatically to bridge a gap.
 */

import { getDb } from "@/lib/db/mongodb";
import {
  advanceStreak,
  dayKey,
  nextMilestone,
  viewStreak,
  MAX_FREEZES,
  STREAK_MILESTONES,
} from "./rules";

export { STREAK_MILESTONES, MAX_FREEZES };

export type DbStreak = {
  userId: string;
  current: number;
  longest: number;
  /** YYYY-MM-DD of the last counted day. */
  lastActiveDay: string;
  /** Recent active days (YYYY-MM-DD), capped - drives the heatmap. */
  days: string[];
  /** Actions logged today (resets each new day) - "what earned it". */
  todayActions: string[];
  /** Unspent streak freezes. Earned by consistency, spent automatically. */
  freezes?: number;
  /** Days a freeze covered - drawn differently from both active and missed. */
  frozenDays?: string[];
  updatedAt: Date;
};

const DAY_CAP = 120;

/** Idempotent per day; cheap enough to call from any mutation route. */
export async function recordStreakActivity(userId: string, action: string): Promise<void> {
  try {
    const db = await getDb();
    const col = db.collection<DbStreak>("streaks");
    const today = dayKey(new Date());
    const row = await col.findOne({ userId });

    if (!row) {
      await col.insertOne({
        userId, current: 1, longest: 1, lastActiveDay: today,
        days: [today], todayActions: [action],
        freezes: 0, frozenDays: [],
        updatedAt: new Date(),
      });
      return;
    }

    // Already counted today - just record what else they did.
    if (row.lastActiveDay === today) {
      if (row.todayActions.length < 12 && !row.todayActions.includes(action)) {
        await col.updateOne({ userId }, { $push: { todayActions: action }, $set: { updatedAt: new Date() } });
      }
      return;
    }

    const next = advanceStreak(
      { current: row.current, lastActiveDay: row.lastActiveDay, freezes: row.freezes ?? 0 },
      today,
    );

    await col.updateOne({ userId }, {
      $set: {
        current: next.current,
        longest: Math.max(row.longest, next.current),
        lastActiveDay: today,
        days: [...row.days.slice(-(DAY_CAP - 1)), today],
        todayActions: [action],
        freezes: next.freezes,
        frozenDays: [...(row.frozenDays ?? []), ...next.frozen].slice(-DAY_CAP),
        updatedAt: new Date(),
      },
    });
  } catch {
    // Streaks must never break the action that earned them.
  }
}

export type StreakState = {
  current: number;
  longest: number;
  todayDone: boolean;
  /** Active days inside the last 56 days (8 weeks), YYYY-MM-DD. */
  days: string[];
  todayActions: string[];
  nextMilestone: number;
  /** Milestones already reached (by longest). */
  earned: number[];
  /** Distinct active days in the current week (Mon–Sun). */
  weekCount: number;
  /** Freezes banked and unspent. */
  freezes: number;
  /** Days inside the window that a freeze covered. */
  frozenDays: string[];
  /** True when a missed day is currently being held by a banked freeze. */
  freezeHolding: boolean;
};

export async function getStreak(userId: string): Promise<StreakState> {
  const db = await getDb();
  const row = await db.collection<DbStreak>("streaks").findOne({ userId });
  const today = dayKey(new Date());

  if (!row) {
    return {
      current: 0, longest: 0, todayDone: false, days: [], todayActions: [],
      nextMilestone: STREAK_MILESTONES[0], earned: [], weekCount: 0,
      freezes: 0, frozenDays: [], freezeHolding: false,
    };
  }

  const banked = row.freezes ?? 0;
  const { live, freezeHolding } = viewStreak(
    { current: row.current, lastActiveDay: row.lastActiveDay, freezes: banked },
    today,
  );

  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 56);
  const cutKey = dayKey(cutoff);
  const days = row.days.filter((d) => d >= cutKey);

  const now = new Date();
  const monday = new Date(now);
  monday.setDate(now.getDate() - ((now.getDay() + 6) % 7));
  const monKey = dayKey(monday);

  return {
    current: live,
    longest: row.longest,
    todayDone: row.lastActiveDay === today,
    days,
    todayActions: row.lastActiveDay === today ? row.todayActions : [],
    nextMilestone: nextMilestone(live),
    earned: STREAK_MILESTONES.filter((m) => row.longest >= m),
    weekCount: days.filter((d) => d >= monKey).length,
    freezes: banked,
    frozenDays: (row.frozenDays ?? []).filter((d) => d >= cutKey),
    freezeHolding,
  };
}
