import { z } from "zod";
import { completeText, extractJson } from "@/lib/llm/complete";
import { generationLanguageInstruction } from "@/lib/i18n/server";
import type { Lang } from "@/lib/i18n/strings";
import { deriveEngineGpa, summarizeProfile, type StudentProfile } from "@/lib/profile";
import { searchDocs } from "@/lib/rag/search";
import { phaseCount, shortId, type RoadmapConfig } from "./types";
import {
  RequirementsAgentSchema,
  StrategyAgentSchema,
  type PlanningContext,
  type PlanningGap,
  type PlanningPriorityScore,
  type PlanningProvenance,
  type PlanningRequirement,
  type PlanningTarget,
  type RoadmapPlanningState,
  type StudentEvidence,
  type StrategyDecision,
  type StrategyPlan,
  type GenerationStageName,
  type GenerationStageRecord,
} from "./planning-types";
import { recordRoadmapStage } from "./telemetry";

export type PlanningOpts = { userId?: string; language?: Lang; existingEvidence?: StudentEvidence[]; fastInitial?: boolean };
type RetrievedDocument = {
  id: string;
  source: string;
  title: string;
  excerpt: string;
  metadata: Record<string, unknown>;
  provenance: PlanningProvenance[];
};

const STAGE_MODEL = "gemma";

function slug(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 48) || "item";
}

function compactText(value: string, max = 700): string {
  const normalized = value.replace(/\s+/g, " ").trim();
  return normalized.length > max ? normalized.slice(0, max - 1) + "…" : normalized;
}

function unique<T>(values: T[], key: (value: T) => string): T[] {
  const seen = new Set<string>();
  return values.filter((value) => {
    const current = key(value);
    if (seen.has(current)) return false;
    seen.add(current);
    return true;
  });
}

type TargetInput = NonNullable<RoadmapConfig["targets"]>[number];

function degreeLevelForProfile(profile: StudentProfile): "undergrad" | "masters" | "phd" | "general" {
  return profile.degree === "undergrad" ? "undergrad" : profile.degree === "masters" ? "masters" : profile.degree === "phd" ? "phd" : "general";
}

function normalizeEntity(value: string): string {
  return value.toLowerCase().replace(/&/g, "and").replace(/[^a-z0-9]+/g, "").trim();
}

function queryInputs(profile: StudentProfile, config: RoadmapConfig): TargetInput[] {
  if (config.targets?.length) return config.targets.map((input) => ({
    ...input,
    kind: input.kind ?? "university",
    priority: input.priority ?? "secondary",
  }));
  return [{ query: config.targetGoal + " " + profile.degree + " " + profile.country + " " + profile.targetTier, kind: "university", degreeLevel: degreeLevelForProfile(profile), priority: "primary" }];
}

async function retrieveTargetDocuments(profile: StudentProfile, config: RoadmapConfig): Promise<{ targets: PlanningTarget[]; documents: RetrievedDocument[] }> {
  const inputs = queryInputs(profile, config);
  const jobs = [
    ...inputs.map((input) => ({
      query: input.query + " " + (input.program ?? ""),
      constraints: {
        source: input.kind === "scholarship" ? "scholarship" as const : "university" as const,
        country: input.country,
        degreeLevel: input.degreeLevel ?? degreeLevelForProfile(profile),
        program: input.program,
      },
    })),
    {
      query: config.targetGoal + " " + profile.degree + " " + profile.targetTier + " " + profile.country,
      constraints: {},
    },
  ];
  const uniqueJobs = unique(jobs, (job) => job.query.toLowerCase().trim() + JSON.stringify(job.constraints));
  let hitGroups: Awaited<ReturnType<typeof searchDocs>>[] = [];
  try {
    hitGroups = await Promise.all(uniqueJobs.map((job) => searchDocs(job.query, null, 8, job.constraints)));
  } catch {
    // Missing/invalid content should reduce context quality, not block a
    // roadmap. The unresolved target fallback below remains explainable.
    hitGroups = [];
  }
  const hits = unique(hitGroups.flat(), (hit) => hit.id).slice(0, 24);
  const documents: RetrievedDocument[] = hits.map((hit) => ({
    id: hit.id,
    source: hit.source,
    title: hit.title,
    excerpt: compactText(hit.text, 900),
    metadata: hit.metadata,
    provenance: [{
      source: hit.source,
      sourceType: "bundled-json",
      sourceRef: hit.id,
      verificationStatus: "unverified",
      confidence: 0.7,
    }],
  }));
  const targets: PlanningTarget[] = [];

  for (let index = 0; index < inputs.length; index++) {
    const input = inputs[index];
    const expectedSource = input.kind === "scholarship" ? "scholarship" : "university";
    const targetHits = (hitGroups[index] ?? []).filter((hit) => hit.source === expectedSource);
    const queryEntity = normalizeEntity(input.query);
    const queryTokens = input.query.toLowerCase().split(/\W+/).filter((word) => word.length > 2);
    const requestedId = input.kind === "scholarship" ? input.scholarshipId : input.institutionId;
    const selected = targetHits.find((hit) => {
      const metadataId = String(hit.metadata.universityId ?? hit.metadata.scholarshipId ?? "");
      const title = normalizeEntity(hit.title);
      const id = normalizeEntity(metadataId);
      const exactId = requestedId && normalizeEntity(requestedId) === id;
      const exactName = title === queryEntity || queryEntity.includes(title);
      const programTokens = (input.program ?? "").toLowerCase().split(/\W+/).filter((word) => word.length > 2);
      const programs = Array.isArray(hit.metadata.programs) ? hit.metadata.programs.map(String).join(" ").toLowerCase() : "";
      const programCompatible = expectedSource === "university" && programTokens.length > 0 && programTokens.some((word) => programs.includes(word));
      const queryMentionsId = id.length > 1 && queryEntity.includes(id);
      return Boolean(exactId || exactName || queryMentionsId || (programCompatible && queryTokens.some((word) => title.includes(normalizeEntity(word)))));
    });
    if (!selected) {
      targets.push({
        id: "target:" + slug(input.query) + ":" + index,
        kind: input.kind,
        title: input.query,
        query: input.query,
        program: input.program,
        degreeLevel: input.degreeLevel ?? degreeLevelForProfile(profile),
        institutionId: input.institutionId,
        scholarshipId: input.scholarshipId,
        country: input.country,
        priority: input.priority,
        sourceRefs: [],
        requirements: [],
        deadline: input.deadline,
        metadata: { unresolved: true },
        provenance: [],
        unresolvedReason: "No confidently matched local record with the requested target kind.",
      });
      continue;
    }
    const degreeLevel = input.degreeLevel ?? degreeLevelForProfile(profile);
    const availableLevels = Array.isArray(selected.metadata.degreeLevels) ? selected.metadata.degreeLevels.map((value) => String(value).toLowerCase().replace(/['’]/g, "")) : [];
    const normalizedDegree = degreeLevel.replace(/['’]/g, "");
    const degreeCompatibility = selected.source === "university"
      ? "unknown"
      : availableLevels.length === 0 || availableLevels.includes("general") || availableLevels.some((level) => level.includes(normalizedDegree) || normalizedDegree.includes(level))
        ? "compatible"
        : "mismatch";
    if (degreeCompatibility === "mismatch") {
      targets.push({
        id: "target:" + slug(input.query) + ":" + index,
        kind: input.kind,
        title: input.query,
        query: input.query,
        program: input.program,
        degreeLevel,
        priority: input.priority,
        sourceRefs: [],
        requirements: [],
        deadline: input.deadline,
        metadata: { unresolved: true, degreeMismatch: true, requestedDegree: degreeLevel, availableLevels },
        provenance: [],
        unresolvedReason: "The matched record is for a different degree level.",
      });
      continue;
    }
    const selectedDocument = documents.find((document) => document.id === selected.id);
    targets.push({
      id: selected.id,
      kind: selected.source === "scholarship" ? "scholarship" : "university",
      title: selected.title,
      query: input.query,
      program: input.program,
      degreeLevel,
      institutionId: typeof selected.metadata.universityId === "string" ? selected.metadata.universityId : input.institutionId,
      scholarshipId: typeof selected.metadata.scholarshipId === "string" ? selected.metadata.scholarshipId : input.scholarshipId,
      country: typeof selected.metadata.country === "string" ? selected.metadata.country : undefined,
      priority: input.priority,
      sourceRefs: [selected.id],
      requirements: [selected.text],
      deadline: input.deadline,
      metadata: { ...selected.metadata, degreeCompatibility },
      provenance: selectedDocument?.provenance ?? [],
    });
  }

  if (!targets.length) {
    targets.push({
      id: "target:" + slug(config.targetGoal),
      kind: "university",
      title: config.targetGoal,
      query: config.targetGoal,
      priority: "primary",
      degreeLevel: degreeLevelForProfile(profile),
      sourceRefs: [],
      requirements: [],
      metadata: { unresolved: true },
      provenance: [],
      unresolvedReason: "No explicit target was supplied; the broad goal is being used as an unresolved planning target.",
    });
  }

  return { targets: unique(targets, (target) => target.id), documents };
}

function addRequirement(output: PlanningRequirement[], requirement: PlanningRequirement): void {
  const existing = output.find((item) => item.label.toLowerCase() === requirement.label.toLowerCase());
  if (!existing) {
    output.push(requirement);
    return;
  }
  existing.targetIds = unique([...existing.targetIds, ...requirement.targetIds], (value) => value);
  existing.sourceRefs = unique([...existing.sourceRefs, ...requirement.sourceRefs], (value) => value);
  existing.confidence = Math.max(existing.confidence, requirement.confidence);
}

function requirementsFromDocuments(
  targets: PlanningTarget[],
  documents: RetrievedDocument[],
  profile: StudentProfile,
  config: RoadmapConfig,
): PlanningRequirement[] {
  const output: PlanningRequirement[] = [];
  const docById = new Map(documents.map((doc) => [doc.id, doc]));
  for (const target of targets) {
    const doc = target.sourceRefs.map((ref) => docById.get(ref)).find(Boolean);
    const text = target.title + " " + (doc?.excerpt ?? target.requirements.join(" "));
    const base = slug(target.id) + "-";
    const add = (suffix: string, value: Omit<PlanningRequirement, "id" | "targetIds" | "sourceRefs" | "provenance">) => addRequirement(output, {
      ...value,
      id: "req-" + base + suffix,
      targetIds: [target.id],
      sourceRefs: target.sourceRefs,
      provenance: target.provenance,
      confidence: target.metadata.degreeCompatibility === "unknown" ? Math.min(value.confidence, 0.55) : value.confidence,
    });

    const gpa = text.match(/\bgpa\s*[:+]?\s*([0-9]+(?:\.[0-9]+)?)/i)?.[1];
    if (gpa) {
      add("gpa", {
        label: "Academic GPA baseline",
        kind: "academic",
        desiredState: "GPA " + gpa + "+ is the typical academic baseline in the retrieved target record.",
        measurable: true,
        targetValue: Number(gpa),
        unit: "GPA / 4",
        confidence: 0.85,
        effortHoursPerWeek: 2,
      });
    }

    const testMatches = [...text.matchAll(/\b(SAT|IELTS|TOEFL)\s*([0-9]+(?:\.[0-9]+)?)(?:\+)?/gi)];
    for (const match of testMatches) {
      const test = match[1].toLowerCase();
      add("test-" + test, {
        label: match[1] + " readiness",
        kind: "test",
        desiredState: match[1] + " " + match[2] + "+ is stated in the retrieved target record.",
        measurable: true,
        targetValue: Number(match[2]),
        unit: match[1].toUpperCase(),
        confidence: 0.9,
        effortHoursPerWeek: 3,
      });
    }

    const signalRules: Array<{ suffix: string; pattern: RegExp; label: string; kind: PlanningRequirement["kind"]; desired: string; effortHoursPerWeek: number }> = [
      { suffix: "essays", pattern: /essay|supplement|personal statement/i, label: "Application writing", kind: "essay", desired: "A target-specific, evidence-backed application narrative.", effortHoursPerWeek: 2 },
      { suffix: "recommendations", pattern: /recommend|teacher|counselor|referee/i, label: "Recommendations", kind: "recommendation", desired: "A credible recommendation plan with appropriate recommenders.", effortHoursPerWeek: 1 },
      { suffix: "research", pattern: /research|publication|paper|lab/i, label: "Research depth", kind: "research", desired: "Demonstrated research activity with a verifiable artifact or confirmation.", effortHoursPerWeek: 4 },
      { suffix: "technical-depth", pattern: /project|programming|portfolio|open-source|differentiator|technical/i, label: "Technical/profile depth", kind: "project", desired: "A focused technical signal that matches the target program.", effortHoursPerWeek: 4 },
      { suffix: "leadership", pattern: /leadership|service|impact|founder/i, label: "Leadership or impact", kind: "leadership", desired: "A sustained leadership or measurable service outcome.", effortHoursPerWeek: 3 },
    ];
    for (const rule of signalRules) {
      if (rule.pattern.test(text)) add(rule.suffix, {
        label: rule.label,
        kind: rule.kind,
        desiredState: rule.desired,
        measurable: false,
        confidence: 0.7,
        effortHoursPerWeek: rule.effortHoursPerWeek,
      });
    }

    if (target.kind === "scholarship") add("eligibility", {
      label: "Scholarship eligibility fit",
      kind: "scholarship_eligibility",
      desiredState: compactText(doc?.excerpt ?? target.requirements.join(" "), 360),
      measurable: false,
      confidence: 0.75,
      effortHoursPerWeek: 3,
    });
    if (!output.some((item) => item.targetIds.includes(target.id))) add("fit", {
      label: "Target-specific competitive fit",
      kind: "fit",
      desiredState: "Build evidence that supports the student's stated goal: " + config.targetGoal,
      measurable: false,
      confidence: 0.45,
      effortHoursPerWeek: 2,
    });
  }

  if (config.academicTarget) {
    addRequirement(output, {
      id: "req-student-academic-target",
      label: "Student academic target",
      kind: "academic",
      desiredState: config.academicTarget,
      targetIds: targets.map((target) => target.id),
      sourceRefs: [],
      measurable: /\d/.test(config.academicTarget),
      targetValue: Number(config.academicTarget.match(/[0-9]+(?:\.[0-9]+)?/)?.[0] ?? NaN) || undefined,
      confidence: 0.95,
      effortHoursPerWeek: 2,
    });
  }
  for (const exam of config.exams) {
    const label = exam + " readiness";
    if (!output.some((item) => item.label.toLowerCase() === label.toLowerCase())) addRequirement(output, {
      id: "req-setup-" + slug(exam),
      label,
      kind: exam === "board" ? "academic" : "test",
      desiredState: "A prepared " + exam + " result aligned with the application timeline.",
      targetIds: targets.map((target) => target.id),
      sourceRefs: [],
      measurable: false,
      confidence: 0.5,
      effortHoursPerWeek: 2,
    });
  }
  void profile;
  return output.slice(0, 40);
}

function buildEvidence(profile: StudentProfile, config: RoadmapConfig, existingEvidence: StudentEvidence[] = []): StudentEvidence[] {
  const evidence: StudentEvidence[] = [];
  evidence.push({ id: "evidence-profile-gpa", claim: "Current academic GPA is " + deriveEngineGpa(profile).toFixed(2) + " / 4.0.", type: "academic", value: deriveEngineGpa(profile), strength: 0.8, verified: true, source: "profile" });
  for (const [key, value] of Object.entries({ ...(profile.testScores ?? {}), ...(config.currentScores ?? {}) })) {
    evidence.push({ id: "evidence-test-" + slug(key), claim: key + " score: " + value + ".", type: "test", value, strength: 0.85, verified: true, source: "profile" });
  }
  for (const category of profile.ecs) evidence.push({ id: "evidence-activity-" + slug(category), claim: "Reported activity category: " + category + ".", type: "activity", strength: 0.45, verified: false, source: "profile" });
  if (profile.research !== undefined) evidence.push({ id: "evidence-research-signal", claim: "Reported research strength: " + profile.research + "/10.", type: "research", value: profile.research, strength: Math.min(1, profile.research / 10), verified: false, source: "profile" });
  for (const achievement of profile.achievements ?? []) evidence.push({ id: "evidence-achievement-" + slug(achievement.id), claim: achievement.title, type: "award", value: achievement.year, strength: 0.65, verified: false, source: "profile", sourceRef: achievement.id });
  for (const scholarship of profile.scholarships ?? []) evidence.push({ id: "evidence-scholarship-" + slug(scholarship.id), claim: scholarship.title ?? scholarship.id, type: "award", value: scholarship.year, strength: 0.55, verified: false, source: "profile", sourceRef: scholarship.id });
  return unique([...evidence, ...existingEvidence], (item) => item.id);
}

function currentTest(profile: StudentProfile, config: RoadmapConfig, label: string): number | undefined {
  const entries = { ...(profile.testScores ?? {}), ...(config.currentScores ?? {}) };
  const found = Object.entries(entries).find(([name]) => name.toLowerCase().includes(label.toLowerCase()));
  return found?.[1];
}

function numericEvidenceForRequirement(requirement: PlanningRequirement, evidence: StudentEvidence[]): number | undefined {
  if (requirement.kind !== "academic" && requirement.kind !== "test") return undefined;
  const unit = (requirement.unit ?? requirement.label.split(" ")[0]).toLowerCase();
  const values = evidence
    .filter((item) => item.value !== undefined && item.type === (requirement.kind === "academic" ? "academic" : "test"))
    .filter((item) => item.claim.toLowerCase().includes(unit) || requirement.kind === "academic")
    .map((item) => typeof item.value === "number" ? item.value : Number(item.value))
    .filter(Number.isFinite);
  return values.length ? Math.max(...values) : undefined;
}

function urgencyForTargets(targets: PlanningTarget[], targetIds: string[]): number {
  const dates = targetIds.map((id) => targets.find((target) => target.id === id)?.deadline).filter(Boolean) as string[];
  if (!dates.length) return 0.35;
  const dayValues = dates.map((date) => Math.ceil((new Date(date).getTime() - Date.now()) / 86_400_000)).filter(Number.isFinite);
  if (!dayValues.length) return 0.35;
  const days = Math.min(...dayValues);
  if (days <= 30) return 1;
  if (days <= 90) return 0.8;
  if (days <= 180) return 0.6;
  return 0.35;
}

function evidenceForRequirement(requirement: PlanningRequirement, evidence: StudentEvidence[]): StudentEvidence[] {
  const words = (requirement.label + " " + requirement.desiredState).toLowerCase().split(/\W+/).filter((word) => word.length > 2);
  const hasAnyWord = (text: string) => words.some((word) => text.includes(word));
  return evidence.filter((item) => {
    const text = item.claim.toLowerCase();
    if (requirement.kind === "academic") return item.type === "academic";
    if (requirement.kind === "test") return item.type === "test" && hasAnyWord(text);
    if (requirement.kind === "research") return item.type === "research" && hasAnyWord(text);
    if (requirement.kind === "project") return item.type === "project" && hasAnyWord(text);
    if (requirement.kind === "leadership") return item.type === "activity" && /leadership|service|impact|founder|president|captain/i.test(text);
    if (requirement.kind === "activity") return item.type === "activity" && hasAnyWord(text);
    if (requirement.kind === "recommendation") return ["document", "integration"].includes(item.type) && /recommend|teacher|counselor|referee/i.test(text);
    if (requirement.kind === "essay" || requirement.kind === "application") return ["document", "integration"].includes(item.type) && /essay|supplement|personal statement|application|draft/i.test(text);
    if (requirement.kind === "scholarship_eligibility") return ["document", "integration"].includes(item.type) && hasAnyWord(text);
    if (requirement.kind === "fit") return ["project", "research", "activity"].includes(item.type) && hasAnyWord(text);
    return false;
  });
}

export function calculateGaps(requirements: PlanningRequirement[], evidence: StudentEvidence[], targets: PlanningTarget[], profile: StudentProfile, config: RoadmapConfig): PlanningGap[] {
  return requirements.map((requirement) => {
    const matched = evidenceForRequirement(requirement, evidence);
    const numericValues = matched.map((item) => typeof item.value === "number" ? item.value : Number(item.value)).filter(Number.isFinite);
    let currentState = matched.length ? matched.map((item) => item.claim).join(" ") : "No supporting evidence recorded yet.";
    let gapMagnitude = matched.length ? Math.max(0, 1 - Math.max(...matched.map((item) => item.strength))) : 1;
    let confidence = requirement.confidence;
    if (requirement.kind === "academic" && requirement.targetValue !== undefined) {
      const current = numericEvidenceForRequirement(requirement, matched) ?? deriveEngineGpa(profile);
      gapMagnitude = Math.max(0, Math.min(1, (requirement.targetValue - current) / Math.max(Math.abs(requirement.targetValue), 1)));
      currentState = "Current normalized GPA: " + current.toFixed(2) + " / 4.0.";
    } else if (requirement.kind === "test" && requirement.targetValue !== undefined) {
      const current = numericEvidenceForRequirement(requirement, matched) ?? currentTest(profile, config, requirement.unit ?? requirement.label.split(" ")[0]);
      gapMagnitude = current === undefined ? 1 : Math.max(0, Math.min(1, (requirement.targetValue - current) / Math.max(Math.abs(requirement.targetValue), 1)));
      currentState = current === undefined ? "No current score recorded." : "Current score: " + current + ".";
    } else if (matched.length) {
      gapMagnitude = Math.max(0, 1 - Math.max(...matched.map((item) => item.strength)));
    }
    if (matched.length) confidence = Math.min(confidence, Math.max(...matched.map((item) => item.strength)));
    const uncertain = numericValues.length > 1 && Math.max(...numericValues) !== Math.min(...numericValues);
    if (uncertain) {
      confidence = Math.min(confidence, 0.55);
      currentState += " Conflicting numeric evidence was preserved and needs verification.";
    }
    const urgency = urgencyForTargets(targets, requirement.targetIds);
    const severityScore = gapMagnitude === 0 ? 0 : Math.min(1, Math.max(0.15, gapMagnitude * 0.75 + urgency * 0.15 + (1 - confidence) * 0.1));
    const combined = Math.min(1, severityScore);
    const severity: PlanningGap["severity"] = combined >= 0.7 ? "high" : combined >= 0.4 ? "medium" : combined >= 0.15 ? "low" : "none";
    return {
      id: "gap-" + slug(requirement.id),
      requirementId: requirement.id,
      requirementKind: requirement.kind,
      label: requirement.label,
      targetIds: requirement.targetIds,
      currentState,
      desiredState: requirement.desiredState,
      severity,
      gapMagnitude: Number(gapMagnitude.toFixed(3)),
      severityScore: Number(combined.toFixed(3)),
      urgency,
      confidence: Number(confidence.toFixed(3)),
      uncertain,
      effortHoursPerWeek: requirement.effortHoursPerWeek,
      evidenceIds: matched.map((item) => item.id),
      sourceRefs: requirement.sourceRefs,
      rationale: severity === "none" ? "Recorded evidence currently meets the structured target signal." : "The target requires " + requirement.desiredState + " while the current record is " + currentState,
    };
  });
}

export function calculatePriorities(gaps: PlanningGap[], targets: PlanningTarget[], availableHoursPerWeek = 10): PlanningPriorityScore[] {
  return gaps.map((gap) => {
    const targetRelevance = Math.min(1, gap.targetIds.length / Math.max(targets.length, 1));
    const admissionsImpact = Math.min(1, 0.45 + gap.targetIds.length * 0.12 + (gap.severity === "high" ? 0.2 : 0));
    const effortHoursPerWeek = gap.effortHoursPerWeek ?? 2;
    const feasibility = Math.max(0.2, Math.min(1, 1 - effortHoursPerWeek / Math.max(availableHoursPerWeek, 1)));
    const score = Math.round(100 * (admissionsImpact * 0.25 + targetRelevance * 0.2 + gap.urgency * 0.15 + gap.gapMagnitude * 0.25 + gap.confidence * 0.05 + feasibility * 0.1));
    return {
      id: "priority-" + slug(gap.id),
      gapId: gap.id,
      score,
      admissionsImpact,
      targetRelevance,
      urgency: gap.urgency,
      feasibility,
      gapSeverity: gap.severityScore,
      targetsAffected: gap.targetIds.length,
      effortHoursPerWeek,
      factors: {
        admissionsImpact,
        targetRelevance,
        urgency: gap.urgency,
        gapMagnitude: gap.gapMagnitude,
        confidence: gap.confidence,
        feasibility,
      },
      rationale: gap.label + " scores " + score + "/100 from admissions impact " + admissionsImpact.toFixed(2) + ", target relevance " + targetRelevance.toFixed(2) + ", urgency " + gap.urgency.toFixed(2) + ", gap magnitude " + gap.gapMagnitude.toFixed(2) + ", confidence " + gap.confidence.toFixed(2) + ", and feasibility " + feasibility.toFixed(2) + ".",
    };
  }).sort((left, right) => right.score - left.score);
}

export function fallbackStrategy(gaps: PlanningGap[], priorities: PlanningPriorityScore[], targets: PlanningTarget[]): StrategyPlan {
  const decisions: StrategyDecision[] = priorities.filter((priority) => priority.score >= 35).slice(0, 8).map((priority) => {
    const gap = gaps.find((item) => item.id === priority.gapId)!;
    const evidenceToProduce = gap.requirementKind === "test" ? ["A dated benchmark score and error log"]
      : gap.requirementKind === "research" ? ["A research artifact, confirmation, or publication trail"]
        : gap.requirementKind === "recommendation" ? ["A confirmed recommender plan"]
          : gap.requirementKind === "essay" || gap.requirementKind === "application" ? ["A target-specific application draft"]
            : gap.requirementKind === "scholarship_eligibility" ? ["A verified eligibility document or checklist"]
              : gap.requirementKind === "project" ? ["A shipped technical artifact or portfolio entry"]
                : ["A dated artifact or measurable result"];
    return {
      id: "strategy-" + slug(gap.id),
      gapIds: [gap.id],
      targetIds: gap.targetIds,
      title: "Close the " + gap.label.toLowerCase() + " gap",
      rationale: gap.rationale + " This is prioritized at " + priority.score + "/100 because it has the clearest value for the current target set.",
      expectedOutcome: gap.desiredState,
      evidenceToProduce,
      prerequisites: [],
      estimatedHoursPerWeek: priority.effortHoursPerWeek,
      valueScore: priority.score,
    };
  });
  return {
    northStar: "Build the strongest evidence-backed application profile for " + targets.map((target) => target.title).join(", ") + ".",
    decisions,
    risks: gaps.filter((gap) => gap.severity === "high").slice(0, 4).map((gap) => gap.label + " remains unresolved."),
  };
}

function targetContextText(targets: PlanningTarget[], documents: RetrievedDocument[]): string {
  const byId = new Map(documents.map((doc) => [doc.id, doc]));
  return targets.map((target) => {
    const text = target.sourceRefs.map((ref) => byId.get(ref)?.excerpt).filter(Boolean).join(" ");
    return "TARGET " + target.id + ": " + target.title + " (" + target.kind + ", " + target.priority + "). Source: " + compactText(text || "No structured record matched; use cautious fallback reasoning.", 700);
  }).join("\n");
}

function mergeRequirementInterpretation(base: PlanningRequirement[], raw: z.infer<typeof RequirementsAgentSchema>): PlanningRequirement[] {
  return base.map((requirement) => {
    const candidate = raw.requirements.find((item) => item.id === requirement.id || item.label.toLowerCase() === requirement.label.toLowerCase());
    if (!candidate) return requirement;
    return {
      ...requirement,
      desiredState: requirement.measurable ? requirement.desiredState : compactText(candidate.desiredState, 400),
      confidence: Math.min(requirement.confidence, candidate.confidence),
    };
  });
}

function mergeStrategy(base: StrategyPlan, raw: z.infer<typeof StrategyAgentSchema>, gaps: PlanningGap[], priorities: PlanningPriorityScore[]): StrategyPlan {
  const validGapIds = new Set(gaps.map((gap) => gap.id));
  const validTargetIds = new Set(gaps.flatMap((gap) => gap.targetIds));
  const byGap = new Map(priorities.map((priority) => [priority.gapId, priority.score]));
  const decisions = raw.decisions.map((decision) => {
    const gapIds = decision.gapIds.filter((id) => validGapIds.has(id));
    const targetIds = decision.targetIds.filter((id) => validTargetIds.has(id));
    if (!gapIds.length) return null;
    const score = Math.max(...gapIds.map((id) => byGap.get(id) ?? 0));
    return { ...decision, gapIds, targetIds, valueScore: score };
  }).filter(Boolean) as StrategyDecision[];
  return { northStar: compactText(raw.northStar, 500), decisions: decisions.length ? decisions : base.decisions, risks: raw.risks.length ? raw.risks : base.risks };
}

function stageRecord(stage: GenerationStageName, state: GenerationStageRecord["state"]): GenerationStageRecord {
  return { stage, state, model: STAGE_MODEL };
}

async function runPlanningStage<T>(
  stage: GenerationStageName,
  schema: z.ZodType<T>,
  system: string,
  user: string,
  opts: PlanningOpts,
  generationId: string,
  stages: GenerationStageRecord[],
): Promise<T | null> {
  const record = stageRecord(stage, "running");
  record.startedAt = new Date();
  stages.push(record);
  void recordRoadmapStage({ generationId, userId: opts.userId, stage, state: "running", startedAt: record.startedAt, model: STAGE_MODEL });
  const started = Date.now();
  let raw: string | null = null;
  let retryCount = 0;
  try {
    for (let attempt = 0; attempt < 2; attempt++) {
      retryCount = attempt;
      raw = await completeText({
        task: "research",
        userId: opts.userId,
        feature: "roadmap-v3-" + stage,
        system,
        messages: [{ role: "user", content: attempt ? user + "\nRetry: return only valid JSON using supplied IDs." : user }],
        temperature: 0.25,
        maxOutputTokens: stage === "strategy" ? 6000 : 5000,
        thinkingLevel: "minimal",
      });
      const parsed = raw ? schema.safeParse(extractJson(raw)) : null;
      if (parsed?.success) {
        record.state = "complete";
        record.validation = "valid";
        record.retryCount = attempt;
        record.completedAt = new Date();
        record.latencyMs = Date.now() - started;
        void recordRoadmapStage({ generationId, userId: opts.userId, stage, state: "complete", startedAt: record.startedAt, completedAt: record.completedAt, latencyMs: record.latencyMs, retryCount: attempt, model: STAGE_MODEL, validation: "valid" });
        return parsed.data;
      }
    }
  } catch (error) {
    record.error = error instanceof Error ? error.message : String(error);
  }
  record.state = "failed";
  record.validation = raw ? "invalid" : "fallback";
  record.retryCount = retryCount;
  record.completedAt = new Date();
  record.latencyMs = Date.now() - started;
  void recordRoadmapStage({ generationId, userId: opts.userId, stage, state: "failed", startedAt: record.startedAt, completedAt: record.completedAt, latencyMs: record.latencyMs, retryCount, model: STAGE_MODEL, validation: record.validation, error: record.error });
  return null;
}

function requirementsPrompt(profile: StudentProfile, config: RoadmapConfig, targets: PlanningTarget[], documents: RetrievedDocument[], requirements: PlanningRequirement[], language?: Lang): string {
  return [
    "You are Polaris Requirements Analyst. Normalize requirements for the supplied target portfolio.",
    generationLanguageInstruction(language ?? "en"),
    "Do not invent university facts, thresholds, deadlines, or target IDs. Use only supplied records.",
    "STUDENT: " + summarizeProfile(profile),
    "GOAL: " + config.targetGoal,
    "TARGET CONTEXT:", targetContextText(targets, documents),
    "DETERMINISTIC REQUIREMENT CANDIDATES:", JSON.stringify(requirements),
    "Return JSON: {\"requirements\":[{\"id\":\"existing-id\",\"label\":\"...\",\"kind\":\"academic|test|research|project|leadership|activity|recommendation|essay|application|scholarship_eligibility|fit\",\"desiredState\":\"...\",\"targetIds\":[\"existing-target-id\"],\"sourceRefs\":[\"existing-source-ref\"],\"measurable\":true,\"targetValue\":0,\"unit\":\"...\",\"confidence\":0.8,\"effortHoursPerWeek\":2}]}",
  ].join("\n");
}

function strategyPrompt(profile: StudentProfile, config: RoadmapConfig, targets: PlanningTarget[], requirements: PlanningRequirement[], evidence: StudentEvidence[], gaps: PlanningGap[], priorities: PlanningPriorityScore[], language?: Lang): string {
  return [
    "You are Polaris Gap and Strategy Analyst. Choose the highest-value admissions actions for this student.",
    generationLanguageInstruction(language ?? "en"),
    "Do not change numeric truth, invent evidence, or invent requirements. Use only supplied IDs and facts.",
    "STUDENT: " + summarizeProfile(profile),
    "GOAL: " + config.targetGoal + "; HOURS/WEEK: " + config.availableHoursPerWeek + "; DURATION: " + config.durationDays + " days.",
    "TARGETS:", JSON.stringify(targets),
    "REQUIREMENTS:", JSON.stringify(requirements),
    "EVIDENCE:", JSON.stringify(evidence),
    "GAPS:", JSON.stringify(gaps),
    "DETERMINISTIC PRIORITY SCORES:", JSON.stringify(priorities),
    "Return JSON: {\"northStar\":\"...\",\"decisions\":[{\"id\":\"...\",\"gapIds\":[\"existing-gap-id\"],\"targetIds\":[\"existing-target-id\"],\"title\":\"...\",\"rationale\":\"...\",\"expectedOutcome\":\"...\",\"evidenceToProduce\":[\"...\"],\"prerequisites\":[\"...\"],\"estimatedHoursPerWeek\":3,\"valueScore\":70}],\"risks\":[\"...\"]}",
  ].join("\n");
}

function compactPlanningContext(state: RoadmapPlanningState): string {
  const targets = state.targets.map((target) => target.id + ": " + target.title + " (" + target.kind + ")").join("; ");
  const gaps = state.gaps.filter((gap) => gap.severity !== "none").slice(0, 10).map((gap) => gap.id + ": " + gap.label + " [" + gap.severity + ", " + gap.targetIds.join(",") + "]").join("; ");
  const priorities = state.priorities.slice(0, 8).map((priority) => priority.gapId + "=" + priority.score + "/100").join("; ");
  const strategy = state.strategy.decisions.slice(0, 8).map((decision) => decision.id + ": " + decision.title + "; outcome=" + decision.expectedOutcome + "; evidence=" + decision.evidenceToProduce.join(", ")).join("\n");
  return [
    "TARGETS: " + targets,
    "OPEN GAPS: " + (gaps || "No material gap has been recorded yet."),
    "VALUE SCORES: " + priorities,
    "STRATEGY:", strategy,
    "PLANNING RULE: preserve structured target facts and turn the highest-value open gaps into missions with explicit evidence outcomes.",
  ].join("\n").slice(0, 12_000);
}

export function planningContextFromState(state: RoadmapPlanningState): PlanningContext {
  return { state, compact: compactPlanningContext(state) };
}

/** Recalculate deterministic state after a meaningful score/evidence event. */
export function refreshPlanningState(
  state: RoadmapPlanningState,
  profile: StudentProfile,
  config: RoadmapConfig,
  additions: StudentEvidence[] = [],
): RoadmapPlanningState {
  const evidence = unique([...state.evidence, ...additions], (item) => item.id);
  const gaps = calculateGaps(state.requirements, evidence, state.targets, profile, config);
  const priorities = calculatePriorities(gaps, state.targets, config.availableHoursPerWeek);
  return {
    ...state,
    evidence,
    gaps,
    priorities,
    generation: {
      ...state.generation,
      state: "strategy-ready",
      updatedAt: new Date(),
    },
  };
}

function strategySignature(state: RoadmapPlanningState): string {
  return JSON.stringify({
    gaps: state.gaps.filter((gap) => gap.severity !== "none").map((gap) => [gap.id, gap.severity, gap.gapMagnitude, gap.confidence]).sort(),
    priorities: state.priorities.slice(0, 8).map((priority) => [priority.gapId, priority.score]).sort(),
  });
}

/**
 * Recalculate planning after a score/profile/target evidence change. The
 * deterministic gap and priority layers always refresh; the Strategy Analyst
 * is called only when those structured inputs materially changed.
 */
export async function refreshPlanningAfterStateChange(
  state: RoadmapPlanningState,
  profile: StudentProfile,
  config: RoadmapConfig,
  additions: StudentEvidence[] = [],
  opts: PlanningOpts = {},
): Promise<{ state: RoadmapPlanningState; strategyChanged: boolean; strategyCalled: boolean }> {
  // Rebuild profile-derived evidence so a changed GPA/test score replaces the
  // old snapshot instead of being hidden by the state-level de-duplication.
  const preservedEvidence = state.evidence.filter((item) => item.source !== "profile");
  const refreshedEvidence = buildEvidence(profile, config, preservedEvidence);
  const next = refreshPlanningState({ ...state, evidence: refreshedEvidence }, profile, config, additions);
  if (strategySignature(next) === strategySignature(state)) {
    return { state: next, strategyChanged: false, strategyCalled: false };
  }
  const stages = [...next.generation.stages];
  const fallback = fallbackStrategy(next.gaps, next.priorities, next.targets);
  const raw = await runPlanningStage(
    "strategy",
    StrategyAgentSchema,
    strategyPrompt(profile, config, next.targets, next.requirements, next.evidence, next.gaps, next.priorities, opts.language),
    "Re-evaluate the strategy using the changed evidence. Keep unchanged priorities when the evidence does not affect them.",
    opts,
    next.generation.id,
    stages,
  );
  const strategy = raw ? mergeStrategy(fallback, raw, next.gaps, next.priorities) : fallback;
  return {
    state: {
      ...next,
      strategy,
      generation: {
        ...next.generation,
        stages,
        state: "strategy-ready",
        updatedAt: new Date(),
      },
    },
    strategyChanged: true,
    strategyCalled: true,
  };
}

export async function buildPlanningContext(profile: StudentProfile, config: RoadmapConfig, opts: PlanningOpts = {}): Promise<PlanningContext> {
  const generationId = shortId();
  const stages: GenerationStageRecord[] = [];
  const retrieved = await retrieveTargetDocuments(profile, config);
  const deterministicRequirements = requirementsFromDocuments(retrieved.targets, retrieved.documents, profile, config);
  const evidence = buildEvidence(profile, config, opts.existingEvidence);
  const requirementsRaw = opts.fastInitial ? null : await runPlanningStage(
    "requirements",
    RequirementsAgentSchema,
    requirementsPrompt(profile, config, retrieved.targets, retrieved.documents, deterministicRequirements, opts.language),
    "Normalize the target requirements now.",
    opts,
    generationId,
    stages,
  );
  if (opts.fastInitial) {
    stages.push(stageRecord("requirements", "deferred"));
    void recordRoadmapStage({ generationId, userId: opts.userId, stage: "requirements", state: "deferred", model: STAGE_MODEL });
  }
  const requirements = requirementsRaw ? mergeRequirementInterpretation(deterministicRequirements, requirementsRaw) : deterministicRequirements;
  const gaps = calculateGaps(requirements, evidence, retrieved.targets, profile, config);
  const priorities = calculatePriorities(gaps, retrieved.targets, config.availableHoursPerWeek);
  const gapStage = stageRecord("gap-analysis", "complete");
  gapStage.startedAt = new Date();
  gapStage.completedAt = new Date();
  gapStage.latencyMs = 0;
  gapStage.validation = "valid";
  stages.push(gapStage);
  void recordRoadmapStage({ generationId, userId: opts.userId, stage: "gap-analysis", state: "complete", startedAt: gapStage.startedAt, completedAt: gapStage.completedAt, latencyMs: 0, model: "deterministic", validation: "valid" });
  const fallback = fallbackStrategy(gaps, priorities, retrieved.targets);
  const strategyRaw = opts.fastInitial ? null : await runPlanningStage(
    "strategy",
    StrategyAgentSchema,
    strategyPrompt(profile, config, retrieved.targets, requirements, evidence, gaps, priorities, opts.language),
    "Select the highest-value strategy now.",
    opts,
    generationId,
    stages,
  );
  if (opts.fastInitial) {
    stages.push(stageRecord("strategy", "deferred"));
    void recordRoadmapStage({ generationId, userId: opts.userId, stage: "strategy", state: "deferred", model: STAGE_MODEL });
  }
  const strategy = strategyRaw ? mergeStrategy(fallback, strategyRaw, gaps, priorities) : fallback;
  const count = phaseCount(config.durationDays, config.timelineMode);
  const state: RoadmapPlanningState = {
    version: 1,
    generatedAt: new Date(),
    targets: retrieved.targets,
    requirements,
    evidence,
    gaps,
    priorities,
    strategy,
    retrieval: {
      method: "lexical-bm25",
      sourceRefs: retrieved.documents.map((document) => document.id),
      resultCount: retrieved.documents.length,
      documents: retrieved.documents,
      generatedAt: new Date(),
    },
    generation: {
      id: generationId,
      state: "strategy-ready",
      activeUnitIndex: 0,
      deferredUnitIndexes: Array.from({ length: Math.max(0, count - 1) }, (_, index) => index + 1),
      expandedUnitIndexes: [],
      stages,
      updatedAt: new Date(),
    },
  };
  return planningContextFromState(state);
}

export function planningContextForUnit(context: PlanningContext, unitIndex: number): string {
  const unitGaps = context.state.gaps.filter((gap) => gap.severity !== "none").slice(unitIndex * 4, unitIndex * 4 + 4);
  const decisions = context.state.strategy.decisions.filter((decision) => decision.gapIds.some((id) => unitGaps.some((gap) => gap.id === id))).slice(0, 6);
  return [
    context.compact,
    "ACTIVE UNIT " + unitIndex + ": focus on these gaps: " + (unitGaps.map((gap) => gap.id + " " + gap.label).join("; ") || "the highest-value open gaps") + ".",
    "RELEVANT STRATEGY: " + decisions.map((decision) => decision.title + "; outcome=" + decision.expectedOutcome + "; evidence=" + decision.evidenceToProduce.join(", ")).join(" | "),
  ].join("\n").slice(0, 7_000);
}
