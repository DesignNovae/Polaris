/**
 * Acceptance-probability model (logistic regression).
 *
 * Starts from a university's published acceptance rate, then moves it up or
 * down based on the student's academic profile. Academic inputs only - the
 * model uses no demographic data.
 */

import type { StudentProfile } from "@/lib/profile";
import { deriveEngineGpa } from "@/lib/profile";

export type ProbabilityInputs = {
  gpa: number;            // 0–4
  testPercentile: number; // 0–100
  ecCount: number;        // 0–10
  research: number;       // 0–10
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
};

export type ProbabilityResult = {
  probability: number; // 0–1
  factors: Factor[];
  baseline: number;
};

/** How much each factor can move the result. GPA matters most. */
const WEIGHTS = { gpa: 0.9, test: 0.7, ec: 0.5, research: 0.5 };

const GPA_CENTER = 3.4; // GPA of a typical admitted student
const GPA_FLOOR = 2.0;  // below this, an application isn't considered

const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));
const sigmoid = (z: number) => 1 / (1 + Math.exp(-z));
const logit = (p: number) => Math.log(clamp(p, 0.001, 0.99) / (1 - clamp(p, 0.001, 0.99)));

const SAT_TABLE: [sat: number, percentile: number][] = [
  [400, 0], [600, 1], [700, 4], [800, 11], [900, 25], [1000, 41], [1050, 50],
  [1100, 58], [1200, 74], [1300, 87], [1400, 94], [1500, 98], [1550, 99], [1600, 100],
];

/** Converts a raw SAT score into a percentile rank. */
export function satToPercentile(sat: number): number {
  if (sat <= 400) return 0;
  if (sat >= 1600) return 100;
  for (let i = 1; i < SAT_TABLE.length; i++) {
    const [loSat, loPct] = SAT_TABLE[i - 1];
    const [hiSat, hiPct] = SAT_TABLE[i];
    if (sat <= hiSat) return loPct + ((sat - loSat) / (hiSat - loSat)) * (hiPct - loPct);
  }
  return 100;
}

/**
 * Scores GPA against the typical admit. Above 3.4 earns up to +1; below it the
 * penalty keeps growing down to 0.0 instead of bottoming out early.
 */
function gpaScore(gpa: number): number {
  return gpa >= GPA_CENTER
    ? clamp((gpa - GPA_CENTER) / (4 - GPA_CENTER), 0, 1)
    : clamp((gpa - GPA_CENTER) / GPA_CENTER, -1, 0);
}

/** Estimates a student's chance of admission at one university. */
export function scoreProbability(
  inputs: ProbabilityInputs,
  uni: UniversityForModel,
): ProbabilityResult {
  const gpa = WEIGHTS.gpa * gpaScore(inputs.gpa);
  const test = WEIGHTS.test * clamp((inputs.testPercentile - 50) / 50, -1, 1);
  const ec = WEIGHTS.ec * clamp((inputs.ecCount - 3) / 7, -1, 1);
  const research = WEIGHTS.research * clamp((inputs.research - 3) / 7, -1, 1);

  // Start at the school's real admit rate, then apply the profile.
  const score = logit(uni.acceptanceRate) + gpa + test + ec + research;
  let probability = sigmoid(score);

  // Universities don't consider applications below a minimum GPA, however
  // strong the rest of the profile is.
  if (inputs.gpa < GPA_FLOOR) {
    probability *= Math.max(0, inputs.gpa / GPA_FLOOR) ** 3;
  }

  const factors: Factor[] = [
    { name: "GPA", weight: WEIGHTS.gpa, contribution: gpa },
    { name: "Test score", weight: WEIGHTS.test, contribution: test },
    { name: "Extracurriculars", weight: WEIGHTS.ec, contribution: ec },
    { name: "Research work", weight: WEIGHTS.research, contribution: research },
  ].sort((a, b) => b.contribution - a.contribution);

  return { probability, factors, baseline: uni.acceptanceRate };
}

/** Turns a saved student profile into the four numbers the model needs. */
export function profileToInputs(profile: StudentProfile | null): ProbabilityInputs {
  if (!profile) {
    return { gpa: GPA_CENTER, testPercentile: 50, ecCount: 3, research: 3 };
  }

  const ecs = profile.ecs ?? [];
  const achievements = profile.achievements?.length ?? 0;
  const scholarships = profile.scholarships?.length ?? 0;
  const sat = profile.testScores?.SAT;

  const ecCount = clamp(ecs.length * 1.2 + achievements * 0.8 + scholarships * 0.5, 0, 10);

  // Starts at the neutral 3: curricula like HSC have no research component, so
  // "nothing on file" means no information, not a weakness.
  const research = clamp(
    3 +
      (ecs.includes("Research") ? 3 : 0) +
      (ecs.includes("Olympiads") ? 1 : 0) +
      (ecs.includes("Internships") ? 1 : 0) +
      Math.min(achievements * 0.5, 2),
    0,
    10,
  );

  return {
    gpa: deriveEngineGpa(profile),
    testPercentile: profile.testPercentile ?? (sat !== undefined ? satToPercentile(sat) : 50),
    ecCount: profile.ecCount ?? Math.round(ecCount),
    research: profile.research ?? Math.round(research),
  };
}
