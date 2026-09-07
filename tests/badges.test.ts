import { test } from "node:test";
import assert from "node:assert/strict";
import {
  BADGES,
  BADGE_BY_ID,
  EMPTY_COUNTERS,
  earnedIds,
  isEarned,
  TIER_LABEL,
  type BadgeContext,
} from "@/lib/badges/catalog";
import { PROGRESS_EVENTS } from "@/lib/progress/record";
import { XP_WEIGHTS } from "@/lib/xp/rules";

/**
 * A badge is a claim Polaris makes to a third party on a student's behalf. The
 * tests that matter are therefore less about arithmetic than about wording and
 * honesty: an overclaiming badge is worse than a missing one, because it is the
 * student's credibility being spent, not ours.
 */

function ctx(over: Partial<BadgeContext["counters"]> = {}, rest: Partial<BadgeContext> = {}): BadgeContext {
  return {
    counters: { ...EMPTY_COUNTERS, ...over },
    streakLongest: 0,
    verifiedClaims: 0,
    ...rest,
  };
}

/* ── The catalogue as a contract ── */

test("every badge has a unique id", () => {
  const ids = BADGES.map((b) => b.id);
  assert.equal(new Set(ids).size, ids.length);
  assert.equal(BADGE_BY_ID.size, BADGES.length);
});

test("every badge states what it does not establish", () => {
  // The passport's whole premise is that a claim without its limits is
  // advertising. A badge with an empty gap would quietly break that.
  for (const b of BADGES) {
    assert.ok(b.gap.trim().length > 12, `${b.id} has no meaningful gap statement`);
    assert.ok(b.signal.trim().length > 12, `${b.id} does not say what was observed`);
    assert.ok(b.claim.trim().length > 12, `${b.id} has no claim`);
    assert.ok(TIER_LABEL[b.tier], `${b.id} has an unknown tier`);
  }
});

test("claims are countable statements, not praise", () => {
  const praise = /\b(champion|master|hero|legend|rockstar|amazing|excellent|best|superb|genius)\b/i;
  for (const b of BADGES) {
    assert.ok(!praise.test(b.claim), `${b.id} claim reads as praise: "${b.claim}"`);
    assert.ok(!praise.test(b.title), `${b.id} title reads as praise: "${b.title}"`);
    assert.match(
      b.claim,
      /\d/,
      `${b.id} claim carries no number, so a reader cannot check it: "${b.claim}"`,
    );
  }
});

test("no badge rewards a score or a grade", () => {
  // Rewarding outcomes would take achievements away from exactly the students
  // still improving - which is most of them.
  const outcome = /\b(scored?|grade[ds]?|band|percentile|marks?|top \d|above average|accuracy)\b/i;
  for (const b of BADGES) {
    assert.ok(!outcome.test(b.claim), `${b.id} claim rewards an outcome: "${b.claim}"`);
  }
});

/* ── Criteria ── */

test("nothing is earned by a brand-new student", () => {
  assert.deepEqual(earnedIds(ctx()), [], "an empty record earns nothing");
});

test("a badge trips exactly at its threshold, not before", () => {
  const def = BADGE_BY_ID.get("timed-sections-10")!;
  assert.ok(!isEarned(def, ctx({ examSections: 9 })));
  assert.ok(isEarned(def, ctx({ examSections: 10 })));
  assert.ok(isEarned(def, ctx({ examSections: 400 })), "and stays earned above it");
});

test("progress is reported against the same threshold that awards it", () => {
  // If these two ever disagree, a student sees "10 of 10" on a locked badge.
  for (const def of BADGES) {
    // Built from the counter type rather than a hand-written list: a new
    // counter used to leave this fixture at zero, so its badge could never
    // reach its own threshold and the failure looked like a criteria bug.
    const everything = Object.fromEntries(
      Object.keys(EMPTY_COUNTERS).map((key) => [key, 999]),
    ) as Partial<typeof EMPTY_COUNTERS>;
    const generous = ctx(everything, { streakLongest: 999, verifiedClaims: 999 });
    const { have, need } = def.progress(generous);
    assert.equal(have, need, `${def.id} progress does not reach its own threshold`);
    assert.ok(isEarned(def, generous), `${def.id} is not earned at full progress`);
    assert.ok(need > 0, `${def.id} has a zero threshold and would auto-award`);
  }
});

test("progress never exceeds the threshold it is shown against", () => {
  const def = BADGE_BY_ID.get("timed-sections-10")!;
  const { have, need } = def.progress(ctx({ examSections: 500 }));
  assert.equal(need, 10);
  assert.equal(have, 10, "a student should never see 500 of 10");
});

test("each counter actually drives at least one badge", () => {
  // A counter nobody reads is a write on every mutation for no reason.
  const keys = Object.keys(EMPTY_COUNTERS) as Array<keyof typeof EMPTY_COUNTERS>;
  const unused = keys.filter((key) => {
    const before = earnedIds(ctx());
    const after = earnedIds(ctx({ [key]: 9999 } as Partial<typeof EMPTY_COUNTERS>));
    return after.length === before.length;
  });
  // Both remaining exclusions are argued in ProgressCounters: planning a
  // deadline is administration, and raw claim count rewards typing where
  // verified-claims-5 rewards evidence.
  assert.deepEqual(
    unused,
    ["deadlinesPlanned", "passportClaims"],
    "a counter gained or lost its badge - confirm that is deliberate, then update this list",
  );
});

test("the streak badges read the streak, not a counter", () => {
  assert.ok(isEarned(BADGE_BY_ID.get("streak-30")!, ctx({}, { streakLongest: 30 })));
  assert.ok(!isEarned(BADGE_BY_ID.get("streak-100")!, ctx({}, { streakLongest: 30 })));
  assert.ok(isEarned(BADGE_BY_ID.get("streak-100")!, ctx({}, { streakLongest: 100 })));
});

test("the passport badge counts only claims with a real artifact", () => {
  const def = BADGE_BY_ID.get("verified-claims-5")!;
  assert.ok(!isEarned(def, ctx({ passportClaims: 50 })), "unevidenced claims must not count");
  assert.ok(isEarned(def, ctx({}, { verifiedClaims: 5 })));
});

test("tiers escalate with the work required", () => {
  const ten = BADGE_BY_ID.get("timed-sections-10")!;
  const forty = BADGE_BY_ID.get("timed-sections-40")!;
  assert.equal(ten.tier, "foundation");
  assert.equal(forty.tier, "distinguished");
});

/* ── Wiring ── */

test("every progress event has an XP weight and vice versa", () => {
  // The two tables are edited separately; drift means an event that earns a
  // streak day and silently no points.
  const events = [...PROGRESS_EVENTS].sort();
  const weighted = Object.keys(XP_WEIGHTS).sort();
  assert.deepEqual(events, weighted);
});
