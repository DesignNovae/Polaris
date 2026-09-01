/**
 * Strategist tool registry. Each tool is a typed declaration the model can
 * request via function-calling; handlers run server-side and return JSON that
 * is fed back into the next round trip.
 *
 * Tools are deliberately small and orthogonal - composition happens in the
 * model, not here.
 *
 * Two rules hold across the registry:
 *   • Every handler scopes its reads and writes to the calling `userId`. A
 *     model-supplied id is a lookup key, never an authorization claim.
 *   • Exam tools are read-only. The Strategist advises on what to practise;
 *     the Action Lab administers it.
 */

import { z } from "zod";
import { searchKb } from "@/lib/rag/search";
import { listMilestones } from "@/lib/tasks/service";
import { getUniversities } from "@/lib/content";
import { getExamPerformance } from "@/lib/exams/performance";
import {
  addWeeklyTaskNote,
  getRoadmapV2,
  getWeeklyTask,
  listWeeklyTasks,
  saveRoadmapV2,
  updateWeeklyTask,
  weeklyTaskId,
  type MilestoneStatus,
} from "@/lib/db/collections";
import { nodeProgressFromTasks, recomputeStatuses, shortId } from "@/lib/roadmap/types";
import {
  scoreProbability,
  profileToInputs,
  type UniversityForModel,
} from "@/lib/ml/probability";
import type { StudentProfile } from "@/lib/profile";
import type { ToolDeclaration } from "@/lib/llm/providers/types";

/* ─── Schemas ─────────────────────────────────────────────────────────────── */

const SearchKbArgs = z.object({ query: z.string().min(2).max(200) });
const ReadMilestoneArgs = z.object({ milestoneId: z.string().regex(/^[a-z0-9]{6,12}$/) });
const ComputeProbabilityArgs = z.object({ universityId: z.string().regex(/^[a-z0-9-]{2,40}$/) });
const NoArgs = z.object({}).passthrough();

const UpdateWeeklyTaskArgs = z.object({
  taskId: z.string().min(1).max(40),
  status: z.enum(["pending", "in-progress", "done"]).optional(),
  progress: z.number().int().min(0).max(100).optional(),
  week: z.number().int().min(1).max(52).optional(),
  note: z.string().min(1).max(600).optional(),
}).refine(
  (v) => v.status !== undefined || v.progress !== undefined || v.week !== undefined || v.note !== undefined,
  { message: "Provide at least one change" },
);

const UpdateRoadmapNodeArgs = z.object({
  nodeId: z.string().min(1).max(80),
  markDone: z.boolean().optional(),
  toggleTaskId: z.string().min(1).max(40).optional(),
  progress: z.number().int().min(0).max(100).optional(),
  priority: z.enum(["high", "medium", "low"]).optional(),
  estimatedHoursPerWeek: z.number().min(0).max(60).optional(),
  note: z.string().min(1).max(600).optional(),
}).refine(
  (v) =>
    v.markDone !== undefined || v.toggleTaskId !== undefined || v.progress !== undefined ||
    v.priority !== undefined || v.estimatedHoursPerWeek !== undefined || v.note !== undefined,
  { message: "Provide at least one change" },
);

export const TOOL_SCHEMAS = {
  search_kb: SearchKbArgs,
  read_milestone: ReadMilestoneArgs,
  compute_probability: ComputeProbabilityArgs,
  get_exam_performance: NoArgs,
  get_plan: NoArgs,
  update_weekly_task: UpdateWeeklyTaskArgs,
  update_roadmap_node: UpdateRoadmapNodeArgs,
} as const;

export type ToolName = keyof typeof TOOL_SCHEMAS;

/** Tools that change stored state. Surfaced to the client so the UI can say so. */
export const MUTATING_TOOLS: ReadonlySet<string> = new Set([
  "update_weekly_task",
  "update_roadmap_node",
]);

export function isToolName(name: string): name is ToolName {
  return Object.prototype.hasOwnProperty.call(TOOL_SCHEMAS, name);
}

/* ─── Declarations ────────────────────────────────────────────────────────── */

export const STRATEGIST_TOOLS: ToolDeclaration[] = [
  {
    name: "search_kb",
    description:
      "Search Polaris's curated knowledge base. Call again with a narrower query when the first result set does not answer the question.",
    parameters: {
      type: "object",
      properties: { query: { type: "string", description: "A focused, standalone question" } },
      required: ["query"],
    },
  },
  {
    name: "read_milestone",
    description: "Fetch the full body of one roadmap milestone by id.",
    parameters: {
      type: "object",
      properties: { milestoneId: { type: "string" } },
      required: ["milestoneId"],
    },
  },
  {
    name: "compute_probability",
    description:
      "Run the Polaris admission-probability model for one university id. This is the ONLY permitted source of a probability figure.",
    parameters: {
      type: "object",
      properties: { universityId: { type: "string", description: "Lowercase university id, e.g. \"mit\"" } },
      required: ["universityId"],
    },
  },
  {
    name: "get_exam_performance",
    description:
      "Read this student's Polaris mock exam results: accuracy per domain, weakest areas, and change since their previous attempt. Read-only - use it to decide what they should practise next. Never run an exam in the conversation.",
    parameters: { type: "object", properties: {} },
  },
  {
    name: "get_plan",
    description:
      "List the student's weekly tasks and roadmap nodes with their ids and status. Call this before changing anything so you use real ids.",
    parameters: { type: "object", properties: {} },
  },
  {
    name: "update_weekly_task",
    description:
      "Change one weekly task: set its status or progress, move it to a different week, or attach a note explaining your reasoning. Say what you changed and why in your reply.",
    parameters: {
      type: "object",
      properties: {
        taskId: { type: "string" },
        status: { type: "string", enum: ["pending", "in-progress", "done"] },
        progress: { type: "number", description: "0-100" },
        week: { type: "number", description: "Move the task to this 1-based week" },
        note: { type: "string", description: "Short rationale recorded on the task" },
      },
      required: ["taskId"],
    },
  },
  {
    name: "update_roadmap_node",
    description:
      "Change one roadmap node: complete it, toggle one of its checklist tasks, set progress, re-prioritise it, adjust its weekly hours, or attach a note. Say what you changed and why in your reply.",
    parameters: {
      type: "object",
      properties: {
        nodeId: { type: "string" },
        markDone: { type: "boolean" },
        toggleTaskId: { type: "string", description: "Id of a checklist task inside the node" },
        progress: { type: "number", description: "0-100" },
        priority: { type: "string", enum: ["high", "medium", "low"] },
        estimatedHoursPerWeek: { type: "number" },
        note: { type: "string", description: "Short rationale recorded on the node" },
      },
      required: ["nodeId"],
    },
  },
];

/* ─── Handlers ────────────────────────────────────────────────────────────── */

export type ToolContext = { userId: string; profile: StudentProfile };

/** Recorded on the roadmap so a model-made change is auditable next to user edits. */
function logAdaptation(doc: { adaptations: Array<{ id: string; reason: string; at: Date }> }, reason: string) {
  doc.adaptations.push({ id: shortId(), reason: `Strategist: ${reason}`, at: new Date() });
}

async function handleGetPlan(userId: string) {
  const [tasks, roadmap] = await Promise.all([
    listWeeklyTasks(userId).catch(() => []),
    getRoadmapV2(userId).catch(() => null),
  ]);
  const open = tasks.filter((t) => t.status !== "done");
  const currentWeek = open.length ? Math.min(...open.map((t) => t.week)) : null;
  return {
    currentWeek,
    // An empty weekly plan is a normal state, not an error - but the model has
    // to be told so explicitly. Left to infer it from an empty array it starts
    // guessing task ids off the roadmap nodes below, and each rejected guess
    // costs another generation until the tool budget (and the per-minute model
    // quota) is gone. Naming the situation ends the answer in one round.
    ...(tasks.length
      ? {}
      : {
          weeklyPlanEmpty: true,
          note:
            "This student has no weekly plan yet, so there is no weekly task to " +
            "move, reschedule or complete. Do not call update_weekly_task. Say " +
            "the weekly plan has not been generated yet, and work with the " +
            "roadmap nodes below instead (update_roadmap_node) if a change is needed.",
        }),
    weeklyTasks: tasks.map((t) => ({
      id: t.id,
      week: t.week,
      weekTheme: t.weekTheme,
      title: t.title,
      status: t.status,
      progress: t.progress,
      priority: t.priority,
      category: t.category,
    })),
    roadmapNodes: roadmap
      ? roadmap.branches.flatMap((branch) =>
          branch.nodes.map((node) => ({
            id: node.id,
            branch: branch.category,
            title: node.title,
            status: node.status,
            progress: node.progress,
            priority: node.priority,
            phase: node.phase,
            estimatedHoursPerWeek: node.estimatedHoursPerWeek,
            openTasks: node.tasks.filter((t) => !t.done).map((t) => ({ id: t.id, text: t.text })),
          })),
        )
      : [],
  };
}

async function handleUpdateWeeklyTask(args: z.infer<typeof UpdateWeeklyTaskArgs>, userId: string) {
  const task = await getWeeklyTask(userId, args.taskId);
  if (!task) {
    // Distinguish "wrong id" from "there are no tasks at all". Without this the
    // model reads one generic rejection as a bad guess and immediately guesses
    // again, which is how a student with no weekly plan burned four rounds.
    const total = await listWeeklyTasks(userId).catch(() => []);
    if (!total.length) {
      return {
        error:
          "This student has no weekly plan yet, so there is nothing to update. " +
          "Do not retry with another id - tell them the weekly plan has not been generated.",
        weeklyPlanEmpty: true,
      };
    }
    return {
      error: "No weekly task with that id belongs to this student. Use an id from get_plan; do not invent one.",
      taskId: args.taskId,
      validIds: total.map((t) => t.id),
    };
  }

  const changed: string[] = [];
  // Status and progress must stay coherent, mirroring PATCH /api/tasks/weekly/[id].
  let progress = args.progress ?? task.progress;
  let status: MilestoneStatus = args.status ?? task.status;
  if (args.status === "done") progress = 100;
  else if (args.progress !== undefined) {
    status = progress >= 100 ? "done" : progress > 0 ? "in-progress" : "pending";
  }

  const patch: Parameters<typeof updateWeeklyTask>[2] = {};
  if (status !== task.status) { patch.status = status; changed.push(`status → ${status}`); }
  if (progress !== task.progress) { patch.progress = progress; changed.push(`progress → ${progress}%`); }
  if (status === "done" && task.status !== "done") patch.completedAt = new Date();
  if (args.week !== undefined && args.week !== task.week) {
    patch.week = args.week;
    changed.push(`moved week ${task.week} → ${args.week}`);
  }
  if (Object.keys(patch).length) await updateWeeklyTask(userId, args.taskId, patch);

  if (args.note) {
    await addWeeklyTaskNote(userId, args.taskId, {
      id: weeklyTaskId(),
      author: "strategist",
      text: args.note,
      at: new Date(),
    });
    changed.push("note added");
  }

  return {
    ok: true,
    taskId: args.taskId,
    title: task.title,
    changed: changed.length ? changed : ["no change - values already matched"],
  };
}

async function handleUpdateRoadmapNode(args: z.infer<typeof UpdateRoadmapNodeArgs>, userId: string) {
  const doc = await getRoadmapV2(userId);
  if (!doc) return { error: "This student has no roadmap yet." };
  const node = doc.branches.flatMap((b) => b.nodes).find((n) => n.id === args.nodeId);
  if (!node) return { error: "No roadmap node with that id.", nodeId: args.nodeId };

  const changed: string[] = [];

  if (args.toggleTaskId) {
    const task = node.tasks.find((t) => t.id === args.toggleTaskId);
    if (!task) return { error: "No checklist task with that id on this node.", toggleTaskId: args.toggleTaskId };
    task.done = !task.done;
    node.progress = nodeProgressFromTasks(node.tasks);
    changed.push(`checklist "${task.text.slice(0, 40)}" → ${task.done ? "done" : "open"}`);
  }
  if (args.progress !== undefined) {
    node.progress = args.progress;
    changed.push(`progress → ${args.progress}%`);
  }
  if (args.priority && args.priority !== node.priority) {
    node.priority = args.priority;
    changed.push(`priority → ${args.priority}`);
  }
  if (args.estimatedHoursPerWeek !== undefined) {
    node.estimatedHoursPerWeek = args.estimatedHoursPerWeek;
    changed.push(`hours/week → ${args.estimatedHoursPerWeek}`);
  }
  if (args.markDone) {
    node.status = "done";
    node.progress = 100;
    node.completedAt = node.completedAt ?? new Date();
    for (const t of node.tasks) t.done = true;
    changed.push("marked done");
  } else if (node.progress === 100 && node.status !== "done") {
    node.status = "done";
    node.completedAt = node.completedAt ?? new Date();
  } else if (node.progress < 100 && node.status === "done") {
    node.status = "current";
    node.completedAt = undefined;
  }
  if (args.note) {
    node.notes.push({ id: shortId(), text: args.note, at: new Date() });
    changed.push("note added");
  }

  if (!changed.length) return { ok: true, nodeId: args.nodeId, changed: ["no change - values already matched"] };

  logAdaptation(doc, `${node.title} - ${changed.join(", ")}`);
  doc.updatedAt = new Date();
  recomputeStatuses(doc);
  await saveRoadmapV2(userId, doc);

  return { ok: true, nodeId: args.nodeId, title: node.title, status: node.status, progress: node.progress, changed };
}

export async function runTool(
  name: ToolName,
  rawArgs: unknown,
  ctx: ToolContext,
): Promise<unknown> {
  switch (name) {
    case "search_kb": {
      const { query } = SearchKbArgs.parse(rawArgs);
      return await searchKb(query, 6);
    }
    case "read_milestone": {
      const { milestoneId } = ReadMilestoneArgs.parse(rawArgs);
      const ms = await listMilestones(ctx.userId);
      const m = ms.find((x) => x.id === milestoneId);
      return m
        ? { id: m.id, title: m.title, description: m.description, metric: m.metric, rationale: m.rationale, status: m.status }
        : { error: "Milestone not found" };
    }
    case "compute_probability": {
      const { universityId } = ComputeProbabilityArgs.parse(rawArgs);
      // Wired to the repo's transparent logistic engine (lib/ml/probability.ts).
      // No demographic features - inputs are GPA / test / EC / research only.
      const universities = (await getUniversities()) as unknown as Array<{
        id: string;
        name?: string;
        tier: UniversityForModel["tier"];
        acceptanceRate: number;
      }>;
      const uni = universities.find((u) => u.id === universityId);
      if (!uni) return { error: "Unknown university id", universityId };

      const inputs = profileToInputs(ctx.profile);
      const result = scoreProbability(inputs, {
        id: uni.id,
        tier: uni.tier,
        acceptanceRate: uni.acceptanceRate,
      });

      // Percentages are returned alongside the raw fractions because the model
      // quotes percentages, and the deterministic figure guard downstream can
      // only match a number it has literally seen.
      return {
        universityId: uni.id,
        name: uni.name ?? uni.id,
        probability: Math.round(result.probability * 1000) / 1000,
        probabilityPercent: Math.round(result.probability * 1000) / 10,
        baseline: result.baseline,
        baselinePercent: Math.round(result.baseline * 1000) / 10,
        factors: result.factors.map((f) => ({
          name: f.name,
          contribution: Math.round(f.contribution * 1000) / 1000,
        })),
      };
    }
    case "get_exam_performance":
      return await getExamPerformance(ctx.userId);
    case "get_plan":
      return await handleGetPlan(ctx.userId);
    case "update_weekly_task":
      return await handleUpdateWeeklyTask(UpdateWeeklyTaskArgs.parse(rawArgs), ctx.userId);
    case "update_roadmap_node":
      return await handleUpdateRoadmapNode(UpdateRoadmapNodeArgs.parse(rawArgs), ctx.userId);
  }
}
