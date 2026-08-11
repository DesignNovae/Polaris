/**
 * Day streak - server-side, earned only by meaningful work.
 *
 * `recordStreakActivity(userId, action)` is called from mutation routes that
 * represent real progress (roadmap node updates, score logs, replans, weekly
 * task progress, deadline edits). Page loads and refreshes never touch it.
 *
 * Rules:
 *   - one increment per calendar day (user-local dates handled as server-day;
 *     consistent because all writes go through here)
 *   - consecutive day → current+1; gap → reset to 1
 *   - longest streak tracked forever; active-day log kept for the heatmap
 */

import { getDb } from "@/lib/db/mongodb";

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
  updatedAt: Date;
};

const DAY_CAP = 120;

function dayKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function isYesterday(prev: string, today: string): boolean {
  const [y, m, d] = prev.split("-").map(Number);
  const next = new Date(y, m - 1, d + 1);
  return dayKey(next) === today;
}

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
        days: [today], todayActions: [action], updatedAt: new Date(),
      });
      return;
    }

    if (row.lastActiveDay === today) {
      if (row.todayActions.length < 12 && !row.todayActions.includes(action)) {
        await col.updateOne({ userId }, { $push: { todayActions: action }, $set: { updatedAt: new Date() } });
      }
      return;
    }

    const current = isYesterday(row.lastActiveDay, today) ? row.current + 1 : 1;
    await col.updateOne({ userId }, {
      $set: {
        current,
        longest: Math.max(row.longest, current),
        lastActiveDay: today,
        days: [...row.days.slice(-(DAY_CAP - 1)), today],
        todayActions: [action],
        updatedAt: new Date(),
      },
    });
  } catch {
    // Streaks must never break the action that earned them.
  }
}

export const STREAK_MILESTONES = [3, 7, 14, 30, 60, 100];

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
};

export async function getStreak(userId: string): Promise<StreakState> {
  const db = await getDb();
  const row = await db.collection<DbStreak>("streaks").findOne({ userId });
  const today = dayKey(new Date());

  if (!row) {
    return { current: 0, longest: 0, todayDone: false, days: [], todayActions: [], nextMilestone: STREAK_MILESTONES[0], earned: [], weekCount: 0 };
  }

  // A missed day means the visible current streak is 0 until they act again.
  const live = row.lastActiveDay === today || isYesterday(row.lastActiveDay, today) ? row.current : 0;

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
    nextMilestone: STREAK_MILESTONES.find((m) => m > live) ?? live + 100,
    earned: STREAK_MILESTONES.filter((m) => row.longest >= m),
    weekCount: days.filter((d) => d >= monKey).length,
  };
}
