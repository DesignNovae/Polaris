import { test } from "node:test";
import assert from "node:assert/strict";
import { quantile, percentileOf, summarise, MIN_COHORT } from "@/lib/cohort/service";
import { daysUntil, isDueToday } from "@/lib/notifications/schedule";
import { normaliseBdPhone } from "@/lib/notifications/channels";

/**
 * Cohort statistics are shown to students about other students, so the failure
 * that matters is a percentile that is subtly wrong or a bucket that leaks who
 * is in it. These pin the arithmetic and the k-anonymity floor.
 */

test("the k-anonymity floor is a real number, not a placeholder", () => {
  assert.ok(MIN_COHORT >= 20, "a cohort under 20 can re-identify a student");
});

test("quantile interpolates and handles the edges", () => {
  const sorted = [1, 2, 3, 4, 5];
  assert.equal(quantile(sorted, 0), 1);
  assert.equal(quantile(sorted, 0.5), 3);
  assert.equal(quantile(sorted, 1), 5);
  assert.equal(quantile([1, 2], 0.5), 1.5);
  assert.equal(quantile([], 0.5), 0, "an empty cohort must not throw");
});

test("percentile counts everyone at or below the value", () => {
  const sorted = [10, 20, 30, 40, 50];
  assert.equal(percentileOf(sorted, 10), 20);
  assert.equal(percentileOf(sorted, 30), 60);
  assert.equal(percentileOf(sorted, 50), 100);
  assert.equal(percentileOf(sorted, 5), 0, "below everyone is 0th");
  assert.equal(percentileOf(sorted, 99), 100, "above everyone is 100th");
});

test("ties count as at-or-below, so identical students share a percentile", () => {
  const sorted = [3, 3, 3, 3];
  assert.equal(percentileOf(sorted, 3), 100);
});

test("buckets cover the full range and count every member exactly once", () => {
  const values = [0, 1, 2.4, 2.5, 3.0, 3.2, 3.45, 3.7, 3.9, 4.0];
  const summary = summarise("gpa", values, 3.5);
  const counted = summary.buckets.reduce((n, b) => n + b.count, 0);
  assert.equal(counted, values.length, "no student may fall between buckets");
});

test("the top bucket is inclusive so a perfect score is counted", () => {
  const summary = summarise("gpa", [4.0, 4.0, 3.0], 4.0);
  const top = summary.buckets[summary.buckets.length - 1];
  assert.equal(top.count, 2);
  assert.ok(top.contains, "the student's own bucket is flagged");
});

test("exactly one bucket contains the student", () => {
  const summary = summarise("testPercentile", [10, 40, 60, 80, 95], 60);
  assert.equal(summary.buckets.filter((b) => b.contains).length, 1);
});

test("the summary reports quartiles and a median, not raw members", () => {
  const summary = summarise("ecCount", [1, 2, 3, 4, 5, 6, 7, 8], 4);
  assert.equal(summary.median, 4.5);
  assert.deepEqual(summary.quartiles, [2.75, 6.25]);
  // Nothing in the payload may be a member list.
  assert.ok(!("values" in summary), "raw values must never leave the module");
});

/* ── reminder scheduling ── */

test("daysUntil is whole days from today in UTC", () => {
  const now = new Date("2026-09-03T18:00:00Z");
  assert.equal(daysUntil("2026-09-03", now), 0, "today is zero, not negative");
  assert.equal(daysUntil("2026-09-04", now), 1);
  assert.equal(daysUntil("2026-09-17", now), 14);
  assert.equal(daysUntil("2026-09-02", now), -1, "past deadlines go negative");
});

test("daysUntil rejects an unparseable date rather than firing on NaN", () => {
  assert.ok(Number.isNaN(daysUntil("not-a-date")));
});

test("a reminder fires only on an offset the student chose", () => {
  const now = new Date("2026-09-03T18:00:00Z");
  assert.ok(isDueToday("2026-09-10", [14, 7, 3, 1], now), "7 days out is an offset");
  assert.ok(!isDueToday("2026-09-09", [14, 7, 3, 1], now), "6 days out is not");
  assert.ok(!isDueToday("2026-09-01", [14, 7, 3, 1], now), "a passed deadline never fires");
  assert.ok(!isDueToday("nonsense", [0], now), "an unparseable date never fires");
});

test("Bangladeshi mobile numbers normalise to 880 form", () => {
  assert.equal(normaliseBdPhone("01712345678"), "8801712345678");
  assert.equal(normaliseBdPhone("+880 1712-345678"), "8801712345678");
  assert.equal(normaliseBdPhone("8801712345678"), "8801712345678");
  assert.equal(normaliseBdPhone("1712345678"), "8801712345678");
});

test("an unusable number is rejected rather than sent to the gateway", () => {
  assert.equal(normaliseBdPhone("12345"), null);
  assert.equal(normaliseBdPhone("+44 20 7946 0958"), null);
  assert.equal(normaliseBdPhone(""), null);
});
