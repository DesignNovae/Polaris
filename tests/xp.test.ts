import { test } from "node:test";
import assert from "node:assert/strict";
import {
  XP_WEIGHTS,
  DAILY_CAP,
  WEEKLY_GOAL_MIN,
  WEEKLY_GOAL_MAX,
  WEEKLY_GOAL_DEFAULT,
  WEEKLY_GOAL_STEP,
  clampWeeklyGoal,
  isValidWeeklyGoal,
  grantable,
  levelFor,
  weekStartKey,
  weekDayKeys,
  weightOf,
  isXpSource,
  LEVELS,
} from "@/lib/xp/rules";

/**
 * The cap is the design. Without it the cheapest scoring action becomes the
 * whole game, so these tests pin it harder than anything else here.
 */

test("no single action can be worth more than a day", () => {
  for (const [source, weight] of Object.entries(XP_WEIGHTS)) {
    assert.ok(
      weight <= DAILY_CAP,
      `${source} is worth ${weight}, at or past the ${DAILY_CAP} daily cap - one action would fill the day`,
    );
    assert.ok(weight > 0, `${source} must be worth something`);
  }
});

test("effort outranks admin, and a full exam is the biggest single day's work", () => {
  // The ordering IS the incentive. If admin ever outscores practice, students
  // will correctly conclude the product wants admin.
  assert.ok(XP_WEIGHTS["exam-complete"] > XP_WEIGHTS["exam-section"]);
  assert.ok(XP_WEIGHTS["exam-section"] > XP_WEIGHTS["roadmap-node-done"]);
  assert.ok(XP_WEIGHTS["roadmap-node-done"] > XP_WEIGHTS["task-done"]);
  assert.ok(XP_WEIGHTS["task-done"] > XP_WEIGHTS["deadline-updated"]);
  assert.equal(
    XP_WEIGHTS["exam-complete"],
    Math.max(...Object.values(XP_WEIGHTS)),
    "sitting a full paper should be the most valuable single event",
  );
});

test("grinding the cheapest action cannot fill a day faster than real work", () => {
  const cheapest = Math.min(...Object.values(XP_WEIGHTS));
  const needed = Math.ceil(DAILY_CAP / cheapest);
  assert.ok(
    needed >= 30,
    `the cheapest action is ${cheapest}, so ${needed} repeats would cap the day - that is farmable`,
  );
});

test("the cap clamps an award and never goes negative", () => {
  assert.equal(grantable(0, 40), 40);
  assert.equal(grantable(120, 40), 30, "only the remaining headroom lands");
  assert.equal(grantable(DAILY_CAP, 40), 0, "a full day grants nothing");
  assert.equal(grantable(DAILY_CAP + 20, 40), 0, "never negative, even past the cap");
  assert.equal(grantable(0, 0), 0);
});

test("weights are looked up by name and unknown sources are rejected", () => {
  assert.equal(weightOf("exam-complete"), 100);
  assert.ok(isXpSource("roadmap-node-done"));
  assert.ok(!isXpSource("free-points"));
  assert.ok(!isXpSource("toString"), "prototype keys must not pass as sources");
});

/* ── Levels ── */

test("levels start at one and climb with the table", () => {
  assert.equal(levelFor(0).level, 1);
  assert.equal(levelFor(0).name, "Departure");
  assert.equal(levelFor(149).level, 1);
  assert.equal(levelFor(150).level, 2);
  assert.equal(levelFor(399).level, 2);
  assert.equal(levelFor(400).level, 3);
  assert.equal(levelFor(8000).level, 10);
  assert.equal(levelFor(8000).name, "North star");
});

test("progress within a level is a real percentage of that level's span", () => {
  // Level 2 runs 150 -> 400, so 275 is halfway.
  const mid = levelFor(275);
  assert.equal(mid.level, 2);
  assert.equal(mid.floor, 150);
  assert.equal(mid.ceiling, 400);
  assert.equal(mid.into, 125);
  assert.equal(mid.remaining, 125);
  assert.equal(mid.percent, 50);
});

test("the bar keeps moving past the last named level", () => {
  const last = LEVELS[LEVELS.length - 1];
  const beyond = levelFor(last.at + 3000);
  assert.ok(beyond.level > last.level, "a long-running student keeps levelling");
  assert.ok(beyond.ceiling > beyond.floor);
  assert.ok(beyond.percent >= 0 && beyond.percent <= 100);
  assert.ok(beyond.remaining > 0, "there is always a next target");
});

test("level percent is always within bounds, including odd totals", () => {
  for (const total of [-500, 0, 1, 149, 150, 7999, 8000, 25000, 1_000_000]) {
    const l = levelFor(total);
    assert.ok(l.percent >= 0 && l.percent <= 100, `percent out of range at ${total}`);
    assert.ok(l.level >= 1, `level below 1 at ${total}`);
    assert.ok(l.remaining >= 0, `negative remaining at ${total}`);
    assert.ok(l.name.length > 0);
  }
});

test("a negative or fractional total is treated as floored and non-negative", () => {
  assert.equal(levelFor(-10).level, 1);
  assert.equal(levelFor(-10).into, 0);
  assert.equal(levelFor(150.9).level, 2);
});

/* ── Weekly goal ── */

test("the weekly goal band is what the slider offers", () => {
  assert.ok(isValidWeeklyGoal(WEEKLY_GOAL_MIN));
  assert.ok(isValidWeeklyGoal(WEEKLY_GOAL_MAX));
  assert.ok(isValidWeeklyGoal(WEEKLY_GOAL_DEFAULT));
  assert.ok(!isValidWeeklyGoal(WEEKLY_GOAL_MIN - WEEKLY_GOAL_STEP));
  assert.ok(!isValidWeeklyGoal(WEEKLY_GOAL_MAX + WEEKLY_GOAL_STEP));
  assert.ok(!isValidWeeklyGoal(325), "between steps");
  assert.ok(!isValidWeeklyGoal(400.5), "not an integer");
});

test("a goal outside the band is snapped rather than rejected", () => {
  assert.equal(clampWeeklyGoal(0), WEEKLY_GOAL_MIN);
  assert.equal(clampWeeklyGoal(10_000), WEEKLY_GOAL_MAX);
  assert.equal(clampWeeklyGoal(324), 300);
  assert.equal(clampWeeklyGoal(326), 350);
  assert.ok(isValidWeeklyGoal(clampWeeklyGoal(437)), "clamping always lands on a valid step");
});

test("the default weekly goal is reachable without hitting the cap every day", () => {
  // A goal only a perfect week can reach is a goal that teaches students to
  // give up on Wednesday.
  assert.ok(
    WEEKLY_GOAL_DEFAULT < DAILY_CAP * 7,
    "the default must not require capping out all week",
  );
  assert.ok(WEEKLY_GOAL_DEFAULT >= DAILY_CAP * 2, "but it should take more than two good days");
});

/* ── Weeks ── */

test("weeks start on Monday and hold exactly seven days", () => {
  // 2026-09-09 is a Wednesday.
  const wed = new Date(2026, 8, 9);
  assert.equal(weekStartKey(wed), "2026-09-07", "Monday of that week");

  const days = weekDayKeys(wed);
  assert.equal(days.length, 7);
  assert.equal(days[0], "2026-09-07");
  assert.equal(days[6], "2026-09-13");
  assert.ok(days.includes("2026-09-09"), "the day itself is in its own week");
});

test("Sunday belongs to the week that just ended, not the one starting", () => {
  // 2026-09-13 is a Sunday.
  const sun = new Date(2026, 8, 13);
  assert.equal(weekStartKey(sun), "2026-09-07");
  assert.equal(weekDayKeys(sun)[6], "2026-09-13");
});

test("a week spanning a month boundary is still seven consecutive days", () => {
  const days = weekDayKeys(new Date(2026, 8, 1)); // Tue 1 Sep 2026
  assert.equal(days.length, 7);
  assert.equal(days[0], "2026-08-31", "Monday sits in the previous month");
  assert.equal(days[6], "2026-09-06");
  assert.equal(new Set(days).size, 7, "no repeated days across the boundary");
});
