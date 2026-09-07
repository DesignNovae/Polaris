/**
 * Pure streak arithmetic.
 *
 * Split out from `service.ts` so it carries no database dependency: this is
 * the logic that decides whether a run continues, whether a freeze is spent,
 * and what the student is shown - and it should be testable without a Mongo
 * URI. Same split as lib/notifications/schedule.ts, for the same reason.
 *
 * Dates are day-keys (YYYY-MM-DD) throughout. Nothing here reads the clock;
 * "today" is always passed in, which is what makes the gap cases testable.
 */

/** Banked freezes, capped. Two covers an illness or an exam day, not a month. */
export const MAX_FREEZES = 2;

/** One freeze earned per this many consecutive days. */
export const FREEZE_EVERY = 7;

export const STREAK_MILESTONES = [3, 7, 14, 30, 60, 100];

export function dayKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/**
 * Whole days from one day-key to another. UTC arithmetic on the parsed parts,
 * so it is immune to the host timezone and to DST moving a local midnight.
 */
export function daysBetween(from: string, to: string): number {
  const [fy, fm, fd] = from.split("-").map(Number);
  const [ty, tm, td] = to.split("-").map(Number);
  return Math.round(
    (Date.UTC(ty, tm - 1, td) - Date.UTC(fy, fm - 1, fd)) / 86_400_000,
  );
}

/** Days the student missed entirely between their last active day and today. */
export function missedBetween(lastActiveDay: string, today: string): number {
  return Math.max(0, daysBetween(lastActiveDay, today) - 1);
}

/** The calendar days sitting in the gap, oldest first. */
export function gapDays(lastActiveDay: string, today: string): string[] {
  const out: string[] = [];
  const [y, m, d] = lastActiveDay.split("-").map(Number);
  for (let i = 1; i < daysBetween(lastActiveDay, today); i++) {
    out.push(dayKey(new Date(y, m - 1, d + i)));
  }
  return out;
}

export type StreakInput = {
  current: number;
  lastActiveDay: string;
  freezes: number;
};

export type StreakAdvance = {
  /** The run length after today's activity. */
  current: number;
  /** Freezes consumed to bridge the gap. */
  spent: number;
  /** Freezes held after spending and earning. */
  freezes: number;
  /** Days a freeze covered, to be recorded. */
  frozen: string[];
  /** False when the gap was too long and the run reset to 1. */
  continued: boolean;
};

/**
 * What today's activity does to the run.
 *
 * A gap the banked freezes can cover keeps the run alive. Freezes are spent
 * only when they actually save something - never on a run that was going to
 * reset anyway, and never on a same-day or consecutive-day action.
 */
export function advanceStreak(
  prev: StreakInput,
  today: string,
): StreakAdvance {
  const missed = missedBetween(prev.lastActiveDay, today);
  const covered = missed > 0 && missed <= prev.freezes;
  const continued = missed === 0 || covered;

  const current = continued ? prev.current + 1 : 1;
  const spent = covered ? missed : 0;
  const remaining = prev.freezes - spent;

  // One freeze per completed week, awarded on the day the run reaches it.
  const earns = continued && current % FREEZE_EVERY === 0 && remaining < MAX_FREEZES;

  return {
    current,
    spent,
    freezes: Math.min(MAX_FREEZES, remaining + (earns ? 1 : 0)),
    frozen: covered ? gapDays(prev.lastActiveDay, today) : [],
    continued,
  };
}

export type StreakView = {
  /** What to show as the current run - 0 once it has genuinely lapsed. */
  live: number;
  /** True when a missed day is currently being held by a banked freeze. */
  freezeHolding: boolean;
};

/**
 * What the student should see right now, without them having acted today.
 *
 * The freeze is not spent until they next act, but the run is shown as alive
 * while one could still cover the gap - and they are told so. A safety net
 * nobody knows about changes no behaviour.
 */
export function viewStreak(prev: StreakInput, today: string): StreakView {
  const missed = missedBetween(prev.lastActiveDay, today);
  const freezeHolding = missed > 0 && missed <= prev.freezes;
  return {
    live: missed === 0 || freezeHolding ? prev.current : 0,
    freezeHolding,
  };
}

/** The next milestone above a run length. */
export function nextMilestone(current: number): number {
  return STREAK_MILESTONES.find((m) => m > current) ?? current + 100;
}
