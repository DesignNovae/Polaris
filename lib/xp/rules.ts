/**
 * Effort points - pure arithmetic.
 *
 * The streak answers "did you show up today". Points answer "how much did
 * today actually contain", because one deadline edit and a full mock exam are
 * not the same day of work.
 *
 * Two rules carry the whole design:
 *
 *   1. Weights track effort, never outcome. Sitting the paper scores; the mark
 *      on it never does. Rewarding results would take points away from exactly
 *      the students who most need a reason to keep going.
 *
 *   2. There is a hard daily cap. Without one, students find the cheapest
 *      action that scores and repeat it - which is not cheating, it is the
 *      system working as specified. The cap is what makes the number mean
 *      "a day's work" instead of "time spent clicking".
 *
 * No database, no clock: `today` is always passed in, which is what makes the
 * week-boundary and cap cases testable. Same split as lib/streak/rules.ts.
 */

import { dayKey } from "@/lib/streak/rules";

export { dayKey };

/**
 * Everything that can earn points, and what it is worth.
 *
 * Keyed by the same event names the progress recorder uses, so a new surface
 * cannot earn points without someone choosing a weight for it.
 */
export const XP_WEIGHTS = {
  "deadline-planned": 5,
  "deadline-updated": 3,
  "task-progress": 6,
  "task-done": 10,
  "weekly-task-progress": 6,
  "weekly-task-done": 10,
  "passport-updated": 5,
  "passport-claim": 12,
  "roadmap-evidence": 15,
  "roadmap-score": 15,
  "roadmap-node-done": 25,
  "roadmap-replan": 20,
  "exam-replan": 20,
  "exam-section": 40,
  "exam-complete": 100,

  // Learning library
  "lesson-progress": 5,
  "lesson-complete": 14,

  // Planning surfaces
  "milestone-progress": 8,
  "milestone-done": 20,
  "schedule-built": 15,
  "week-replanned": 18,
  "roadmap-generated": 30,

  // Research and record-keeping
  "note-saved": 8,
  "writing-submitted": 45,
  "booking-made": 10,
} as const;

export type XpSource = keyof typeof XP_WEIGHTS;

export function isXpSource(value: string): value is XpSource {
  return Object.prototype.hasOwnProperty.call(XP_WEIGHTS, value);
}

export function weightOf(source: XpSource): number {
  return XP_WEIGHTS[source];
}

/**
 * The most a single day can be worth.
 *
 * Set so one full practice exam (100) plus a couple of real tasks reaches it,
 * and so no amount of cheap repetition can. Raising this without re-checking
 * the weights re-opens the grinding hole.
 */
export const DAILY_CAP = 150;

/** Self-set weekly target. The student chooses inside this band. */
export const WEEKLY_GOAL_MIN = 300;
export const WEEKLY_GOAL_MAX = 800;
export const WEEKLY_GOAL_DEFAULT = 400;
export const WEEKLY_GOAL_STEP = 50;

/** True for a goal a student is allowed to set. */
export function isValidWeeklyGoal(points: number): boolean {
  return (
    Number.isInteger(points) &&
    points >= WEEKLY_GOAL_MIN &&
    points <= WEEKLY_GOAL_MAX &&
    points % WEEKLY_GOAL_STEP === 0
  );
}

export function clampWeeklyGoal(points: number): number {
  const stepped = Math.round(points / WEEKLY_GOAL_STEP) * WEEKLY_GOAL_STEP;
  return Math.min(WEEKLY_GOAL_MAX, Math.max(WEEKLY_GOAL_MIN, stepped));
}

/**
 * How much of an award actually lands, given what today already holds.
 * Never negative, never past the cap.
 */
export function grantable(earnedToday: number, weight: number): number {
  return Math.max(0, Math.min(weight, DAILY_CAP - earnedToday));
}

/* ── Levels ────────────────────────────────────────────────────────────────
   Cumulative thresholds rather than a formula, so the curve can be tuned in
   one readable place. Named after the passage a student is making, which is
   the metaphor the product already runs on. */

export type Level = { level: number; name: string; at: number };

export const LEVELS: Level[] = [
  { level: 1, name: "Departure", at: 0 },
  { level: 2, name: "Bearing", at: 150 },
  { level: 3, name: "Course set", at: 400 },
  { level: 4, name: "Open water", at: 800 },
  { level: 5, name: "Trade winds", at: 1400 },
  { level: 6, name: "Deep passage", at: 2200 },
  { level: 7, name: "Landfall", at: 3200 },
  { level: 8, name: "Approach", at: 4500 },
  { level: 9, name: "Harbour", at: 6000 },
  { level: 10, name: "North star", at: 8000 },
];

/** Points added per level once the named table runs out. */
const LEVEL_STEP_BEYOND = 2500;

export type LevelState = {
  level: number;
  name: string;
  /** Total needed to have reached this level. */
  floor: number;
  /** Total needed for the next one. */
  ceiling: number;
  /** Points into the current level. */
  into: number;
  /** Points still to go. */
  remaining: number;
  /** 0-100, how far through the current level. */
  percent: number;
};

export function levelFor(total: number): LevelState {
  const points = Math.max(0, Math.floor(total));

  let current = LEVELS[0];
  for (const entry of LEVELS) if (points >= entry.at) current = entry;

  const last = LEVELS[LEVELS.length - 1];

  // Past the named levels the curve keeps going at a fixed step, so a
  // long-running student never sees a progress bar that cannot move.
  let level = current.level;
  let name = current.name;
  let floor = current.at;
  if (points >= last.at) {
    const beyond = Math.floor((points - last.at) / LEVEL_STEP_BEYOND);
    level = last.level + beyond;
    floor = last.at + beyond * LEVEL_STEP_BEYOND;
    name = beyond === 0 ? last.name : `${last.name} ${romanNumeral(beyond + 1)}`;
  }

  const next = LEVELS.find((entry) => entry.at > points);
  const ceiling = next ? next.at : floor + LEVEL_STEP_BEYOND;
  const span = Math.max(1, ceiling - floor);
  const into = points - floor;

  return {
    level,
    name,
    floor,
    ceiling,
    into,
    remaining: Math.max(0, ceiling - points),
    percent: Math.max(0, Math.min(100, Math.round((into / span) * 100))),
  };
}

/** Small numerals only - levels past the table are rare and never large. */
function romanNumeral(n: number): string {
  const table: Array<[number, string]> = [
    [10, "X"], [9, "IX"], [5, "V"], [4, "IV"], [1, "I"],
  ];
  let rest = n;
  let out = "";
  for (const [value, glyph] of table) {
    while (rest >= value) {
      out += glyph;
      rest -= value;
    }
  }
  return out;
}

/* ── Weeks ─────────────────────────────────────────────────────────────────
   Monday-start, matching the streak widget's "this week" count so the two
   never disagree about which days belong to the current week. */

export function weekStartKey(d: Date = new Date()): string {
  const monday = new Date(d);
  monday.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return dayKey(monday);
}

/** The seven day-keys of the week containing `d`, Monday first. */
export function weekDayKeys(d: Date = new Date()): string[] {
  const monday = new Date(d);
  monday.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return Array.from({ length: 7 }, (_, i) => {
    const day = new Date(monday);
    day.setDate(monday.getDate() + i);
    return dayKey(day);
  });
}
