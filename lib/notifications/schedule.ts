/**
 * Pure reminder scheduling arithmetic.
 *
 * Split out from `deadlines.ts` so it carries no database or environment
 * dependency: this is the logic that decides whether a reminder fires today,
 * and it should be testable without a Mongo URI or a mail provider.
 */

/**
 * Whole days from today (UTC) until an ISO date.
 * Negative once the date has passed; NaN for an unparseable input, which
 * callers must treat as "do not fire" rather than as zero.
 */
export function daysUntil(iso: string, now = new Date()): number {
  const target = Date.parse(`${iso}T00:00:00Z`);
  if (Number.isNaN(target)) return Number.NaN;
  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  return Math.round((target - today) / 86_400_000);
}

/** Whether a reminder is due today for a deadline with these offsets. */
export function isDueToday(
  iso: string,
  offsets: number[],
  now = new Date(),
): boolean {
  const days = daysUntil(iso, now);
  return Number.isFinite(days) && days >= 0 && offsets.includes(days);
}
