/**
 * Weekly task service - generation, dynamic replanning, and submission
 * feedback for the week-by-week roadmap.
 *
 * Generation: profile + existing roadmap milestones → 8 weeks of granular,
 * hands-on tasks (2–3 per week, each with a practice deliverable). LLM-first
 * with a deterministic fallback derived from the milestones so the roadmap
 * never comes up empty.
 *
 * Replan: summarizes done/ongoing work + recent notes, asks the LLM to
 * rewrite the upcoming (not-yet-completed) weeks. Completed tasks are never
 * touched.
 *
 * Feedback: when a task is marked complete with a submission, the LLM
 * reviews the work and writes constructive feedback stored on the task.
 */

import { z } from "zod";
import {
  getLatestRoadmap,
  getProfile,
  listWeeklyTasks,
  insertWeeklyTasks,
  replaceUpcomingWeeklyTasks,
  weeklyTaskId,
  type DbWeeklyTask,
  type DbMilestone,
} from "@/lib/db/collections";
import { summarizeProfile, type StudentProfile } from "@/lib/profile";
import { completeText, extractJson } from "@/lib/llm/complete";

/* ─── LLM output schema ─── */

const GeneratedTaskSchema = z.object({
  week: z.number().int().min(1).max(52),
  weekTheme: z.string().min(1).max(120),
  title: z.string().min(1).max(160),
  summary: z.string().min(1).max(1200),
  practice: z.string().min(1).max(1200),
  category: z.string().min(1).max(40),
  priority: z.enum(["high", "medium", "low"]),
});

const GeneratedPlanSchema = z.array(GeneratedTaskSchema).min(4).max(60);

type GeneratedTask = z.infer<typeof GeneratedTaskSchema>;

/* ─── Generation ─── */

const PLAN_WEEKS = 8;

function generationSystemPrompt(profile: StudentProfile, milestones: DbMilestone[]): string {
  return [
    `You are Polaris, an AI academic strategist. Design a ${PLAN_WEEKS}-week action plan for ONE student.`,
    ``,
    `STUDENT PROFILE`,
    summarizeProfile(profile),
    ``,
    `HIGH-LEVEL MILESTONES ALREADY PLANNED (translate these into weekly work)`,
    milestones.length
      ? milestones.map((m, i) => `${i + 1}. [${m.category}/${m.priority}] ${m.title} - ${m.description}`).join("\n")
      : "(none - design from the profile alone)",
    ``,
    `REQUIREMENTS`,
    `1. Exactly ${PLAN_WEEKS} weeks, 2–3 tasks per week. Week numbers start at 1.`,
    `2. Every task MUST include a "practice" field: a concrete hands-on exercise, drill, or deliverable the student physically produces this week (e.g. "Take practice test 6 sections 1–2 timed, log every wrong answer with the reason"). Never "read about X" - always "do X and produce Y".`,
    `3. Tasks must be small enough to finish inside the week, intimate and specific to THIS student's profile (their curriculum, scores, target tier). Generic advice is a failure.`,
    `4. Sequence matters: earlier weeks build foundations the later weeks use.`,
    `5. Each week gets a short weekTheme (2–5 words) shared by its tasks.`,
    `6. category is one of: Academics, Testing, Extracurriculars, Skills, Applications, Research.`,
    ``,
    `OUTPUT - respond with ONLY a JSON array (no prose) of objects:`,
    `{ "week": 1, "weekTheme": "...", "title": "...", "summary": "...", "practice": "...", "category": "...", "priority": "high|medium|low" }`,
  ].join("\n");
}

function toDbTask(userId: string, g: GeneratedTask, source: "generated" | "replanned"): Omit<DbWeeklyTask, "_id"> {
  const now = new Date();
  return {
    userId,
    week: g.week,
    weekTheme: g.weekTheme,
    id: weeklyTaskId(),
    title: g.title,
    summary: g.summary,
    practice: g.practice,
    category: g.category,
    priority: g.priority,
    status: "pending",
    progress: 0,
    notes: [],
    source,
    createdAt: now,
    updatedAt: now,
  };
}

/** Deterministic fallback: split each milestone into weekly tasks. */
function fallbackPlan(milestones: DbMilestone[]): GeneratedTask[] {
  const out: GeneratedTask[] = [];
  const source = milestones.length
    ? milestones
    : ([{
        category: "Academics", title: "Build your academic baseline", priority: "high",
        description: "Map your current grades and pick the two subjects with the most headroom.",
        metric: "Baseline documented", rationale: "", quarter: "",
        id: "fb", status: "pending",
      }] as unknown as DbMilestone[]);

  let week = 1;
  for (const m of source) {
    if (week > PLAN_WEEKS) break;
    out.push({
      week,
      weekTheme: m.category,
      title: `${m.title} - plan & first rep`,
      summary: `Break "${m.title}" into concrete steps: ${m.description}`,
      practice: `Write a one-page plan with 3 measurable sub-goals, then complete the first sub-goal this week. Log what you produced in the task notes.`,
      category: m.category,
      priority: m.priority,
    });
    out.push({
      week: Math.min(week + 1, PLAN_WEEKS),
      weekTheme: m.category,
      title: `${m.title} - execute & measure`,
      summary: `Push "${m.title}" to a measurable checkpoint. Success metric: ${m.metric}`,
      practice: `Produce the deliverable named in the metric ("${m.metric}") or a draft of it, and submit it on this task for review.`,
      category: m.category,
      priority: m.priority,
    });
    week += 2;
  }
  return out;
}

/** Generate (or return existing) weekly tasks for the user. */
export async function ensureWeeklyTasks(userId: string): Promise<DbWeeklyTask[]> {
  const existing = await listWeeklyTasks(userId);
  if (existing.length > 0) return existing;

  const [profile, roadmap] = await Promise.all([
    getProfile(userId),
    getLatestRoadmap(userId),
  ]);
  if (!profile) return [];
  const milestones = roadmap?.roadmap.milestones ?? [];

  let plan: GeneratedTask[] | null = null;
  const raw = await completeText({
    task: "general",
    userId,
    feature: "weekly-generate",
    system: generationSystemPrompt(profile, milestones),
    messages: [{ role: "user", content: "Generate the weekly plan now." }],
    temperature: 0.5,
    maxOutputTokens: 8192,
  });
  if (raw) {
    const parsed = GeneratedPlanSchema.safeParse(extractJson(raw));
    if (parsed.success) plan = parsed.data;
  }
  if (!plan) plan = fallbackPlan(milestones);

  const docs = plan.map((g) => toDbTask(userId, g, "generated"));
  await insertWeeklyTasks(docs);
  return listWeeklyTasks(userId);
}

/* ─── Replan ─── */

function replanSystemPrompt(
  profile: StudentProfile,
  tasks: DbWeeklyTask[],
  fromWeek: number,
  reason: string | undefined,
): string {
  const done = tasks.filter((t) => t.status === "done");
  const open = tasks.filter((t) => t.status !== "done");
  const noteLines = tasks
    .flatMap((t) => t.notes.slice(-2).map((n) => `[w${t.week} ${t.title}] ${n.author}: ${n.text}`))
    .slice(-12);

  return [
    `You are Polaris, an AI academic strategist re-planning a student's week-by-week roadmap.`,
    ``,
    `STUDENT PROFILE`,
    summarizeProfile(profile),
    ``,
    `COMPLETED WORK (never change these)`,
    done.length
      ? done.map((t) => `w${t.week} [${t.category}] ${t.title}${t.feedback ? ` - feedback given: ${t.feedback.slice(0, 140)}` : ""}`).join("\n")
      : "(nothing completed yet)",
    ``,
    `OPEN TASKS BEING REPLACED (weeks ${fromWeek}+)`,
    open.filter((t) => t.week >= fromWeek)
      .map((t) => `w${t.week} [${t.category}/${t.priority}] ${t.title} - progress ${t.progress}%`)
      .join("\n") || "(none)",
    ``,
    `RECENT STUDENT NOTES`,
    noteLines.length ? noteLines.join("\n") : "(none)",
    ``,
    reason ? `STUDENT'S REPLAN REQUEST\n${reason}\n` : ``,
    `REQUIREMENTS`,
    `1. Design weeks ${fromWeek} through ${fromWeek + 3} (4 weeks), 2–3 tasks per week.`,
    `2. Build on what's already completed; address weak spots visible in the notes and progress.`,
    `3. Every task MUST include a hands-on "practice" deliverable the student produces that week.`,
    `4. Small, specific, personal - reference this student's actual situation.`,
    `5. category is one of: Academics, Testing, Extracurriculars, Skills, Applications, Research.`,
    ``,
    `OUTPUT - ONLY a JSON array of objects:`,
    `{ "week": ${fromWeek}, "weekTheme": "...", "title": "...", "summary": "...", "practice": "...", "category": "...", "priority": "high|medium|low" }`,
  ].join("\n");
}

export type ReplanResult =
  | { ok: true; tasks: DbWeeklyTask[] }
  | { ok: false; error: string };

/** Strategist replans all not-yet-completed weeks from `fromWeek` onward. */
export async function replanWeeklyTasks(
  userId: string,
  opts: { fromWeek?: number; reason?: string } = {},
): Promise<ReplanResult> {
  const [profile, tasks] = await Promise.all([
    getProfile(userId),
    listWeeklyTasks(userId),
  ]);
  if (!profile) return { ok: false, error: "Profile missing." };
  if (!tasks.length) return { ok: false, error: "No weekly plan to adapt yet." };

  // Default: replan from the earliest week that still has open work.
  const openWeeks = tasks.filter((t) => t.status !== "done").map((t) => t.week);
  const fromWeek = opts.fromWeek ?? (openWeeks.length ? Math.min(...openWeeks) : Math.max(...tasks.map((t) => t.week)) + 1);

  const raw = await completeText({
    task: "general",
    userId,
    feature: "weekly-replan",
    system: replanSystemPrompt(profile, tasks, fromWeek, opts.reason),
    messages: [{ role: "user", content: "Re-plan the upcoming weeks now." }],
    temperature: 0.5,
    maxOutputTokens: 8192,
  });
  if (!raw) return { ok: false, error: "The Strategist couldn't reach a model. Try again shortly." };

  const parsed = GeneratedPlanSchema.safeParse(extractJson(raw));
  if (!parsed.success) return { ok: false, error: "The Strategist produced an invalid plan. Try again." };

  // Clamp weeks to >= fromWeek so completed weeks can't be overwritten.
  const docs = parsed.data
    .map((g) => ({ ...g, week: Math.max(g.week, fromWeek) }))
    .map((g) => toDbTask(userId, g, "replanned"));

  await replaceUpcomingWeeklyTasks(userId, fromWeek, docs);
  return { ok: true, tasks: await listWeeklyTasks(userId) };
}

/* ─── Submission feedback ─── */

export async function reviewSubmission(
  userId: string,
  task: DbWeeklyTask,
): Promise<string | null> {
  const profile = await getProfile(userId);
  if (!profile) return null;

  const system = [
    `You are Polaris, an AI academic strategist reviewing a student's completed weekly task.`,
    ``,
    `STUDENT PROFILE`,
    summarizeProfile(profile),
    ``,
    `THE TASK`,
    `Title: ${task.title}`,
    `Instructions: ${task.summary}`,
    `Required practice deliverable: ${task.practice}`,
    task.notes.length
      ? `Student's working notes:\n${task.notes.filter((n) => n.author === "user").map((n) => `- ${n.text}`).join("\n")}`
      : ``,
    ``,
    `Review their submitted work below. Respond with 3 short sections in Markdown:`,
    `**What's strong** - 1–3 specific things done well (quote their work where possible).`,
    `**Improve next** - 1–3 concrete, actionable improvements ranked by impact.`,
    `**Verdict** - one sentence: does this meet the practice deliverable, partially meet it, or miss it? Be honest but encouraging.`,
    `Keep the whole review under 220 words. No preamble.`,
  ].join("\n");

  return completeText({
    task: "study",
    userId,
    feature: "submission-review",
    system,
    messages: [{ role: "user", content: task.submission || "(The student marked this complete without writing a submission. Review based on their notes and progress; remind them to document their work next time.)" }],
    temperature: 0.4,
    maxOutputTokens: 1024,
  });
}

/* ─── API serialization ─── */

export function serializeWeeklyTask(t: DbWeeklyTask) {
  return {
    id: t.id,
    week: t.week,
    weekTheme: t.weekTheme,
    title: t.title,
    summary: t.summary,
    practice: t.practice,
    category: t.category,
    priority: t.priority,
    status: t.status,
    progress: t.progress,
    notes: t.notes.map((n) => ({ id: n.id, author: n.author, text: n.text, at: n.at })),
    submission: t.submission ?? null,
    feedback: t.feedback ?? null,
    feedbackAt: t.feedbackAt ?? null,
    source: t.source,
    completedAt: t.completedAt ?? null,
  };
}

/* ─── Strategist context lines ─── */

/**
 * Compact context lines describing the weekly plan for injection into the
 * Strategist's system prompt (via the recentMilestones channel).
 */
export function weeklyTaskContextLines(tasks: DbWeeklyTask[], maxLines = 14): string[] {
  if (!tasks.length) return [];
  const open = tasks.filter((t) => t.status !== "done");
  const currentWeek = open.length ? Math.min(...open.map((t) => t.week)) : Math.max(...tasks.map((t) => t.week));
  const lines: string[] = [];
  lines.push(`WEEKLY PLAN - current week: ${currentWeek}`);
  for (const t of tasks) {
    if (lines.length >= maxLines) break;
    // Prioritize current + next week, then recent completions.
    if (t.week !== currentWeek && t.week !== currentWeek + 1 && t.status !== "done") continue;
    const note = t.notes.filter((n) => n.author === "user").slice(-1)[0];
    lines.push(
      `w${t.week} [${t.status} ${t.progress}%] ${t.title} - practice: ${t.practice.slice(0, 90)}${note ? ` - latest note: ${note.text.slice(0, 80)}` : ""}`,
    );
  }
  return lines;
}

