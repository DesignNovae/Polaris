/**
 * Duration-aware roadmap scheduling.
 *
 * The tree is still the overview, but this module owns the detailed schedule:
 * a master plan supplies high-level mission briefs and bounded expansion calls
 * fill the actual day/week/month units. A failed expansion is replaced by a
 * deterministic unit, so a saved new roadmap can never contain a blank unit.
 */

import { z } from "zod";
import {
  type RoadmapConfig,
  type RoadmapDoc,
  type RoadmapBranch,
  type RoadmapNode,
  type RoadmapSchedule,
  type RoadmapScheduleUnit,
  type RoadmapWeek,
  type RoadmapMonth,
  type NodeTask,
  type ScoreEntry,
  phaseCount,
  phaseLabel,
  recomputeStatuses,
  shortId,
} from "./types";
import { completeText, extractJson } from "@/lib/llm/complete";
import { summarizeProfile, type StudentProfile } from "@/lib/profile";
import { generationLanguageInstruction } from "@/lib/i18n/server";
import type { Lang } from "@/lib/i18n/strings";
import { LEVEL_GUIDANCE, SCORE_DEFS } from "./templates";
import { KNOWN_TOPICS, resourcesForTopics } from "./resources";
import { stabilizeGeneratedText } from "@/lib/gemma/output-quality";

const TONES: Record<string, RoadmapBranch["tone"]> = {
  Academics: "polaris", SAT: "nova", IELTS: "aurora", Olympiads: "nova",
  ECAs: "rose", Projects: "aurora", Research: "nova", Leadership: "rose",
  Hackathons: "aurora", Applications: "polaris", Scholarships: "aurora",
  Portfolio: "rose", Wellness: "aurora", Foundations: "polaris",
};
const CATEGORIES = Object.keys(TONES);
const FALLBACK_FOCUSES = [
  { title: "Diagnostic and baseline", category: "Academics", topic: "study-skills" },
  { title: "Core skill building", category: "Academics", topic: "math-foundation" },
  { title: "Timed practice cycle", category: "SAT", topic: "sat-math" },
  { title: "Proof of work project", category: "Projects", topic: "project-building" },
  { title: "Communication and profile", category: "Portfolio", topic: "english-vocab" },
  { title: "Review and next benchmark", category: "Academics", topic: "study-skills" },
];

const MissionSchema = z.object({
  key: z.string().min(1).max(70).optional(),
  title: z.string().min(1).max(140),
  description: z.string().min(1).max(600),
  why: z.string().min(1).max(600),
  how: z.string().min(1).max(900),
  category: z.string().min(1).max(40),
  type: z.enum(["study", "practice", "project", "test", "activity", "application"]),
  priority: z.enum(["high", "medium", "low"]),
  difficulty: z.number().int().min(1).max(5),
  estimatedHoursPerWeek: z.number().min(0.5).max(40),
  topics: z.array(z.string().min(1).max(40)).min(1).max(5),
  completionCriteria: z.string().min(1).max(300),
  impact: z.string().min(1).max(160),
});
type MissionBrief = z.infer<typeof MissionSchema> & { key: string };

const MonthMasterSchema = z.object({
  index: z.number().int().min(0).max(11),
  title: z.string().min(1).max(140),
  objective: z.string().min(1).max(500),
  missions: z.array(MissionSchema).min(1).max(3),
});
const MasterUnitSchema = z.object({
  index: z.number().int().min(0).max(364),
  title: z.string().min(1).max(140),
  objective: z.string().min(1).max(500),
  missions: z.array(MissionSchema).min(1).max(3),
  months: z.array(MonthMasterSchema).length(12).optional(),
});
const MasterSchema = z.object({
  title: z.string().min(1).max(140),
  units: z.array(MasterUnitSchema).min(1).max(365),
});
type MasterUnit = z.infer<typeof MasterUnitSchema>;
type MasterPlan = z.infer<typeof MasterSchema>;

const ExpansionTaskSchema = z.object({
  missionKey: z.string().min(1).max(70),
  text: z.string().min(1).max(240),
});
const ExpandedWeekSchema = z.object({
  weekIndex: z.number().int().min(0).max(3),
  title: z.string().min(1).max(140),
  objective: z.string().min(1).max(500),
  tasks: z.array(ExpansionTaskSchema).min(1).max(12),
});
const MonthExpansionSchema = z.object({
  unitIndex: z.number().int().min(0).max(364),
  weeks: z.array(ExpandedWeekSchema).length(4),
});
const WeekExpansionSchema = z.object({
  unitIndex: z.number().int().min(0).max(364),
  objective: z.string().min(1).max(500),
  tasks: z.array(ExpansionTaskSchema).min(1).max(12),
});
const DayExpansionSchema = z.object({
  days: z.array(z.object({
    dayIndex: z.number().int().min(0).max(364),
    tasks: z.array(ExpansionTaskSchema).min(1).max(8),
  })).min(1).max(5),
});

type MissionRecord = {
  key: string;
  brief: MissionBrief;
  node?: RoadmapNode;
  unitIndex: number;
  yearIndex?: number;
  monthIndex?: number;
};

type ScheduleCallState = { providerUnavailable: boolean };
type ScheduleOpts = { userId?: string; language?: Lang; state?: ScheduleCallState };

function category(raw: string): RoadmapBranch["category"] {
  const found = CATEGORIES.find((x) => x.toLowerCase() === raw.toLowerCase());
  return (found ?? "Academics") as RoadmapBranch["category"];
}

/** Keep the visual tree semantically honest when the model assigns a loose
 * branch label. HSC/board work must never appear under SAT or IELTS. */
function categoryFromSignals(rawValue: string, text: string): RoadmapBranch["category"] {
  const raw = category(rawValue);
  const hasHsc = /\bhsc\b|\bboard\b|\bgpa\b|syllabus|a[- ]?level|o[- ]?level/.test(text);
  const hasSat = /\bsat\b|sat-math|sat-reading|sat-writing/.test(text);
  const hasIelts = /\bielts\b|ielts-/.test(text);
  const hasOlympiad = /\bolympiad\b|olympiad-/.test(text);

  if (hasHsc) return "Academics";
  if (raw === "SAT" && !hasSat) return "Academics";
  if (raw === "IELTS" && !hasIelts) return "Academics";
  if (raw === "Olympiads" && !hasOlympiad) return "Academics";
  return raw;
}

function missionCategory(brief: MissionBrief): RoadmapBranch["category"] {
  return categoryFromSignals(brief.category, `${brief.title} ${brief.description} ${brief.why} ${brief.how} ${brief.topics.join(" ")}`.toLowerCase());
}

function validTopics(raw: string[], fallback: string): string[] {
  const topics = raw.filter((x) => KNOWN_TOPICS.includes(x));
  return topics.length ? topics.slice(0, 5) : [fallback];
}

function scoreInputs(topics: string[]): RoadmapNode["scoreInputs"] {
  const keys = new Set<string>();
  for (const topic of topics) {
    if (topic === "sat-math") keys.add("sat-math");
    else if (topic.startsWith("sat-")) keys.add("sat-english");
    else if (topic.startsWith("ielts-")) keys.add(topic in SCORE_DEFS ? topic : "ielts-overall");
    else if (topic === "board-prep") keys.add("mock-pct");
    else if (topic === "olympiad-math") keys.add("olympiad-score");
  }
  return [...keys].slice(0, 3).map((key) => ({ key, ...SCORE_DEFS[key] }));
}

function missionNode(brief: MissionBrief, phase: number): RoadmapNode {
  const topics = validTopics(brief.topics, "study-skills");
  const title = stabilizeGeneratedText(brief.title);
  return {
    id: shortId(),
    title,
    description: stabilizeGeneratedText(brief.description),
    why: stabilizeGeneratedText(brief.why),
    how: stabilizeGeneratedText(brief.how),
    type: brief.type,
    priority: brief.priority,
    difficulty: brief.difficulty as RoadmapNode["difficulty"],
    phase,
    estimatedHoursPerWeek: Math.round(brief.estimatedHoursPerWeek * 2) / 2,
    tasks: [],
    topics,
    resources: resourcesForTopics(topics),
    scoreInputs: scoreInputs(topics),
    completionCriteria: stabilizeGeneratedText(brief.completionCriteria),
    strategistContext: `${title}: ${stabilizeGeneratedText(brief.description)}`,
    impact: stabilizeGeneratedText(brief.impact),
    status: "locked",
    progress: 0,
    notes: [],
  };
}

function fallbackMission(config: RoadmapConfig, unitIndex: number, monthIndex?: number): MissionBrief {
  const focus = FALLBACK_FOCUSES[(unitIndex + (monthIndex ?? 0)) % FALLBACK_FOCUSES.length];
  const examTopic = config.exams.includes("SAT") ? "sat-math" : focus.topic;
  return {
    key: `fallback-${unitIndex}-${monthIndex ?? "unit"}`,
    title: `${focus.title}: ${config.targetGoal.slice(0, 56)}`,
    description: `Build a measurable ${focus.title.toLowerCase()} foundation for ${config.targetGoal}.`,
    why: `This creates evidence of steady progress toward ${config.targetGoal}.`,
    how: "Set a baseline, follow the weekly practice loop, and record the result before moving on.",
    category: focus.category,
    type: focus.category === "Projects" ? "project" : "study",
    priority: unitIndex < 2 ? "high" : "medium",
    difficulty: 3,
    estimatedHoursPerWeek: Math.max(1, Math.min(8, Math.round(config.availableHoursPerWeek / 3))),
    topics: [examTopic],
    completionCriteria: "Complete the scheduled tasks and record one concrete result or artifact.",
    impact: "+ Consistent academic progress",
  };
}

function fallbackMaster(profile: StudentProfile, config: RoadmapConfig, count: number): MasterPlan {
  const units: MasterUnit[] = [];
  for (let i = 0; i < count; i++) {
    const missions = Array.from({ length: config.timelineMode === "monthly" && i % 3 === 0 ? 3 : (i % 2 ? 2 : 1) }, (_, j) => ({
      ...fallbackMission(config, i, j),
      key: `fallback-${i}-${j}`,
    }));
    if (config.timelineMode !== "yearly") {
      units.push({ index: i, title: phaseLabel(config.timelineMode, i), objective: `Make reliable progress during ${phaseLabel(config.timelineMode, i)}.`, missions });
      continue;
    }
    const months = Array.from({ length: 12 }, (_, monthIndex) => ({
      index: monthIndex,
      title: `Month ${monthIndex + 1}`,
      objective: `Build the next layer of the ${i === 0 ? "foundation" : "long-term profile"}.`,
      missions: [{ ...fallbackMission(config, i * 12 + monthIndex, 0), key: `fallback-${i}-${monthIndex}` }],
    }));
    units.push({ index: i, title: `Year ${i + 1}`, objective: i === 0 ? "Build the first complete year of progress." : "Extend the profile with broader milestones.", missions, months });
  }
  void profile;
  return { title: `${config.targetGoal} - ${config.durationDays}-day plan`, units };
}

function masterPrompt(profile: StudentProfile, config: RoadmapConfig, count: number, language?: Lang): string {
  const yearly = config.timelineMode === "yearly";
  const scoreLines = Object.entries(config.currentScores ?? {}).map(([k, v]) => `${k}: ${v}`).join(", ") || "(none reported)";
  return [
    "You are Polaris, an elite admissions strategist. Return a duration-aware schedule master plan.",
    generationLanguageInstruction(language ?? "en"),
    language === "bn" ? "Translate human-readable values into Bengali. Keep JSON keys and enum values in English." : "",
    "STUDENT PROFILE", summarizeProfile(profile),
    "SETUP",
    `Education: ${config.educationLevel} - ${LEVEL_GUIDANCE[config.educationLevel]}`,
    `Goal: ${config.targetGoal}`,
    `Duration: ${config.durationDays} days, mode ${config.timelineMode}, exactly ${count} top-level units.`,
    `Hours available: ${config.availableHoursPerWeek}/week. Exams: ${config.exams.join(", ") || "none"}. Weak areas: ${config.weakAreas ?? "none"}. Scores: ${scoreLines}.`,
    yearly
      ? "For every year unit include exactly twelve month objects. Year 1 months are detailed; later years are only broad summary missions and will be expanded later."
      : config.timelineMode === "monthly"
        ? "For every month unit include 1-3 missions. These missions will receive exactly four weekly expansions."
        : "For every day or week unit include at least one mission. Each unit will receive a task expansion.",
    "Use zero-based indexes. Mission keys must be unique across the whole response.",
    `Allowed categories: ${CATEGORIES.join(", ")}. Allowed topics: ${KNOWN_TOPICS.join(", ")}.`,
    "Every mission must be concrete and personalized. Do not add filler just to increase length.",
    "OUTPUT ONLY JSON. Shape:",
    yearly
      ? '{"title":"...","units":[{"index":0,"title":"Year 1","objective":"...","missions":[{mission fields}],"months":[{"index":0,"title":"Month 1","objective":"...","missions":[{mission fields}]}]}]}'
      : '{"title":"...","units":[{"index":0,"title":"...","objective":"...","missions":[{mission fields}]}]}',
    'Mission fields: {"key":"unique-key","title":"...","description":"...","why":"...","how":"...","category":"Academics","type":"study|practice|project|test|activity|application","priority":"high|medium|low","difficulty":3,"estimatedHoursPerWeek":4,"topics":["valid-topic"],"completionCriteria":"...","impact":"..."}',
  ].filter(Boolean).join("\n");
}

async function callJson<T>(
  label: string,
  schema: z.ZodType<T>,
  system: string,
  user: string,
  opts: { userId?: string; maxOutputTokens?: number; state?: ScheduleCallState } = {},
): Promise<T | null> {
  if (opts.state?.providerUnavailable) return null;
  for (let attempt = 0; attempt < 2; attempt++) {
    let raw: string | null = null;
    try {
      raw = await completeText({
        task: "general",
        userId: opts.userId,
        feature: `roadmap-schedule-${label}`,
        system,
        messages: [{ role: "user", content: attempt ? `${user}\nRetry: return only valid JSON matching the requested schema.` : user }],
        temperature: 0.35,
        maxOutputTokens: opts.maxOutputTokens ?? 5000,
        thinkingLevel: "minimal",
      });
    } catch (error) {
      // completeText normally converts provider failures to null. Keep this
      // boundary defensive because a router/provider change must never abort
      // roadmap creation.
      console.warn(`Roadmap schedule ${label} provider unavailable: ${error instanceof Error ? error.message : String(error)}`);
    }
    const parsed = raw ? schema.safeParse(extractJson(raw)) : null;
    if (parsed?.success) return parsed.data;
    if (!raw && opts.state) {
      opts.state.providerUnavailable = true;
      console.warn(`Roadmap schedule ${label}: using deterministic fallback.`);
      return null;
    }
    console.warn(`Roadmap schedule ${label} response invalid on attempt ${attempt + 1}`);
  }
  return null;
}

function normalizedMission(brief: z.infer<typeof MissionSchema>, key: string): MissionBrief {
  return { ...brief, key };
}

function normalizeMaster(raw: MasterPlan, config: RoadmapConfig, count: number): MasterPlan | null {
  if (raw.units.length !== count) return null;
  const units = Array.from({ length: count }, (_, i) => raw.units.find((u) => u.index === i));
  if (units.some((u) => !u)) return null;
  if (config.timelineMode === "yearly" && units.some((u) => !u?.months || u.months.length !== 12)) return null;
  const seen = new Set<string>();
  for (const unit of units) {
    const missions = [...(unit?.missions ?? []), ...(unit?.months?.flatMap((m) => m.missions) ?? [])];
    for (const mission of missions) {
      const key = mission.key ?? `${unit?.index ?? 0}-${mission.title}`;
      if (seen.has(key)) return null;
      seen.add(key);
    }
  }
  return { ...raw, units: units as MasterUnit[] };
}

function emptyWeeks(): RoadmapWeek[] {
  return Array.from({ length: 4 }, (_, i) => ({ weekIndex: i, title: `Week ${i + 1}`, objective: "Complete the next small, measurable step.", taskIds: [] }));
}

function addTask(node: RoadmapNode, text: string, coords: Omit<NodeTask, "id" | "text" | "done" | "missionId">): string {
  const task: NodeTask = { id: shortId(), text: stabilizeGeneratedText(text), done: false, missionId: node.id, ...coords };
  node.tasks.push(task);
  return task.id;
}

function missionLine(m: MissionRecord): string {
  return `- key=${m.key}; title=${m.brief.title}; objective=${m.brief.description}; how=${m.brief.how}`;
}

function fallbackMonthExpansion(unitIndex: number, missions: MissionRecord[]): z.infer<typeof MonthExpansionSchema> {
  return {
    unitIndex,
    weeks: Array.from({ length: 4 }, (_, weekIndex) => ({
      weekIndex,
      title: `Week ${weekIndex + 1}: ${weekIndex === 0 ? "start" : weekIndex === 3 ? "review" : "build"}`,
      objective: weekIndex === 3 ? "Review evidence and close the loop." : "Complete the scheduled practice and record evidence.",
      tasks: missions.map((m) => ({ missionKey: m.key, text: `${m.brief.title}: complete the Week ${weekIndex + 1} action and record the result.` })),
    })),
  };
}

function fallbackWeekExpansion(unitIndex: number, missions: MissionRecord[]): z.infer<typeof WeekExpansionSchema> {
  return {
    unitIndex,
    objective: "Complete the highest-leverage actions and capture evidence.",
    tasks: missions.map((m) => ({ missionKey: m.key, text: `${m.brief.title}: complete one measurable action and log the result.` })),
  };
}

function fallbackDayBatch(days: number[], missionsByDay: Map<number, MissionRecord[]>): z.infer<typeof DayExpansionSchema> {
  return { days: days.map((dayIndex) => ({
    dayIndex,
    tasks: (missionsByDay.get(dayIndex) ?? []).map((m) => ({ missionKey: m.key, text: `${m.brief.title}: complete today's focused action and note what changed.` })),
  })) };
}

async function expandMonthlyUnit(
  profile: StudentProfile,
  config: RoadmapConfig,
  unit: RoadmapScheduleUnit,
  missions: MissionRecord[],
  opts: ScheduleOpts,
): Promise<z.infer<typeof MonthExpansionSchema>> {
  const system = [
    "You expand one roadmap month into four fixed planning weeks.",
    generationLanguageInstruction(opts.language ?? "en"),
    `Month index ${unit.unitIndex}, title ${unit.title}, objective ${unit.objective}.`,
    "Return exactly four weeks with at least one checkable task in every week.",
    "Every task missionKey must exactly match one of the supplied mission keys.",
    "Tasks must be specific actions, not vague advice. Keep the total workload realistic.",
    `Student context: ${summarizeProfile(profile)}; goal: ${config.targetGoal}; hours/week: ${config.availableHoursPerWeek}.`,
    `MISSIONS\n${missions.map(missionLine).join("\n")}`,
    'OUTPUT ONLY JSON: {"unitIndex":0,"weeks":[{"weekIndex":0,"title":"...","objective":"...","tasks":[{"missionKey":"...","text":"..."}]}]}',
  ].join("\n");
  const ai = await callJson(`month-${unit.unitIndex}`, MonthExpansionSchema, system, "Expand this month now.", { userId: opts.userId, maxOutputTokens: 3600, state: opts.state });
  if (!ai || ai.unitIndex !== unit.unitIndex || ai.weeks.some((w) => w.weekIndex !== ai.weeks.findIndex((x) => x === w))) {
    return fallbackMonthExpansion(unit.unitIndex, missions);
  }
  const keys = new Set(missions.map((m) => m.key));
  if (ai.weeks.some((w) => w.tasks.some((t) => !keys.has(t.missionKey)))) return fallbackMonthExpansion(unit.unitIndex, missions);
  return ai;
}

async function expandWeeklyUnit(
  profile: StudentProfile,
  config: RoadmapConfig,
  unit: RoadmapScheduleUnit,
  missions: MissionRecord[],
  opts: ScheduleOpts,
): Promise<z.infer<typeof WeekExpansionSchema>> {
  const system = [
    "You expand one roadmap week into concrete checkable tasks.",
    generationLanguageInstruction(opts.language ?? "en"),
    `Week index ${unit.unitIndex}, title ${unit.title}, objective ${unit.objective}.`,
    "Return at least one task and use only the supplied mission keys.",
    `Student context: ${summarizeProfile(profile)}; goal: ${config.targetGoal}; hours/week: ${config.availableHoursPerWeek}.`,
    `MISSIONS\n${missions.map(missionLine).join("\n")}`,
    'OUTPUT ONLY JSON: {"unitIndex":0,"objective":"...","tasks":[{"missionKey":"...","text":"..."}]}',
  ].join("\n");
  const ai = await callJson(`week-${unit.unitIndex}`, WeekExpansionSchema, system, "Expand this week now.", { userId: opts.userId, maxOutputTokens: 2800, state: opts.state });
  const keys = new Set(missions.map((m) => m.key));
  if (!ai || ai.unitIndex !== unit.unitIndex || ai.tasks.some((t) => !keys.has(t.missionKey))) return fallbackWeekExpansion(unit.unitIndex, missions);
  return ai;
}

async function expandDailyBatch(
  profile: StudentProfile,
  config: RoadmapConfig,
  days: number[],
  missionsByDay: Map<number, MissionRecord[]>,
  opts: ScheduleOpts,
): Promise<z.infer<typeof DayExpansionSchema>> {
  const missionText = days.flatMap((d) => (missionsByDay.get(d) ?? []).map(missionLine)).join("\n");
  const system = [
    "You expand a short daily roadmap batch.",
    generationLanguageInstruction(opts.language ?? "en"),
    `Return exactly one day object for each requested day: ${days.join(", ")}.`,
    "Every day must have at least one specific task. Use only the supplied mission keys.",
    `Student context: ${summarizeProfile(profile)}; goal: ${config.targetGoal}.`,
    `MISSIONS\n${missionText}`,
    'OUTPUT ONLY JSON: {"days":[{"dayIndex":0,"tasks":[{"missionKey":"...","text":"..."}]}]}',
  ].join("\n");
  const ai = await callJson(`days-${days[0]}`, DayExpansionSchema, system, "Expand these days now.", { userId: opts.userId, maxOutputTokens: 3000, state: opts.state });
  const expected = new Set(days);
  const keys = new Set(days.flatMap((d) => (missionsByDay.get(d) ?? []).map((m) => m.key)));
  if (!ai || ai.days.length !== days.length || ai.days.some((d) => !expected.has(d.dayIndex) || d.tasks.some((t) => !keys.has(t.missionKey)))) {
    return fallbackDayBatch(days, missionsByDay);
  }
  return ai;
}

function makeBranches(records: MissionRecord[]): RoadmapBranch[] {
  const byCategory = new Map<string, RoadmapBranch>();
  for (const record of records) {
    if (!record.node) continue;
    const cat = missionCategory(record.brief);
    let branch = byCategory.get(cat);
    if (!branch) {
      branch = { id: shortId(), title: cat, category: cat, priority: record.brief.priority, tone: TONES[cat] ?? "polaris", nodes: [] };
      byCategory.set(cat, branch);
    }
    branch.nodes.push(record.node);
  }
  return [...byCategory.values()];
}

/** Repair only semantic branch placement in an already-saved roadmap. It
 * preserves every node id, task, progress value, schedule coordinate, and
 * note; this is a non-destructive cleanup for documents created before the
 * category guard existed. */
export function repairRoadmapCategories(doc: RoadmapDoc): { doc: RoadmapDoc; changed: boolean } {
  let changed = false;
  const grouped = new Map<string, RoadmapBranch>();
  for (const branch of doc.branches) {
    for (const node of branch.nodes) {
      const inferred = categoryFromSignals(branch.category, `${node.title} ${node.description} ${node.why} ${node.how} ${node.topics.join(" ")}`.toLowerCase());
      if (inferred !== branch.category) changed = true;
      let target = grouped.get(inferred);
      if (!target) {
        target = {
          id: branch.category === inferred ? branch.id : shortId(),
          title: branch.category === inferred ? branch.title : inferred,
          category: inferred,
          priority: branch.priority,
          tone: TONES[inferred] ?? "polaris",
          nodes: [],
        };
        grouped.set(inferred, target);
      }
      target.nodes.push(node);
    }
  }
  if (!changed) return { doc, changed: false };
  doc.branches = [...grouped.values()];
  doc.updatedAt = new Date();
  return { doc: recomputeStatuses(doc), changed: true };
}

function missionBriefSummary(records: MissionRecord[]): Array<{ id: string; title: string; objective: string }> {
  return records.map((r) => ({ id: r.key, title: r.brief.title, objective: r.brief.description }));
}

function createScoreEntries(config: RoadmapConfig): ScoreEntry[] {
  return Object.entries(config.currentScores ?? {}).filter(([k]) => k in SCORE_DEFS).map(([key, value]) => ({
    key, value, label: SCORE_DEFS[key].label, max: SCORE_DEFS[key].max, at: new Date(),
  }));
}

function indexMasterMission(brief: z.infer<typeof MissionSchema>, unitIndex: number, localIndex: number): MissionBrief {
  return normalizedMission(brief, brief.key ?? `mission-${unitIndex}-${localIndex}`);
}

type Materialized = { records: MissionRecord[]; schedule: RoadmapSchedule; branches: RoadmapBranch[] };

function materializeMaster(master: MasterPlan, config: RoadmapConfig, detailLimit: number): Materialized {
  const records: MissionRecord[] = [];
  const units: RoadmapScheduleUnit[] = [];
  const yearly = config.timelineMode === "yearly";

  for (const masterUnit of master.units) {
    if (!yearly) {
      const expanded = masterUnit.index < detailLimit;
      const briefRecords: MissionRecord[] = masterUnit.missions.map((m, j) => ({ key: m.key ?? `mission-${masterUnit.index}-${j}`, brief: indexMasterMission(m, masterUnit.index, j), unitIndex: masterUnit.index }));
      const unit: RoadmapScheduleUnit = {
        unitIndex: masterUnit.index,
        label: phaseLabel(config.timelineMode, masterUnit.index),
        title: stabilizeGeneratedText(masterUnit.title),
        objective: stabilizeGeneratedText(masterUnit.objective),
        detailState: expanded ? "expanded" : "deferred",
        missionIds: [],
        ...(expanded ? {} : { missionBriefs: missionBriefSummary(briefRecords) }),
        ...(config.timelineMode === "monthly" && expanded ? { weeks: emptyWeeks() } : {}),
        ...(config.timelineMode === "monthly" && !expanded ? { yearIndex: Math.floor(masterUnit.index / 12) } : {}),
      };
      if (expanded) {
        for (const record of briefRecords) {
          record.node = missionNode(record.brief, masterUnit.index);
          record.node.phase = masterUnit.index;
          records.push(record);
          unit.missionIds.push(record.node.id);
        }
      }
      units.push(unit);
      continue;
    }

    const expandedYear = masterUnit.index < detailLimit;
    const months = masterUnit.months ?? [];
    const unit: RoadmapScheduleUnit = {
      unitIndex: masterUnit.index,
      yearIndex: masterUnit.index,
      label: phaseLabel("yearly", masterUnit.index),
      title: stabilizeGeneratedText(masterUnit.title),
      objective: stabilizeGeneratedText(masterUnit.objective),
      detailState: expandedYear ? "expanded" : "deferred",
      missionIds: [],
      ...(!expandedYear ? { missionBriefs: missionBriefSummary(masterUnit.missions.map((m, j) => ({ key: m.key ?? `year-${masterUnit.index}-${j}`, brief: indexMasterMission(m, masterUnit.index, j), unitIndex: masterUnit.index }))) } : {}),
    };
    if (expandedYear) {
      unit.months = months.map((month) => {
        const monthRecords: MissionRecord[] = month.missions.map((m, j) => ({
          key: m.key ?? `mission-${masterUnit.index}-${month.index}-${j}`,
          brief: indexMasterMission(m, masterUnit.index * 12 + month.index, j),
          unitIndex: masterUnit.index,
          yearIndex: masterUnit.index,
          monthIndex: month.index,
        }));
        const meta: RoadmapMonth = { monthIndex: month.index, title: stabilizeGeneratedText(month.title), objective: stabilizeGeneratedText(month.objective), missionIds: [], weeks: emptyWeeks() };
        for (const record of monthRecords) {
          record.node = missionNode(record.brief, masterUnit.index);
          records.push(record);
          meta.missionIds.push(record.node.id);
          unit.missionIds.push(record.node.id);
        }
        return meta;
      });
    }
    units.push(unit);
  }

  return {
    records,
    schedule: { version: 1, mode: config.timelineMode, durationDays: config.durationDays, units, generatedAt: new Date() },
    branches: makeBranches(records),
  };
}

function recordMap(records: MissionRecord[]): Map<string, MissionRecord> {
  return new Map(records.map((r) => [r.key, r]));
}

function applyMonthlyExpansion(result: z.infer<typeof MonthExpansionSchema>, unit: RoadmapScheduleUnit, records: MissionRecord[]) {
  const byKey = recordMap(records);
  const weeks: RoadmapWeek[] = result.weeks.sort((a, b) => a.weekIndex - b.weekIndex).map((week) => ({ weekIndex: week.weekIndex, title: stabilizeGeneratedText(week.title), objective: stabilizeGeneratedText(week.objective), taskIds: [] }));
  for (const [weekPosition, week] of result.weeks.entries()) {
    const meta = weeks[weekPosition];
    for (const task of week.tasks) {
      const record = byKey.get(task.missionKey);
      if (!record?.node) continue;
      meta.taskIds.push(addTask(record.node, task.text, { unitIndex: unit.unitIndex, yearIndex: unit.yearIndex, monthIndex: unit.yearIndex === undefined ? unit.unitIndex : record.monthIndex, weekIndex: week.weekIndex }));
    }
  }
  // If the model omitted a mission, attach one deterministic task so all
  // monthly missions remain represented in the shared task source.
  for (const record of records) {
    if (!record.node || record.node.tasks.length) continue;
    const week = weeks[0];
    week.taskIds.push(addTask(record.node, `${record.brief.title}: complete the first measurable action and record evidence.`, { unitIndex: unit.unitIndex, yearIndex: unit.yearIndex, monthIndex: unit.yearIndex === undefined ? unit.unitIndex : record.monthIndex, weekIndex: 0 }));
  }
  unit.weeks = weeks;
  if (unit.months) {
    const month = unit.months.find((m) => m.monthIndex === records[0]?.monthIndex);
    if (month) month.weeks = weeks;
  }
}

function applyWeeklyExpansion(result: z.infer<typeof WeekExpansionSchema>, unit: RoadmapScheduleUnit, records: MissionRecord[]) {
  const byKey = recordMap(records);
  for (const task of result.tasks) {
    const record = byKey.get(task.missionKey);
    if (!record?.node) continue;
    addTask(record.node, task.text, { unitIndex: unit.unitIndex, yearIndex: unit.yearIndex });
  }
  for (const record of records) {
    if (record.node && !record.node.tasks.length) addTask(record.node, `${record.brief.title}: complete the scheduled action and record the result.`, { unitIndex: unit.unitIndex, yearIndex: unit.yearIndex });
  }
}

function applyDailyExpansion(result: z.infer<typeof DayExpansionSchema>, units: RoadmapScheduleUnit[], records: MissionRecord[]) {
  const byKey = recordMap(records);
  for (const day of result.days) {
    const dayRecords = records.filter((r) => r.unitIndex === day.dayIndex);
    for (const task of day.tasks) {
      const record = byKey.get(task.missionKey);
      if (!record?.node) continue;
      addTask(record.node, task.text, { unitIndex: day.dayIndex, dayIndex: day.dayIndex });
    }
    for (const record of dayRecords) {
      if (record.node && !record.node.tasks.length) addTask(record.node, `${record.brief.title}: complete today's focused action and log the result.`, { unitIndex: day.dayIndex, dayIndex: day.dayIndex });
    }
  }
  void units;
}

async function mapBounded<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const output: R[] = new Array(items.length);
  let cursor = 0;
  async function worker() {
    while (true) {
      const index = cursor++;
      if (index >= items.length) return;
      output[index] = await fn(items[index]);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, Math.max(1, items.length)) }, () => worker()));
  return output;
}

function checkComplete(schedule: RoadmapSchedule, records: MissionRecord[], config: RoadmapConfig) {
  const nodes = records.filter((r) => r.node);
  if (config.timelineMode === "monthly") {
    for (const unit of schedule.units.filter((u) => u.detailState === "expanded")) {
      if (!unit.weeks || unit.weeks.length !== 4 || unit.weeks.some((w) => w.taskIds.length === 0)) throw new Error(`Empty monthly unit ${unit.unitIndex}`);
    }
  }
  if (config.timelineMode === "yearly") {
    for (const year of schedule.units.filter((u) => u.detailState === "expanded")) {
      if (!year.months || year.months.length !== 12) throw new Error(`Incomplete year ${year.unitIndex}`);
      if (year.months.some((m) => m.weeks.length !== 4 || m.weeks.some((w) => w.taskIds.length === 0))) throw new Error(`Empty month in year ${year.unitIndex}`);
    }
  }
  for (const unit of schedule.units.filter((u) => u.detailState === "expanded")) {
    const unitNodes = nodes.filter((r) => r.unitIndex === unit.unitIndex || (config.timelineMode === "yearly" && r.yearIndex === unit.unitIndex));
    if (unitNodes.some((r) => !r.node?.tasks.length)) throw new Error(`Mission without tasks in unit ${unit.unitIndex}`);
  }
}

function buildDoc(
  profile: StudentProfile,
  config: RoadmapConfig,
  master: MasterPlan,
  materialized: Materialized,
  opts: { language?: Lang },
): RoadmapDoc {
  void profile;
  void opts;
  const now = new Date();
  const doc: RoadmapDoc = {
    roadmapId: shortId(),
    title: stabilizeGeneratedText(master.title),
    config,
    phases: Array.from({ length: phaseCount(config.durationDays, config.timelineMode) }, (_, i) => phaseLabel(config.timelineMode, i)),
    branches: materialized.branches,
    schedule: materialized.schedule,
    scores: createScoreEntries(config),
    adaptations: [],
    createdAt: now,
    updatedAt: now,
  };
  return recomputeStatuses(doc);
}

export async function generateScheduledRoadmap(
  profile: StudentProfile,
  config: RoadmapConfig,
  opts: { userId?: string; language?: Lang } = {},
): Promise<RoadmapDoc> {
  const count = phaseCount(config.durationDays, config.timelineMode);
  // Two-year plans are intentionally front-loaded: only Year 1 or the first
  // twelve monthly units spend expansion tokens during initial generation.
  const detailLimit = config.timelineMode === "yearly" && count > 1
    ? 1
    : config.durationDays > 365 ? 12 : count;
  const state: ScheduleCallState = { providerUnavailable: false };
  const scheduleOpts: ScheduleOpts = { ...opts, state };
  const rawMaster = await callJson("master", MasterSchema, masterPrompt(profile, config, count, opts.language), "Generate the complete schedule master now.", { userId: opts.userId, maxOutputTokens: 8192, state });
  const master = (rawMaster && normalizeMaster(rawMaster, config, count)) ?? fallbackMaster(profile, config, count);
  const materialized = materializeMaster(master, config, detailLimit);
  const schedule = materialized.schedule;
  const records = materialized.records;

  if (config.timelineMode === "monthly") {
    const jobs = schedule.units.filter((u) => u.detailState === "expanded");
    await mapBounded(jobs, 3, async (unit) => {
      const unitRecords = records.filter((r) => r.unitIndex === unit.unitIndex);
      const expansion = await expandMonthlyUnit(profile, config, unit, unitRecords, scheduleOpts);
      applyMonthlyExpansion(expansion, unit, unitRecords);
      return true;
    });
  } else if (config.timelineMode === "weekly") {
    const jobs = schedule.units.filter((u) => u.detailState === "expanded");
    await mapBounded(jobs, 3, async (unit) => {
      const unitRecords = records.filter((r) => r.unitIndex === unit.unitIndex);
      const expansion = await expandWeeklyUnit(profile, config, unit, unitRecords, scheduleOpts);
      applyWeeklyExpansion(expansion, unit, unitRecords);
      return true;
    });
  } else if (config.timelineMode === "daily") {
    const days = schedule.units.filter((u) => u.detailState === "expanded").map((u) => u.unitIndex);
    const batches = Array.from({ length: Math.ceil(days.length / 5) }, (_, i) => days.slice(i * 5, i * 5 + 5));
    await mapBounded(batches, 3, async (batch) => {
      const byDay = new Map(batch.map((day) => [day, records.filter((r) => r.unitIndex === day)]));
      const expansion = await expandDailyBatch(profile, config, batch, byDay, scheduleOpts);
      applyDailyExpansion(expansion, schedule.units, records);
      return true;
    });
  } else {
    // Yearly plans expand the active year's twelve months through the same
    // month pipeline. Year 2 remains a summary/deferred unit.
    const jobs = schedule.units[0]?.months ?? [];
    await mapBounded(jobs, 3, async (month) => {
      const unit = schedule.units[0];
      const monthRecords = records.filter((r) => r.yearIndex === 0 && r.monthIndex === month.monthIndex);
      const expansionUnit: RoadmapScheduleUnit = { ...unit, unitIndex: month.monthIndex, title: month.title, objective: month.objective, yearIndex: 0 };
      const expansion = await expandMonthlyUnit(profile, config, expansionUnit, monthRecords, scheduleOpts);
      month.weeks = emptyWeeks();
      applyMonthlyExpansion(expansion, expansionUnit, monthRecords);
      month.weeks = expansionUnit.weeks ?? month.weeks;
      return true;
    });
  }

  checkComplete(schedule, records, config);
  return buildDoc(profile, config, master, materialized, opts);
}

function summaryToMission(summary: { id: string; title: string; objective: string }, config: RoadmapConfig, unitIndex: number, monthIndex?: number): MissionBrief {
  return {
    key: summary.id || `deferred-${unitIndex}-${monthIndex ?? 0}`,
    title: summary.title,
    description: summary.objective,
    why: `This milestone supports ${config.targetGoal}.`,
    how: "Break the milestone into four weekly actions and record evidence after each action.",
    category: "Academics",
    type: "study",
    priority: "medium",
    difficulty: 3,
    estimatedHoursPerWeek: Math.max(1, Math.min(8, Math.round(config.availableHoursPerWeek / 3))),
    topics: ["study-skills"],
    completionCriteria: "Complete the weekly actions and record a concrete result.",
    impact: "+ Sustained profile growth",
  };
}

function mergeProgress(next: RoadmapDoc, previous: RoadmapDoc): RoadmapDoc {
  const oldNodes = previous.branches.flatMap((b) => b.nodes);
  const byTitle = new Map(oldNodes.map((n) => [n.title.trim().toLowerCase(), n]));
  for (const node of next.branches.flatMap((b) => b.nodes)) {
    const old = byTitle.get(node.title.trim().toLowerCase());
    if (!old) continue;
    const oldDoneByText = new Set(old.tasks.filter((t) => t.done).map((t) => t.text.trim().toLowerCase()));
    for (const task of node.tasks) if (oldDoneByText.has(task.text.trim().toLowerCase())) task.done = true;
    if (old.status === "done") for (const task of node.tasks) task.done = true;
    node.progress = node.tasks.length ? Math.round(node.tasks.filter((t) => t.done).length / node.tasks.length * 100) : old.progress;
    if (node.progress === 100 || old.status === "done") {
      node.status = "done";
      node.completedAt = old.completedAt ?? new Date();
    }
    node.notes = old.notes;
  }
  // Keep old branches/nodes that the new master did not match accessible in
  // the overview. They are intentionally not inserted into schedule units.
  for (const branch of previous.branches) {
    for (const old of branch.nodes) {
      const exists = next.branches.some((b) => b.nodes.some((n) => n.title.trim().toLowerCase() === old.title.trim().toLowerCase()));
      if (exists) continue;
      let target = next.branches.find((b) => b.category === branch.category);
      if (!target) {
        target = { ...branch, id: shortId(), nodes: [] };
        next.branches.push(target);
      }
      target.nodes.push(old);
    }
  }
  return recomputeStatuses(next);
}

/** Explicit, non-destructive upgrade for a legacy flat roadmap. */
export async function buildLegacySchedule(
  profile: StudentProfile,
  previous: RoadmapDoc,
  opts: { userId?: string; language?: Lang } = {},
): Promise<RoadmapDoc> {
  const next = await generateScheduledRoadmap(profile, previous.config, opts);
  next.roadmapId = previous.roadmapId;
  next.createdAt = previous.createdAt;
  next.adaptations = previous.adaptations;
  return mergeProgress(next, previous);
}

/** Expand one deferred year without touching the already-generated year. */
export async function generateDeferredSchedule(
  profile: StudentProfile,
  previous: RoadmapDoc,
  requestedYearIndex: number,
  opts: { userId?: string; language?: Lang } = {},
): Promise<RoadmapDoc> {
  if (!previous.schedule) throw new Error("This roadmap needs the explicit legacy schedule build first.");
  const source = structuredClone(previous) as RoadmapDoc;
  const schedule = source.schedule;
  if (!schedule) throw new Error("This roadmap needs the explicit legacy schedule build first.");
  const state: ScheduleCallState = { providerUnavailable: false };
  const scheduleOpts: ScheduleOpts = { ...opts, state };
  if (schedule.mode === "yearly") {
    const year = schedule.units[requestedYearIndex];
    if (!year || year.detailState === "expanded") return previous;
    const summaries = year.missionBriefs?.length ? year.missionBriefs : [{ id: `year-${requestedYearIndex}-core`, title: `Year ${requestedYearIndex + 1} core milestone`, objective: `Extend progress toward ${source.config.targetGoal}.` }];
    const monthRecords: MissionRecord[] = [];
    year.months = Array.from({ length: 12 }, (_, monthIndex) => {
      const summary = summaries[monthIndex % summaries.length];
      const brief = summaryToMission({ ...summary, id: `${summary.id}-m${monthIndex}` }, source.config, requestedYearIndex, monthIndex);
      const record: MissionRecord = { key: brief.key, brief, unitIndex: requestedYearIndex, yearIndex: requestedYearIndex, monthIndex, node: missionNode(brief, requestedYearIndex) };
      monthRecords.push(record);
      return { monthIndex, title: `Month ${monthIndex + 1}`, objective: summary.objective, missionIds: [record.node!.id], weeks: emptyWeeks() };
    });
    for (const record of monthRecords) {
      const monthIndex = record.monthIndex ?? 0;
      const month = year.months.find((m) => m.monthIndex === monthIndex)!;
      const expansionUnit: RoadmapScheduleUnit = { ...year, unitIndex: monthIndex, title: month.title, objective: month.objective, yearIndex: requestedYearIndex };
      const expansion = await expandMonthlyUnit(profile, source.config, expansionUnit, [record], scheduleOpts);
      applyMonthlyExpansion(expansion, expansionUnit, [record]);
      month.weeks = expansionUnit.weeks ?? month.weeks;
    }
    const branchList = makeBranches(monthRecords);
    for (const branch of branchList) {
      const existing = source.branches.find((b) => b.category === branch.category);
      if (existing) existing.nodes.push(...branch.nodes);
      else source.branches.push(branch);
    }
    year.missionIds = monthRecords.map((r) => r.node!.id);
    year.detailState = "expanded";
    source.updatedAt = new Date();
    return recomputeStatuses(source);
  }

  const deferredUnits = schedule.units.slice(requestedYearIndex * 12, requestedYearIndex * 12 + 12);
  if (!deferredUnits.length || deferredUnits.some((u) => u.detailState === "expanded" && u.unitIndex < 12)) return previous;
  const allRecords: MissionRecord[] = [];
  for (const unit of deferredUnits) {
    const monthIndex = unit.unitIndex % 12;
    const summaries = unit.missionBriefs?.length ? unit.missionBriefs : [{ id: `month-${unit.unitIndex}`, title: unit.title, objective: unit.objective }];
    const records = summaries.map((summary, j) => {
      const brief = summaryToMission({ ...summary, id: `${summary.id}-${j}` }, source.config, unit.unitIndex, monthIndex);
      return { key: brief.key, brief, unitIndex: unit.unitIndex, yearIndex: Math.floor(unit.unitIndex / 12), monthIndex, node: missionNode(brief, unit.unitIndex) } as MissionRecord;
    });
    const expansion = await expandMonthlyUnit(profile, source.config, unit, records, scheduleOpts);
    applyMonthlyExpansion(expansion, unit, records);
    unit.weeks = unit.weeks ?? emptyWeeks();
    unit.missionIds = records.map((r) => r.node!.id);
    unit.detailState = "expanded";
    allRecords.push(...records);
  }
  for (const branch of makeBranches(allRecords)) {
    const existing = source.branches.find((b) => b.category === branch.category);
    if (existing) existing.nodes.push(...branch.nodes);
    else source.branches.push(branch);
  }
  source.updatedAt = new Date();
  return recomputeStatuses(source);
}
