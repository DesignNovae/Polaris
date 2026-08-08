/**
 * Roadmap v2 generator - dynamic, education-level aware, duration aware.
 *
 *   generateRoadmap(profile, config)
 *     → LLM plan (level guidance + duration + hours budget + weak areas +
 *       current scores baked into the prompt), Zod-validated;
 *     → deterministic template fallback so the tree is never empty;
 *     → resources attached topic-wise from the curated library;
 *     → score inputs attached from topic/score-key inference;
 *     → statuses computed (sequential unlock per branch).
 *
 *   applyScoreAdaptation(doc, entry)
 *     → rule-based: weak score boosts matching-topic nodes to high priority
 *       and unlocks remedial focus; logs the adaptation. The Strategist sees
 *       the same doc, so its advice follows automatically.
 *
 *   adaptRoadmap(profile, doc, reason)
 *     → LLM rewrite of all not-done nodes, preserving completed work.
 */

import {
  type RoadmapConfig, type RoadmapDoc, type RoadmapBranch, type RoadmapNode,
  type ScoreEntry, type GenPlan, GenPlanSchema, type BranchCategory,
  phaseCount, phaseLabel, recomputeStatuses, shortId,
} from "./types";
import { resourcesForTopics, KNOWN_TOPICS } from "./resources";
import { templateFor, LEVEL_GUIDANCE, SCORE_DEFS, type TplBranch } from "./templates";
import { completeText, extractJson } from "@/lib/llm/complete";
import { summarizeProfile, type StudentProfile } from "@/lib/profile";
import type { Lang } from "@/lib/i18n/strings";
import { generationLanguageInstruction } from "@/lib/i18n/server";
import { stabilizeGeneratedText } from "@/lib/gemma/output-quality";

/* ─── helpers ─── */

const CATEGORY_TONES: Record<string, RoadmapBranch["tone"]> = {
  Academics: "polaris", SAT: "nova", IELTS: "aurora", Olympiads: "nova",
  ECAs: "rose", Projects: "aurora", Research: "nova", Leadership: "rose",
  Hackathons: "aurora", Applications: "polaris", Scholarships: "aurora",
  Portfolio: "rose", Wellness: "aurora", Foundations: "polaris",
};

const VALID_CATEGORIES = new Set(Object.keys(CATEGORY_TONES));

function normalizeCategory(raw: string): BranchCategory {
  const hit = [...VALID_CATEGORIES].find((c) => c.toLowerCase() === raw.toLowerCase());
  return (hit ?? "Academics") as BranchCategory;
}

/** Infer score input defs from a node's topics. */
function scoreInputsForTopics(topics: string[]): RoadmapNode["scoreInputs"] {
  const keys = new Set<string>();
  for (const t of topics) {
    if (t === "sat-math") keys.add("sat-math");
    else if (t.startsWith("sat-")) keys.add("sat-english");
    else if (t.startsWith("ielts-")) keys.add(t in SCORE_DEFS ? t : "ielts-overall");
    else if (t === "board-prep") keys.add("mock-pct");
    else if (t === "olympiad-math") keys.add("olympiad-score");
  }
  return [...keys].slice(0, 3).map((key) => ({ key, ...SCORE_DEFS[key] }));
}

function buildNode(partial: {
  title: string; description: string; why: string; how: string;
  type: RoadmapNode["type"]; priority: RoadmapNode["priority"];
  difficulty: number; phase: number; hours: number;
  tasks: string[]; topics: string[]; completionCriteria: string; impact: string;
  scoreKeys?: string[];
}): RoadmapNode {
  const topics = partial.topics.filter((t) => KNOWN_TOPICS.includes(t));
  const safeTopics = topics.length ? topics : partial.topics.slice(0, 2);
  const explicitScores = (partial.scoreKeys ?? [])
    .filter((k) => k in SCORE_DEFS)
    .map((key) => ({ key, ...SCORE_DEFS[key] }));
  const title = stabilizeGeneratedText(partial.title);
  const description = stabilizeGeneratedText(partial.description);
  return {
    id: shortId(),
    title,
    description,
    why: stabilizeGeneratedText(partial.why),
    how: stabilizeGeneratedText(partial.how),
    type: partial.type,
    priority: partial.priority,
    difficulty: Math.max(1, Math.min(5, Math.round(partial.difficulty))) as RoadmapNode["difficulty"],
    phase: partial.phase,
    estimatedHoursPerWeek: Math.round(partial.hours * 2) / 2,
    tasks: partial.tasks.map((t) => ({ id: shortId(), text: stabilizeGeneratedText(t), done: false })),
    topics: safeTopics,
    resources: resourcesForTopics(safeTopics),
    scoreInputs: explicitScores.length ? explicitScores : scoreInputsForTopics(safeTopics),
    completionCriteria: stabilizeGeneratedText(partial.completionCriteria),
    strategistContext: `${title}: ${description}`,
    impact: stabilizeGeneratedText(partial.impact),
    status: "locked",
    progress: 0,
    notes: [],
  };
}

/* ─── template fallback ─── */

function fromTemplates(config: RoadmapConfig, phases: number): RoadmapBranch[] {
  const tpl: TplBranch[] = templateFor(config);
  return tpl.map((b) => ({
    id: shortId(),
    title: b.title,
    category: b.category,
    priority: b.priority,
    tone: b.tone,
    nodes: b.nodes.map((n) =>
      buildNode({
        ...n,
        phase: Math.min(phases - 1, Math.floor(n.stage * phases)),
        scoreKeys: n.scoreKeys,
      }),
    ),
  }));
}

/* ─── LLM generation ─── */

function generationPrompt(
  profile: StudentProfile,
  config: RoadmapConfig,
  phases: number,
  language: Lang = "en",
): string {
  const scoreLines = Object.entries(config.currentScores ?? {})
    .map(([k, v]) => `${k}: ${v}`).join(", ") || "(none reported)";
  return [
    `You are Polaris, an elite admissions strategist. Design a personalized roadmap TREE for one student.`,
    generationLanguageInstruction(language),
    language === "bn"
      ? `Translate every human-readable title, description, reason, instruction, task, completion criterion, and impact line into Bengali. Keep JSON keys and the allowed category, type, priority, and topic enum values exactly in English so the data remains valid.`
      : ``,
    ``,
    `STUDENT PROFILE`,
    summarizeProfile(profile),
    ``,
    `SETUP`,
    `Education level: ${config.educationLevel} - ${LEVEL_GUIDANCE[config.educationLevel]}`,
    `Current year: ${config.currentYear ?? "(unspecified)"}`,
    `Main goal: ${config.targetGoal}`,
    `Academic target: ${config.academicTarget ?? "(unspecified)"}`,
    `Plan duration: ${config.durationDays} days, organized as ${phases} ${config.timelineMode} phases (phase indexes 0..${phases - 1}).`,
    `Available time: ${config.availableHoursPerWeek} hours/week TOTAL across everything - the sum of estimatedHoursPerWeek of concurrently-active nodes must respect this.`,
    `Exams in scope: ${config.exams.join(", ") || "none"}`,
    `Self-reported weak areas: ${config.weakAreas ?? "(none)"}`,
    `Current scores: ${scoreLines}`,
    ``,
    `RULES`,
    `1. Branches are categories (use only: Academics, SAT, IELTS, Olympiads, ECAs, Projects, Research, Leadership, Hackathons, Applications, Scholarships, Portfolio, Wellness, Foundations). Only include branches appropriate to the level + exams. NEVER give SAT/Applications branches to early-school or middle-school.`,
    `2. 3–6 branches, 2–5 nodes each. Each node is one concrete mission completable within 1–2 phases.`,
    `3. Every node must teach HOW to finish within the timeframe: "how" is concrete steps; tasks are 2–6 checkable actions; completionCriteria is objectively verifiable; estimatedHoursPerWeek is honest.`,
    `4. Spread nodes across phases 0..${phases - 1}: early = foundations/diagnostics, middle = build, late = consolidate/apply. Short plans (${config.durationDays} days) mean urgent essentials only - cut nice-to-haves.`,
    `5. topics: pick 1–4 tags ONLY from: ${KNOWN_TOPICS.join(", ")}.`,
    `6. Personalize ruthlessly: reference the student's weak areas, scores, and timeline in descriptions. Generic advice is failure.`,
    `7. "impact" is a short profile-impact line like "+ Testing strength".`,
    ``,
    `OUTPUT - ONLY JSON, no prose:`,
    `{ "title": "...", "branches": [ { "title": "...", "category": "...", "priority": "high|medium|low", "nodes": [ { "title","description","why","how","type":"study|practice|project|test|activity|application","priority","difficulty":1-5,"phase":0-${phases - 1},"estimatedHoursPerWeek":n,"tasks":["..."],"topics":["..."],"completionCriteria":"...","impact":"..." } ] } ] }`,
  ].join("\n");
}

function fromGenPlan(plan: GenPlan, phases: number): RoadmapBranch[] {
  return plan.branches.map((b) => {
    const category = normalizeCategory(b.category);
    return {
      id: shortId(),
      title: stabilizeGeneratedText(b.title),
      category,
      priority: b.priority,
      tone: CATEGORY_TONES[category] ?? "polaris",
      nodes: b.nodes.map((n) =>
        buildNode({
          title: n.title, description: n.description, why: n.why, how: n.how,
          type: n.type, priority: n.priority, difficulty: n.difficulty,
          phase: Math.min(phases - 1, n.phase),
          hours: n.estimatedHoursPerWeek,
          tasks: n.tasks, topics: n.topics,
          completionCriteria: n.completionCriteria, impact: n.impact,
        }),
      ),
    };
  });
}

/* ─── public API ─── */

export async function generateRoadmap(
  profile: StudentProfile,
  config: RoadmapConfig,
  opts: { userId?: string; language?: Lang } = {},
): Promise<RoadmapDoc> {
  const phases = phaseCount(config.durationDays, config.timelineMode);

  let branches: RoadmapBranch[] | null = null;
  let title = `${config.targetGoal} - ${config.durationDays}-day plan`;

  const raw = await completeText({
    task: "general",
    userId: opts.userId,
    feature: "roadmap-generate",
    system: generationPrompt(profile, config, phases, opts.language),
    messages: [{ role: "user", content: "Generate the roadmap tree now." }],
    temperature: 0.5,
    maxOutputTokens: 8192,
  });
  if (raw) {
    const parsed = GenPlanSchema.safeParse(extractJson(raw));
    if (parsed.success) {
      branches = fromGenPlan(parsed.data, phases);
      title = stabilizeGeneratedText(parsed.data.title);
    }
  }
  if (!branches) branches = fromTemplates(config, phases);

  // Seed initial scores from setup.
  const scores: ScoreEntry[] = Object.entries(config.currentScores ?? {})
    .filter(([k]) => k in SCORE_DEFS)
    .map(([key, value]) => ({
      key, value,
      label: SCORE_DEFS[key].label,
      max: SCORE_DEFS[key].max,
      at: new Date(),
    }));

  const now = new Date();
  const doc: RoadmapDoc = {
    roadmapId: shortId(),
    title,
    config,
    phases: Array.from({ length: phases }, (_, i) => phaseLabel(config.timelineMode, i)),
    branches,
    scores,
    adaptations: [],
    createdAt: now,
    updatedAt: now,
  };
  return recomputeStatuses(doc);
}

/* ─── score adaptation (rule-based, instant) ─── */

const SCORE_TOPIC: Record<string, string[]> = {
  "sat-math": ["sat-math", "math-foundation"],
  "sat-english": ["sat-reading", "sat-writing", "english-vocab"],
  "sat-total": ["sat-math", "sat-reading", "sat-writing"],
  "ielts-overall": ["ielts-listening", "ielts-reading", "ielts-writing", "ielts-speaking"],
  "ielts-listening": ["ielts-listening"],
  "ielts-reading": ["ielts-reading"],
  "ielts-writing": ["ielts-writing"],
  "ielts-speaking": ["ielts-speaking"],
  "mock-pct": ["board-prep", "study-skills"],
  "board-gpa": ["board-prep", "study-skills"],
  "olympiad-score": ["olympiad-math"],
};

/**
 * Mutates the doc in place: weak score (<60% of max) boosts every
 * matching-topic unfinished node to high priority; falling academics
 * additionally demote ECA-ish branches to low. Returns a description of
 * what changed (or null if nothing did).
 */
export function applyScoreAdaptation(doc: RoadmapDoc, entry: ScoreEntry): string | null {
  const ratio = entry.value / entry.max;
  const topics = SCORE_TOPIC[entry.key] ?? [];
  if (!topics.length) return null;

  const changes: string[] = [];

  if (ratio < 0.6) {
    for (const b of doc.branches) {
      for (const n of b.nodes) {
        if (n.status === "done") continue;
        if (n.topics.some((t) => topics.includes(t)) && n.priority !== "high") {
          n.priority = "high";
          changes.push(`Prioritized "${n.title}"`);
        }
      }
    }
    // Academic slide → protect grades: demote ECA-flavored branches.
    if (entry.key === "mock-pct" || entry.key === "board-gpa") {
      for (const b of doc.branches) {
        if (["ECAs", "Hackathons", "Olympiads", "Leadership"].includes(b.category) && b.priority !== "low") {
          b.priority = "low";
          changes.push(`Reduced "${b.title}" load to protect academics`);
        }
      }
    }
  } else if (ratio >= 0.85) {
    changes.push(`Strong ${entry.label} (${entry.value}/${entry.max}) - keep momentum`);
  }

  if (!changes.length) return null;
  const summary = `${entry.label} ${entry.value}/${entry.max}: ${changes.slice(0, 3).join("; ")}${changes.length > 3 ? ` +${changes.length - 3} more` : ""}`;
  doc.adaptations.push({ id: shortId(), reason: summary, at: new Date() });
  doc.updatedAt = new Date();
  return summary;
}

/* ─── full adaptive replan (LLM) ─── */

export async function adaptRoadmap(
  profile: StudentProfile,
  doc: RoadmapDoc,
  reason?: string,
  opts: { userId?: string; language?: Lang } = {},
): Promise<RoadmapDoc | null> {
  const phases = doc.phases.length;
  const done = doc.branches.flatMap((b) => b.nodes.filter((n) => n.status === "done"));
  const scoreLines = doc.scores.slice(-8).map((s) => `${s.label}: ${s.value}/${s.max}`).join(", ") || "(none)";
  const noteLines = doc.branches
    .flatMap((b) => b.nodes.flatMap((n) => n.notes.slice(-1).map((x) => `[${n.title}] ${x.text}`)))
    .slice(-8);

  const system = [
    generationPrompt(profile, doc.config, phases, opts.language),
    ``,
    `THIS IS AN ADAPTIVE REPLAN of an existing roadmap, not a fresh start.`,
    `COMPLETED (do not repeat these - build on them):`,
    done.length ? done.map((n) => `- ${n.title}`).join("\n") : "(nothing yet)",
    `RECENT SCORES: ${scoreLines}`,
    noteLines.length ? `STUDENT NOTES:\n${noteLines.join("\n")}` : ``,
    reason ? `STUDENT'S REQUEST: ${reason}` : ``,
    `Rewrite the remaining plan to address weaknesses and the student's request.`,
  ].join("\n");

  const raw = await completeText({
    task: "general",
    userId: opts.userId,
    feature: "roadmap-adapt",
    system,
    messages: [{ role: "user", content: "Adapt the roadmap now." }],
    temperature: 0.5,
    maxOutputTokens: 8192,
  });
  if (!raw) return null;
  const parsed = GenPlanSchema.safeParse(extractJson(raw));
  if (!parsed.success) return null;

  const fresh = fromGenPlan(parsed.data, phases);

  // Preserve completed nodes: re-attach them to the matching category branch
  // (or keep their original branch if the category vanished).
  for (const b of doc.branches) {
    const doneNodes = b.nodes.filter((n) => n.status === "done");
    if (!doneNodes.length) continue;
    const target = fresh.find((f) => f.category === b.category);
    if (target) target.nodes.unshift(...doneNodes);
    else fresh.push({ ...b, nodes: doneNodes });
  }

  doc.branches = fresh;
  doc.title = parsed.data.title || doc.title;
  doc.adaptations.push({
    id: shortId(),
    reason: reason ? `Replan: ${reason.slice(0, 140)}` : "Strategist adaptive replan",
    at: new Date(),
  });
  doc.updatedAt = new Date();
  return recomputeStatuses(doc);
}

/* ─── Strategist context ─── */

/** Compact lines describing the live roadmap for the Strategist's prompt. */
export function roadmapContextLines(doc: RoadmapDoc, maxLines = 16): string[] {
  const lines: string[] = [];
  const nodes = doc.branches.flatMap((b) => b.nodes);
  const doneN = nodes.filter((n) => n.status === "done").length;
  lines.push(
    `ROADMAP "${doc.title}" - level ${doc.config.educationLevel}, ${doc.config.durationDays} days (${doc.phases.length} ${doc.config.timelineMode} phases), goal: ${doc.config.targetGoal}. Progress ${doneN}/${nodes.length} nodes done.`,
  );
  for (const b of doc.branches) {
    if (lines.length >= maxLines) break;
    const current = b.nodes.find((n) => n.status === "current");
    if (current) {
      lines.push(`[${b.category}] CURRENT: ${current.title} (${current.progress}%, ${doc.phases[current.phase] ?? `phase ${current.phase}`}) - ${current.completionCriteria}`);
    }
  }
  const recentScores = doc.scores.slice(-4);
  if (recentScores.length) {
    lines.push(`RECENT SCORES: ${recentScores.map((s) => `${s.label} ${s.value}/${s.max}`).join(", ")}`);
  }
  const lastAdapt = doc.adaptations.slice(-1)[0];
  if (lastAdapt) lines.push(`LAST ADAPTATION: ${lastAdapt.reason}`);
  return lines.slice(0, maxLines);
}
