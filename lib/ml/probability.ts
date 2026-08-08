/**
 * Acceptance-probability model.
 *
 * A logistic regression. In plain terms it is a scorecard:
 *
 *   1. Start from the university's published admit rate.
 *   2. Each part of the profile adds or subtracts points.
 *   3. Convert the total back into a percentage.
 *
 * The starting point is the LOG-ODDS of the published admit rate. That single
 * choice is what makes the model honest: a perfectly average applicant scores
 * exactly the school's published rate - 4% at MIT, 53% at Waterloo - and the
 * profile moves you up or down from that anchor. No hand-set difficulty
 * levels, no arbitrary caps.
 *
 * Features are intentionally transparent, and academic only - there are no
 * demographic proxies anywhere in this file:
 *   - GPA (0–4 scale)
 *   - Standardized test percentile (0–100)
 *   - Strong extracurriculars count (0–10)
 *   - Research / shipped work signal (0–10)
 */

import type { StudentProfile } from "@/lib/profile";
import { deriveEngineGpa } from "@/lib/profile";

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
  /** Starting point in log-odds - the published admit rate for this school. */
  intercept: number;
};

/**
 * Weights, in log-odds. These are deliberately small: the four of them sum to
 * 2.6, meaning the very best possible profile multiplies a student's odds by
 * about e^2.6 ≈ 13x versus an average applicant. That is roughly what the
 * admissions literature reports for top-decile applicants. Earlier versions
 * used weights summing to 9.8 (a ~18,000x swing), which let a strong profile
 * read as near-certain at a school admitting 4%.
 */
const W = {
  gpa: 0.9,       // see gpaNorm() - asymmetric above/below the admit average
  test: 0.7,      // (percentile - 50) / 50, clamped to [-1, 1]
  ec: 0.5,        // (count - 3) / 7, clamped to [-1, 1]
  research: 0.5,  // (value - 3) / 7, clamped to [-1, 1]
};

/** The GPA an average admitted applicant has. Profiles are measured against
 *  this, so a 3.4 neither helps nor hurts. */
const GPA_CENTER = 3.4;

/** Minimum GPA a university will consider at all. Below this the application
 *  is not evaluated, so no amount of research or testing can compensate. */
const GPA_FLOOR = 2.0;

const FEATURE_HINTS = {
  gpa: "Higher GPA correlates with admission. Admits at the most selective schools typically had ≥ 3.9 unweighted.",
  test: "Standardized test percentile. SAT 1500+ ≈ 99th, 1400 ≈ 94th, 1300 ≈ 87th.",
  ec: "Sustained, high-impact extracurriculars (not breadth). 5–7 strong ones outperform 10 shallow ones.",
  research: "Original research, publications, or shipped products. Highest-leverage differentiator at selective schools.",
};

const sigmoid = (z: number) => 1 / (1 + Math.exp(-z));
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));

/** Converts a probability into log-odds: ln(p / (1 − p)). */
const logit = (p: number) => {
  const safe = clamp(p, 0.001, 0.99); // keep the maths finite at the extremes
  return Math.log(safe / (1 - safe));
};

/**
 * GPA is scaled asymmetrically. Above the admit average, 3.4 → 4.0 spans the
 * full +1. Below it, the penalty keeps growing all the way down to 0.0. A
 * single symmetric divisor would bottom out around 2.8 and score a 2.8 exactly
 * the same as a 0.0.
 */
function gpaNorm(gpa: number): number {
  return gpa >= GPA_CENTER
    ? clamp((gpa - GPA_CENTER) / (4 - GPA_CENTER), 0, 1)
    : clamp((gpa - GPA_CENTER) / GPA_CENTER, -1, 0);
}

export function scoreProbability(
  inputs: ProbabilityInputs,
  uni: UniversityForModel
): ProbabilityResult {
  // Centered so an average applicant sits at 0 on every factor.
  const testNorm = clamp((inputs.testPercentile - 50) / 50, -1, 1);
  const ecNorm = clamp((inputs.ecCount - 3) / 7, -1, 1);
  const resNorm = clamp((inputs.research - 3) / 7, -1, 1);

  // Anchor: an average applicant scores exactly this school's admit rate.
  const intercept = logit(uni.acceptanceRate);

  const gpaC = W.gpa * gpaNorm(inputs.gpa);
  const testC = W.test * testNorm;
  const ecC = W.ec * ecNorm;
  const resC = W.research * resNorm;

  const z = intercept + gpaC + testC + ecC + resC;
  let prob = sigmoid(z);

  // Academic eligibility gate. Admissions is not purely compensatory: below a
  // published minimum GPA the application isn't evaluated, so strong research
  // or test scores cannot buy back a failing academic record.
  if (inputs.gpa < GPA_FLOOR) {
    prob *= Math.max(0, inputs.gpa / GPA_FLOOR) ** 3;
  }

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
    intercept,
  };
}

/**
 * Derive default probability-engine inputs from a stored student profile.
 * Used to pre-fill the simulator sliders.
 *
 * With no profile we return the NEUTRAL centre of every factor, so the engine
 * reports each school's published admit rate rather than inventing an
 * above-average phantom student. The estimate then moves as real data arrives.
 */
export function profileToInputs(profile: StudentProfile | null): ProbabilityInputs {
  if (!profile) {
    return { gpa: GPA_CENTER, testPercentile: 50, ecCount: 3, research: 3 };
  }

  // deriveEngineGpa converts whatever the student actually has - HSC/SSC on a
  // 0–5 scale, O/A-Level A* counts, or an undergraduate CGPA on a 0–4/5/10
  // scale - onto the 0–4 scale this model expects. Reading profile.gpa raw
  // meant a 0–10 CGPA of 8.5 was fed in as "8.5 GPA".
  const gpa = deriveEngineGpa(profile);

  const ecFromList = Math.round(Math.min(10, profile.ecs.length * 1.6));

  // Research defaults to the NEUTRAL centre (3), not below it. Curricula like
  // Bangladeshi HSC/SSC have no research component at all, so "no research on
  // file" means we have no signal - it must not be scored as a weakness.
  // Students who do have research are credited above the centre.
  const researchFromList = profile.ecs.includes("Research") ? 6 : 3;

  return {
    gpa,
    // An untested student is scored neutrally rather than being credited with
    // the scores their target tier would imply.
    testPercentile: profile.testPercentile ?? 50,
    ecCount: profile.ecCount ?? ecFromList,
    research: profile.research ?? researchFromList,
  };
}
