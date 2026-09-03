import { test } from "node:test";
import assert from "node:assert/strict";
import {
  assessAffordability,
  supportedCountries,
  formatBdt,
  toBdt,
} from "@/lib/affordability/model";
import { classifyCoverage } from "@/lib/affordability/scholarships";

/**
 * The affordability model produces figures a family plans around, so the things
 * worth pinning are the ones that would silently mislead: an unmodelled country
 * quietly returning zeros, aid being applied to costs it cannot cover, and the
 * verdict boundary between "tight" and a real gap.
 */

const BASE = {
  country: "UK",
  tier: "top50" as const,
  annualBudgetBdt: 2_000_000,
  aidRatio: 0,
  years: 4,
};

test("an unmodelled country reports unsupported instead of guessing", () => {
  const result = assessAffordability({ ...BASE, country: "Atlantis" });
  assert.equal(result.supported, false);
  assert.equal(result.lines.length, 0);
  assert.equal(result.tuitionRangeBdt, null);
  // Crucially it must not present a zero cost as if it were affordable.
  assert.equal(result.grossAnnualBdt, 0);
});

test("every advertised country is actually modelled", () => {
  for (const country of supportedCountries()) {
    const result = assessAffordability({ ...BASE, country });
    assert.equal(result.supported, true, `${country} should be modelled`);
    assert.ok(result.grossAnnualBdt > 0, `${country} should have a cost`);
    assert.equal(result.lines.length, 2, `${country} needs tuition + living`);
  }
});

test("living costs are marked official and tuition an estimate", () => {
  const result = assessAffordability(BASE);
  const living = result.lines.find((l) => l.label === "Living costs");
  const tuition = result.lines.find((l) => l.label === "Tuition");

  assert.equal(living?.basis, "official");
  assert.equal(tuition?.basis, "estimate");
  // The official figure must carry the source it came from.
  assert.ok(living?.sourceUrl, "official figures must cite a source");
});

test("aid applies to tuition only, never to living costs", () => {
  const none = assessAffordability({ ...BASE, aidRatio: 0 });
  const full = assessAffordability({ ...BASE, aidRatio: 1 });
  const tuition = none.lines.find((l) => l.label === "Tuition")!.bdt;
  const living = none.lines.find((l) => l.label === "Living costs")!.bdt;

  assert.equal(full.aidAnnualBdt, tuition);
  // A full tuition waiver still leaves the maintenance requirement.
  assert.equal(full.netAnnualBdt, living);
  assert.ok(full.netAnnualBdt > 0, "living costs survive a full waiver");
});

test("the gap is net cost minus budget, and totals multiply by years", () => {
  const result = assessAffordability({ ...BASE, annualBudgetBdt: 1_000_000, years: 3 });
  assert.equal(result.gapAnnualBdt, result.netAnnualBdt - 1_000_000);
  assert.equal(result.totalNetBdt, result.netAnnualBdt * 3);
  assert.equal(result.totalGapBdt, Math.max(0, result.gapAnnualBdt) * 3);
});

test("a surplus never reports a positive total gap", () => {
  const result = assessAffordability({ ...BASE, annualBudgetBdt: 90_000_000 });
  assert.equal(result.verdict, "comfortable");
  assert.ok(result.gapAnnualBdt < 0);
  assert.equal(result.totalGapBdt, 0, "a surplus is not a gap");
});

test("verdict boundary: within 15% over budget is tight, beyond it is a gap", () => {
  const probe = assessAffordability(BASE);
  const net = probe.netAnnualBdt;

  const tight = assessAffordability({ ...BASE, annualBudgetBdt: Math.round(net / 1.1) });
  const gap = assessAffordability({ ...BASE, annualBudgetBdt: Math.round(net / 1.6) });

  assert.equal(tight.verdict, "tight");
  assert.equal(gap.verdict, "gap");
});

test("a zero budget is a gap, not a division by zero", () => {
  const result = assessAffordability({ ...BASE, annualBudgetBdt: 0 });
  assert.equal(result.verdict, "gap");
  assert.ok(Number.isFinite(result.gapAnnualBdt));
});

test("aid ratio is clamped, so a bad input cannot manufacture a discount", () => {
  const over = assessAffordability({ ...BASE, aidRatio: 5 });
  const under = assessAffordability({ ...BASE, aidRatio: -3 });
  const tuition = assessAffordability(BASE).lines.find((l) => l.label === "Tuition")!.bdt;

  assert.equal(over.aidAnnualBdt, tuition, "aid cannot exceed tuition");
  assert.equal(under.aidAnnualBdt, 0, "aid cannot be negative");
});

test("BDT conversion and formatting", () => {
  assert.equal(toBdt(100, "BDT"), 100);
  assert.ok(toBdt(100, "USD") > toBdt(100, "INR"));

  assert.equal(formatBdt(1_500), "৳2k");
  assert.equal(formatBdt(250_000), "৳2.5 L");
  assert.equal(formatBdt(15_000_000), "৳1.50 Cr");
});

test("scholarship coverage is read from the published value text", () => {
  assert.equal(classifyCoverage("Full tuition + stipend (~£18k/yr) + travel"), "full");
  assert.equal(classifyCoverage("Covers tuition for three years"), "substantial");
  assert.equal(classifyCoverage("Partial award, up to 50%"), "partial");
  assert.equal(classifyCoverage("Varies by consortium"), "unknown");
});
