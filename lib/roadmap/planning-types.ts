import { z } from "zod";

export type PlanningTargetKind = "university" | "scholarship";
export type PlanningPriority = "primary" | "secondary";

export type PlanningVerificationStatus = "verified" | "unverified" | "unresolved";

export type PlanningProvenance = {
  source: string;
  sourceType: "bundled-json" | "database" | "user" | "integration";
  sourceRef: string;
  sourceUrl?: string;
  lastVerifiedAt?: string;
  verificationStatus: PlanningVerificationStatus;
  confidence: number;
};

export type PlanningTarget = {
  id: string;
  kind: PlanningTargetKind;
  title: string;
  query: string;
  program?: string;
  degreeLevel?: "undergrad" | "masters" | "phd" | "general";
  institutionId?: string;
  scholarshipId?: string;
  country?: string;
  priority: PlanningPriority;
  sourceRefs: string[];
  requirements: string[];
  deadline?: string;
  metadata: Record<string, unknown>;
  provenance: PlanningProvenance[];
  unresolvedReason?: string;
};

export type PlanningRequirement = {
  id: string;
  label: string;
  kind: "academic" | "test" | "research" | "project" | "leadership" | "activity" | "recommendation" | "essay" | "application" | "scholarship_eligibility" | "fit";
  desiredState: string;
  targetIds: string[];
  sourceRefs: string[];
  measurable: boolean;
  targetValue?: number;
  unit?: string;
  confidence: number;
  effortHoursPerWeek?: number;
  provenance?: PlanningProvenance[];
};

export type StudentEvidence = {
  id: string;
  claim: string;
  type: "academic" | "test" | "project" | "research" | "activity" | "award" | "document" | "integration";
  value?: string | number;
  strength: number;
  verified: boolean;
  source: "profile" | "integration" | "user";
  sourceRef?: string;
};

export type MissionEvidence = {
  id: string;
  label: string;
  kind: StudentEvidence["type"];
  ref?: string;
  note?: string;
  verified: boolean;
  at: Date;
};

export type PlanningGapSeverity = "none" | "low" | "medium" | "high";

export type PlanningGap = {
  id: string;
  requirementId: string;
  requirementKind: PlanningRequirement["kind"];
  label: string;
  targetIds: string[];
  currentState: string;
  desiredState: string;
  severity: PlanningGapSeverity;
  gapMagnitude: number;
  severityScore: number;
  urgency: number;
  confidence: number;
  uncertain?: boolean;
  effortHoursPerWeek?: number;
  evidenceIds: string[];
  sourceRefs: string[];
  rationale: string;
};

export type PlanningPriorityScore = {
  id: string;
  gapId: string;
  score: number;
  admissionsImpact: number;
  targetRelevance: number;
  urgency: number;
  feasibility: number;
  gapSeverity: number;
  targetsAffected: number;
  effortHoursPerWeek: number;
  factors: {
    admissionsImpact: number;
    targetRelevance: number;
    urgency: number;
    gapMagnitude: number;
    confidence: number;
    feasibility: number;
  };
  rationale: string;
};

export type StrategyDecision = {
  id: string;
  gapIds: string[];
  targetIds: string[];
  title: string;
  rationale: string;
  expectedOutcome: string;
  evidenceToProduce: string[];
  prerequisites: string[];
  estimatedHoursPerWeek: number;
  valueScore: number;
};

export type StrategyPlan = {
  northStar: string;
  decisions: StrategyDecision[];
  risks: string[];
};

export type GenerationStageName =
  | "requirements"
  | "gap-analysis"
  | "strategy"
  | "master"
  | "expansion"
  | "adaptation";

export type GenerationStageState = "pending" | "running" | "complete" | "failed" | "deferred";

export type GenerationStageRecord = {
  stage: GenerationStageName;
  state: GenerationStageState;
  startedAt?: Date;
  completedAt?: Date;
  latencyMs?: number;
  retryCount?: number;
  model?: string;
  validation?: "valid" | "fallback" | "invalid";
  error?: string;
};

export type RoadmapPlanningState = {
  version: 1;
  generatedAt: Date;
  targets: PlanningTarget[];
  requirements: PlanningRequirement[];
  evidence: StudentEvidence[];
  gaps: PlanningGap[];
  priorities: PlanningPriorityScore[];
  strategy: StrategyPlan;
  retrieval: {
    method: "lexical-bm25";
    sourceRefs: string[];
    resultCount: number;
    documents: Array<{
      id: string;
      source: string;
      title: string;
      excerpt: string;
      metadata: Record<string, unknown>;
      provenance?: PlanningProvenance[];
    }>;
    generatedAt: Date;
  };
  generation: {
    id: string;
    state: "strategy-ready" | "master-ready" | "active-detail-ready" | "complete" | "degraded";
    activeUnitIndex: number;
    deferredUnitIndexes: number[];
    expandedUnitIndexes: number[];
    stages: GenerationStageRecord[];
    updatedAt: Date;
  };
};

export const RequirementsAgentSchema = z.object({
  requirements: z.array(z.object({
    id: z.string().min(1).max(80),
    label: z.string().min(1).max(160),
    kind: z.enum(["academic", "test", "research", "project", "leadership", "activity", "recommendation", "essay", "application", "scholarship_eligibility", "fit"]),
    desiredState: z.string().min(1).max(400),
    targetIds: z.array(z.string().min(1).max(80)).max(12),
    sourceRefs: z.array(z.string().min(1).max(120)).max(12),
    measurable: z.boolean(),
    targetValue: z.number().optional(),
    unit: z.string().max(30).optional(),
    confidence: z.number().min(0).max(1),
    effortHoursPerWeek: z.number().min(0.5).max(40).optional(),
  })).max(40),
});

export const StrategyAgentSchema = z.object({
  northStar: z.string().min(1).max(500),
  decisions: z.array(z.object({
    id: z.string().min(1).max(80),
    gapIds: z.array(z.string().min(1).max(80)).max(8),
    targetIds: z.array(z.string().min(1).max(80)).max(12),
    title: z.string().min(1).max(160),
    rationale: z.string().min(1).max(700),
    expectedOutcome: z.string().min(1).max(300),
    evidenceToProduce: z.array(z.string().min(1).max(180)).max(6),
    prerequisites: z.array(z.string().min(1).max(180)).max(6),
    estimatedHoursPerWeek: z.number().min(0.5).max(40),
    valueScore: z.number().min(0).max(100),
  })).max(20),
  risks: z.array(z.string().min(1).max(240)).max(8),
});

export type RequirementsAgentOutput = z.infer<typeof RequirementsAgentSchema>;
export type StrategyAgentOutput = z.infer<typeof StrategyAgentSchema>;

export type PlanningContext = {
  state: RoadmapPlanningState;
  compact: string;
};
