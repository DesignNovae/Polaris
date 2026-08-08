/**
 * Acceptance-probability model.
 *
 * Logistic regression with hand-tuned coefficients calibrated against
 * the patterns in data/case-studies.json + public acceptance-rate data.
 * Inference is a pure dot product - runs anywhere, no Python runtime needed.
 *
 * Features are intentionally transparent (no demographic proxies):
 *   - GPA (0–4 normalized)
 *   - Standardized test percentile (0–100)
 *   - Strong extracurriculars count (0–10)
 *   - Research / publications signal (0–10)
 *   - University tier difficulty (1=elite, 2=top50, 3=top200, 4=regional)
 */

import type { StudentProfile } from "@/lib/profile";

export type ProbabilityInputs = {
  gpa: number;
  testPercentile: number;
  ecCount: number;
  research: number;
};

export type UniversityForModel = {
  id: string;
  tier: "elite" | "top10" | "top50" | "top100" | "top200" | "regional";
  acceptanceRate: number;
};

export type Factor = {
  name: string;
  weight: number;
  contribution: number;
  hint: string;
};

export type ProbabilityResult = {
  probability: number; // 0–1
  factors: Factor[];
  baseline: number;
};

// Coefficients (tuned by hand against case-studies + acceptance rates).
// Normalizations are shifted so 50th-percentile inputs map to ~0 - preventing
// weak profiles from getting an unearned boost.
const W = {
  gpa: 3.2,       // gpa: (gpa - 3.4) / 0.6, clamped to [-1, 1]
  test: 2.4,      // test: (pct - 50) / 50, clamped to [-1, 1]
  ec: 2.0,        // ec: (count - 3) / 7, clamped to [-1, 1]
  research: 2.2,  // research: (val - 3) / 7, clamped to [-1, 1]
};

// Tier-specific intercept (more negative = harder)
const TIER_INTERCEPT: Record<UniversityForModel["tier"], number> = {
  elite: -3.0,
  top10: -2.4,
  top50: -1.0,
  top100: -0.4,
  top200: 0.1,
  regional: 0.7,
};

const FEATURE_HINTS = {
  gpa: "Higher GPA correlates with admission. Tier-1 admits typically had ≥ 3.9 unweighted.",
  test: "Standardized test percentile. SAT 1500+ ≈ 99th, 1400 ≈ 94th, 1300 ≈ 87th.",
  ec: "Sustained, high-impact extracurriculars (not breadth). 5–7 strong ones outperform 10 shallow ones.",
  research: "Original research, publications, or shipped products. Highest-leverage differentiator for elite tiers.",
};

const sigmoid = (z: number) => 1 / (1 + Math.exp(-z));

export function scoreProbability(
  inputs: ProbabilityInputs,
  uni: UniversityForModel
): ProbabilityResult {
  const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
  // Center the features so mid-profiles ≈ 0, weak profiles negative, strong positive.
  const gpaNorm = clamp((inputs.gpa - 3.4) / 0.6, -1, 1);
  const testNorm = clamp((inputs.testPercentile - 50) / 50, -1, 1);
  const ecNorm = clamp((inputs.ecCount - 3) / 7, -1, 1);
  const resNorm = clamp((inputs.research - 3) / 7, -1, 1);

  const intercept = TIER_INTERCEPT[uni.tier];
  const gpaC = W.gpa * gpaNorm;
  const testC = W.test * testNorm;
  const ecC = W.ec * ecNorm;
  const resC = W.research * resNorm;

  const z = intercept + gpaC + testC + ecC + resC;
  let prob = sigmoid(z);

  // Hard cap so an elite school never reads as a sure thing, but high-acceptance
  // schools can still climb to 90%+ for a strong applicant.
  const cap = Math.min(0.97, uni.acceptanceRate * 4 + 0.25);
  prob = Math.min(prob, cap);

  const factors: Factor[] = [
    { name: "GPA", weight: W.gpa, contribution: gpaC, hint: FEATURE_HINTS.gpa },
    { name: "Test percentile", weight: W.test, contribution: testC, hint: FEATURE_HINTS.test },
    { name: "Extracurriculars", weight: W.ec, contribution: ecC, hint: FEATURE_HINTS.ec },
    { name: "Research / shipped work", weight: W.research, contribution: resC, hint: FEATURE_HINTS.research },
  ].sort((a, b) => b.contribution - a.contribution);

  return {
    probability: prob,
    factors,
    baseline: uni.acceptanceRate,
  };
}

/**
 * Derive default probability-engine inputs from a stored student profile.
 * Used to pre-fill the simulator sliders.
 */
export function profileToInputs(profile: StudentProfile | null): ProbabilityInputs {
  if (!profile) {
    return { gpa: 3.7, testPercentile: 85, ecCount: 4, research: 2 };
  }
  const ecCount = Math.min(10, profile.ecs.length * 1.6);
  const research = profile.ecs.includes("Research") ? 6 : 2;
  // Map intent → assumed test percentile if not measured yet
  const testPct =
    profile.targetTier === "elite"
      ? 90
      : profile.targetTier === "top50"
      ? 80
      : 70;
  return {
    gpa: profile.gpa,
    testPercentile: profile.testPercentile ?? testPct,
    ecCount: profile.ecCount ?? Math.round(ecCount),
    research: profile.research ?? research,
  };
}
