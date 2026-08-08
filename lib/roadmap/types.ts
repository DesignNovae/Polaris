/**
 * Roadmap v2 - tree/skill-map data model.
 *
 * One live roadmap document per user. The tree is branches (categories)
 * holding leaf nodes (missions). Every node carries the full "how to finish
 * this in your timeframe" payload: what/why/how, window, difficulty,
 * priority, weekly workload, task checklist, topic-wise resources, score
 * inputs, completion criteria, and a strategist context line.
 *
 * The SAME document powers the visual tree AND the Strategist's context, so
 * the two can never drift apart.
 */

import { z } from "zod";

/* ─── education levels (5) ─── */

export const EDUCATION_LEVELS = [
  "early-school",  // ~Class 1–5
  "middle-school", // ~Class 6–8
  "ssc",           // Class 9–10 / O-Level - board exam pressure
  "hsc",           // Class 11–12 / A-Level - admission-focused
  "gap-applicant", // gap year / actively applying
] as const;
export type EducationLevel = (typeof EDUCATION_LEVELS)[number];

export const EDUCATION_LEVEL_LABELS: Record<EducationLevel, string> = {
  "early-school": "Early school (Class 1–5)",
  "middle-school": "Middle school (Class 6–8)",
  "ssc": "SSC / O-Level (Class 9–10)",
  "hsc": "HSC / A-Level (Class 11–12)",
  "gap-applicant": "Gap year / Applicant",
};

/* ─── timeline ─── */

export type TimelineMode = "daily" | "weekly" | "monthly" | "yearly";

export const TimelineModeSchema = z.enum(["daily", "weekly", "monthly", "yearly"]);

/** Suggest the natural mode for a duration in days. */
export function suggestTimelineMode(durationDays: number): TimelineMode {
  if (durationDays <= 21) return "daily";
  if (durationDays <= 120) return "weekly";
  if (durationDays <= 400) return "monthly";
  return "yearly";
}

/** Human label for a phase index under a mode ("Week 3", "Month 2", …). */
export function phaseLabel(mode: TimelineMode, index: number): string {
  const n = index + 1;
  switch (mode) {
    case "daily": return `Day ${n}`;
    case "weekly": return `Week ${n}`;
    case "monthly": return `Month ${n}`;
    case "yearly": return `Year ${n}`;
  }
}

/** How many phases a duration yields under a mode (clamped 2–12). */
export function phaseCount(durationDays: number, mode: TimelineMode): number {
  const raw =
    mode === "daily" ? durationDays :
    mode === "weekly" ? Math.ceil(durationDays / 7) :
    mode === "monthly" ? Math.ceil(durationDays / 30) :
    Math.ceil(durationDays / 365);
  return Math.max(2, Math.min(12, raw));
}

/* ─── setup config ─── */

export const RoadmapConfigSchema = z.object({
  educationLevel: z.enum(EDUCATION_LEVELS),
  /** Free-text class/year, e.g. "Class 9", "A2", "Gap year". */
  currentYear: z.string().max(40).optional(),
  /** e.g. "Top US universities", "Oxbridge", "Strong regional programs". */
  targetGoal: z.string().min(1).max(300),
  durationDays: z.number().int().min(7).max(365 * 4),
  timelineMode: TimelineModeSchema,
  /** Exams in scope. */
  exams: z.array(z.enum(["SAT", "IELTS", "TOEFL", "board", "olympiad"])).max(5),
  availableHoursPerWeek: z.number().int().min(1).max(80),
  /** Self-reported weakest area, free text. */
  weakAreas: z.string().max(300).optional(),
  /** Academic target, e.g. "GPA 5.0", "4 A*". */
  academicTarget: z.string().max(120).optional(),
  /** Current scores at setup time, e.g. { "SAT": 1180, "IELTS": 6.5 }. */
  currentScores: z.record(z.string(), z.number()).optional(),
});
export type RoadmapConfig = z.infer<typeof RoadmapConfigSchema>;

/* ─── tree ─── */

export type NodeStatus = "locked" | "available" | "current" | "done";

export type NodeResource = {
  kind: "youtube" | "pdf" | "link" | "book" | "practice";
  title: string;
  /** youtube → video id; others → absolute URL. */
  ref: string;
  note?: string;
};

export type NodeTask = { id: string; text: string; done: boolean };

export type ScoreInputDef = {
  /** Stable key, e.g. "sat-math", "ielts-writing", "mock-pct". */
  key: string;
  label: string;
  min: number;
  max: number;
  step: number;
  unit?: string;
};

export type ScoreEntry = {
  key: string;
  label: string;
  value: number;
  max: number;
  nodeId?: string;
  at: Date;
};

export type RoadmapNode = {
  id: string;
  title: string;
  /** WHAT to do - 1–2 sentences. */
  description: string;
  /** WHY it matters for admissions/profile. */
  why: string;
  /** HOW to execute, concrete steps prose. */
  how: string;
  type: "study" | "practice" | "project" | "test" | "activity" | "application";
  priority: "high" | "medium" | "low";
  difficulty: 1 | 2 | 3 | 4 | 5;
  /** Phase index into the timeline (0-based). */
  phase: number;
  estimatedHoursPerWeek: number;
  /** Task checklist - completing all ≈ completion criteria met. */
  tasks: NodeTask[];
  /** Topic tags drive resource matching + score adaptation ("sat-math"). */
  topics: string[];
  resources: NodeResource[];
  scoreInputs: ScoreInputDef[];
  completionCriteria: string;
  /** One-line context the Strategist sees for this node. */
  strategistContext: string;
  /** Admission-profile impact, shown in the modal ("+ Testing strength"). */
  impact: string;
  status: NodeStatus;
  progress: number; // 0–100, derived from tasks unless set directly
  notes: Array<{ id: string; text: string; at: Date }>;
  completedAt?: Date;
};

export type BranchCategory =
  | "Academics" | "SAT" | "IELTS" | "Olympiads" | "ECAs" | "Projects"
  | "Research" | "Leadership" | "Hackathons" | "Applications"
  | "Scholarships" | "Portfolio" | "Wellness" | "Foundations";

export type RoadmapBranch = {
  id: string;
  title: string;
  category: BranchCategory;
  priority: "high" | "medium" | "low";
  /** Branch accent for the tree. */
  tone: "polaris" | "nova" | "aurora" | "rose";
  nodes: RoadmapNode[];
};

export type RoadmapDoc = {
  roadmapId: string;
  title: string;
  config: RoadmapConfig;
  /** Phase labels precomputed for the timeline header. */
  phases: string[];
  branches: RoadmapBranch[];
  scores: ScoreEntry[];
  /** Log of adaptive changes ("Boosted SAT Math after low score"). */
  adaptations: Array<{ id: string; reason: string; at: Date }>;
  createdAt: Date;
  updatedAt: Date;
};

/* ─── LLM generation schema (what the model must output) ─── */

export const GenNodeSchema = z.object({
  title: z.string().min(1).max(140),
  description: z.string().min(1).max(600),
  why: z.string().min(1).max(600),
  how: z.string().min(1).max(900),
  type: z.enum(["study", "practice", "project", "test", "activity", "application"]),
  priority: z.enum(["high", "medium", "low"]),
  difficulty: z.number().int().min(1).max(5),
  phase: z.number().int().min(0).max(11),
  estimatedHoursPerWeek: z.number().min(0.5).max(40),
  tasks: z.array(z.string().min(1).max(240)).min(2).max(7),
  topics: z.array(z.string().min(1).max(40)).min(1).max(5),
  completionCriteria: z.string().min(1).max(300),
  impact: z.string().min(1).max(160),
});

export const GenBranchSchema = z.object({
  title: z.string().min(1).max(80),
  category: z.string().min(1).max(40),
  priority: z.enum(["high", "medium", "low"]),
  nodes: z.array(GenNodeSchema).min(2).max(8),
});

export const GenPlanSchema = z.object({
  title: z.string().min(1).max(120),
  branches: z.array(GenBranchSchema).min(2).max(8),
});
export type GenPlan = z.infer<typeof GenPlanSchema>;

/* ─── helpers ─── */

export function nodeProgressFromTasks(tasks: NodeTask[]): number {
  if (!tasks.length) return 0;
  return Math.round((tasks.filter((t) => t.done).length / tasks.length) * 100);
}

export function branchProgress(b: RoadmapBranch): number {
  if (!b.nodes.length) return 0;
  return Math.round(b.nodes.reduce((s, n) => s + (n.status === "done" ? 100 : n.progress), 0) / b.nodes.length);
}

export function overallProgress(doc: RoadmapDoc): number {
  const nodes = doc.branches.flatMap((b) => b.nodes);
  if (!nodes.length) return 0;
  return Math.round(nodes.reduce((s, n) => s + (n.status === "done" ? 100 : n.progress), 0) / nodes.length);
}

/**
 * Recompute node statuses: inside each branch nodes unlock sequentially by
 * phase order; the first not-done node is "current", later ones with met
 * prerequisites are "available" (same phase) or "locked" (future phases
 * beyond the next).
 */
export function recomputeStatuses(doc: RoadmapDoc): RoadmapDoc {
  for (const b of doc.branches) {
    const sorted = [...b.nodes].sort((x, y) => x.phase - y.phase || y.priority.localeCompare(x.priority));
    let currentSet = false;
    let unlockPhase = Infinity;
    for (const n of sorted) {
      if (n.status === "done") continue;
      if (!currentSet) {
        n.status = "current";
        currentSet = true;
        unlockPhase = n.phase + 1;
      } else if (n.phase <= unlockPhase) {
        n.status = "available";
      } else {
        n.status = "locked";
      }
    }
  }
  return doc;
}

export function shortId(): string {
  return Math.random().toString(36).slice(2, 10);
}
