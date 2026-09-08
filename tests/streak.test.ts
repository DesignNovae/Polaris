import { test } from "node:test";
import assert from "node:assert/strict";
import {
  advanceStreak,
  viewStreak,
  daysBetween,
  missedBetween,
  gapDays,
  nextMilestone,
  MAX_FREEZES,
  FREEZE_EVERY,
} from "@/lib/streak/rules";

/**
 * The freeze is the part worth testing hard: it decides whether a student who
 * missed a day keeps a 40-day run or watches it reset to 1, and getting it
 * wrong in either direction is bad - too generous and the streak means
 * nothing, too strict and it does the damage it was added to prevent.
 */

test("consecutive days extend the run without spending a freeze", () => {
  const next = advanceStreak({ current: 5, lastActiveDay: "2026-09-06", freezes: 2 }, "2026-09-07");
  assert.equal(next.current, 6);
  assert.equal(next.spent, 0);
  assert.equal(next.freezes, 2);
  assert.equal(next.continued, true);
  assert.deepEqual(next.frozen, []);
});

test("one missed day is bridged by one freeze", () => {
  const next = advanceStreak({ current: 12, lastActiveDay: "2026-09-05", freezes: 1 }, "2026-09-07");
  assert.equal(next.continued, true);
  assert.equal(next.current, 13, "the run continues from where it was");
  assert.equal(next.spent, 1);
  assert.equal(next.freezes, 0, "the freeze is consumed");
  assert.deepEqual(next.frozen, ["2026-09-06"], "the covered day is recorded");
});

test("two missed days need two freezes", () => {
  const withTwo = advanceStreak({ current: 30, lastActiveDay: "2026-09-04", freezes: 2 }, "2026-09-07");
  assert.equal(withTwo.continued, true);
  assert.equal(withTwo.current, 31);
  assert.equal(withTwo.spent, 2);
  assert.deepEqual(withTwo.frozen, ["2026-09-05", "2026-09-06"]);

  const withOne = advanceStreak({ current: 30, lastActiveDay: "2026-09-04", freezes: 1 }, "2026-09-07");
  assert.equal(withOne.continued, false, "one freeze cannot cover two days");
  assert.equal(withOne.current, 1);
});

test("a freeze is never spent on a run that was resetting anyway", () => {
  // Three missed days, two freezes: the run is gone, so the freezes are kept.
  const next = advanceStreak({ current: 40, lastActiveDay: "2026-09-02", freezes: 2 }, "2026-09-07");
  assert.equal(next.continued, false);
  assert.equal(next.current, 1);
  assert.equal(next.spent, 0, "freezes are not burned for nothing");
  assert.equal(next.freezes, 2, "they stay banked for the next run");
  assert.deepEqual(next.frozen, []);
});

test("with no freezes a single missed day resets the run", () => {
  const next = advanceStreak({ current: 40, lastActiveDay: "2026-09-05", freezes: 0 }, "2026-09-07");
  assert.equal(next.continued, false);
  assert.equal(next.current, 1);
  assert.equal(next.spent, 0);
});

test("a freeze is earned every completed week, capped", () => {
  // Day 7 of a run earns the first freeze.
  const day7 = advanceStreak({ current: 6, lastActiveDay: "2026-09-06", freezes: 0 }, "2026-09-07");
  assert.equal(day7.current, FREEZE_EVERY);
  assert.equal(day7.freezes, 1);

  // Day 14 earns the second.
  const day14 = advanceStreak({ current: 13, lastActiveDay: "2026-09-06", freezes: 1 }, "2026-09-07");
  assert.equal(day14.freezes, 2);

  // Day 21 cannot exceed the cap.
  const day21 = advanceStreak({ current: 20, lastActiveDay: "2026-09-06", freezes: MAX_FREEZES }, "2026-09-07");
  assert.equal(day21.freezes, MAX_FREEZES);

  // A non-week day earns nothing.
  const day8 = advanceStreak({ current: 7, lastActiveDay: "2026-09-06", freezes: 1 }, "2026-09-07");
  assert.equal(day8.freezes, 1);
});

test("spending and earning on the same day both apply", () => {
  // Missed one day, has one freeze, and today's action lands on day 14.
  const next = advanceStreak({ current: 13, lastActiveDay: "2026-09-05", freezes: 1 }, "2026-09-07");
  assert.equal(next.current, 14);
  assert.equal(next.spent, 1, "the freeze bridged the gap");
  assert.equal(next.freezes, 1, "and the completed week earned one back");
});

test("the run never resets below 1", () => {
  const next = advanceStreak({ current: 0, lastActiveDay: "2026-01-01", freezes: 0 }, "2026-09-07");
  assert.equal(next.current, 1);
});

/* ── What the student sees before acting today ── */

test("a run stays visible on the day after activity", () => {
  const v = viewStreak({ current: 9, lastActiveDay: "2026-09-06", freezes: 0 }, "2026-09-07");
  assert.equal(v.live, 9);
  assert.equal(v.freezeHolding, false);
});

test("a banked freeze holds the run visibly, before it is spent", () => {
  const v = viewStreak({ current: 22, lastActiveDay: "2026-09-05", freezes: 1 }, "2026-09-07");
  assert.equal(v.live, 22, "still shown as alive");
  assert.equal(v.freezeHolding, true, "and the student is told why");
});

test("without a freeze a lapsed run shows as zero", () => {
  const v = viewStreak({ current: 22, lastActiveDay: "2026-09-05", freezes: 0 }, "2026-09-07");
  assert.equal(v.live, 0);
  assert.equal(v.freezeHolding, false);
});

/* ── Date arithmetic ── */

test("day arithmetic crosses months, years and leap days", () => {
  assert.equal(daysBetween("2026-09-06", "2026-09-07"), 1);
  assert.equal(daysBetween("2026-08-31", "2026-09-01"), 1, "month boundary");
  assert.equal(daysBetween("2026-12-31", "2027-01-01"), 1, "year boundary");
  assert.equal(daysBetween("2028-02-28", "2028-02-29"), 1, "leap day exists in 2028");
  assert.equal(daysBetween("2026-02-28", "2026-03-01"), 1, "and not in 2026");
  assert.equal(daysBetween("2026-09-07", "2026-09-07"), 0);
});

test("missedBetween counts only whole skipped days", () => {
  assert.equal(missedBetween("2026-09-07", "2026-09-07"), 0, "same day");
  assert.equal(missedBetween("2026-09-06", "2026-09-07"), 0, "consecutive");
  assert.equal(missedBetween("2026-09-05", "2026-09-07"), 1);
  assert.equal(missedBetween("2026-09-01", "2026-09-07"), 5);
});

test("gapDays lists the skipped days across a month boundary", () => {
  assert.deepEqual(gapDays("2026-08-30", "2026-09-02"), ["2026-08-31", "2026-09-01"]);
  assert.deepEqual(gapDays("2026-09-06", "2026-09-07"), []);
});

test("milestones step up and then keep going", () => {
  assert.equal(nextMilestone(0), 3);
  assert.equal(nextMilestone(3), 7);
  assert.equal(nextMilestone(99), 100);
  assert.equal(nextMilestone(100), 200, "past the last milestone it keeps climbing");
});
