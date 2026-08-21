import assert from "node:assert/strict";
import { test } from "node:test";
import { calculateGaps, calculatePriorities, fallbackStrategy } from "@/lib/roadmap/planning";
import type { PlanningRequirement, PlanningTarget, StudentEvidence } from "@/lib/roadmap/planning-types";
import { phaseCount } from "@/lib/roadmap/types";
import type { RoadmapConfig } from "@/lib/roadmap/types";
import type { StudentProfile } from "@/lib/profile";

const target: PlanningTarget = {
  id: "uni:target",
  kind: "university",
  title: "Target program",
  query: "Target program",
  priority: "primary",
  sourceRefs: ["uni:target"],
  requirements: [],
  metadata: {},
  provenance: [],
};

const config: RoadmapConfig = {
  educationLevel: "gap-applicant",
  targetGoal: "Competitive application",
  durationDays: 90,
  timelineMode: "weekly",
  exams: ["SAT"],
  availableHoursPerWeek: 10,
};

const profile: StudentProfile = {
  grade: "recent-grad",
  country: "Bangladesh",
  degree: "undergrad",
  gpa: 3.2,
  ecs: [],
  targetTier: "top50",
};

test("gap analysis marks a missing test score as a material gap", () => {
  const requirements: PlanningRequirement[] = [{
    id: "req-sat",
    label: "SAT readiness",
    kind: "test",
    desiredState: "SAT 1500+",
    targetIds: [target.id],
    sourceRefs: [target.id],
    measurable: true,
    targetValue: 1500,
    unit: "SAT",
    confidence: 1,
  }];
  const gaps = calculateGaps(requirements, [], [target], profile, config);
  assert.equal(gaps[0]?.severity, "high");
  assert.equal(gaps[0]?.evidenceIds.length, 0);
});

test("priority score is deterministic and strategy links back to the gap", () => {
  const requirements: PlanningRequirement[] = [{
    id: "req-research",
    label: "Research depth",
    kind: "research",
    desiredState: "A verifiable research artifact",
    targetIds: [target.id],
    sourceRefs: [target.id],
    measurable: false,
    confidence: 1,
  }];
  const evidence: StudentEvidence[] = [{
    id: "evidence-project",
    claim: "One unrelated activity",
    type: "activity",
    strength: 0.3,
    verified: false,
    source: "profile",
  }];
  const gaps = calculateGaps(requirements, evidence, [target], profile, config);
  const priorities = calculatePriorities(gaps, [target]);
  const strategy = fallbackStrategy(gaps, priorities, [target]);
  assert.ok((priorities[0]?.score ?? 0) > 0);
  assert.equal(strategy.decisions[0]?.gapIds[0], gaps[0]?.id);
  assert.equal(strategy.decisions[0]?.targetIds[0], target.id);
  assert.ok(priorities[0]?.factors.gapMagnitude !== undefined);
});

test("duration units are not silently capped", () => {
  assert.equal(phaseCount(15, "daily"), 15);
  assert.equal(phaseCount(90, "weekly"), 13);
});

test("test gaps use numeric distance and awards do not satisfy structured requirements", () => {
  const numericProfile = { ...profile, testScores: { IELTS: 7 } };
  const requirements: PlanningRequirement[] = [
    { id: "req-ielts", label: "IELTS readiness", kind: "test", desiredState: "IELTS 7.5+", targetIds: [target.id], sourceRefs: [target.id], measurable: true, targetValue: 7.5, unit: "IELTS", confidence: 1 },
    { id: "req-research", label: "Research depth", kind: "research", desiredState: "A research artifact", targetIds: [target.id], sourceRefs: [target.id], measurable: false, confidence: 1 },
    { id: "req-recommendation", label: "Recommendations", kind: "recommendation", desiredState: "A recommender plan", targetIds: [target.id], sourceRefs: [target.id], measurable: false, confidence: 1 },
    { id: "req-scholarship", label: "Scholarship eligibility fit", kind: "scholarship_eligibility", desiredState: "Eligible evidence", targetIds: [target.id], sourceRefs: [target.id], measurable: false, confidence: 1 },
  ];
  const award: StudentEvidence = { id: "award", claim: "Science award", type: "award", strength: 1, verified: true, source: "profile" };
  const gaps = calculateGaps(requirements, [award], [target], numericProfile, config);
  assert.ok((gaps[0]?.gapMagnitude ?? 0) > 0);
  assert.deepEqual(gaps.slice(1).map((gap) => gap.evidenceIds), [[], [], []]);
});
