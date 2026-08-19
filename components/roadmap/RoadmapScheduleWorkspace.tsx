"use client";

import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/cn";
import {
  nodeProgressFromTasks,
  recomputeStatuses,
  type NodeTask,
  type RoadmapDoc,
  type RoadmapNode,
  type RoadmapScheduleUnit,
} from "@/lib/roadmap/types";

type ScheduleRequest = { upgradeLegacy?: boolean; yearIndex?: number };

export function RoadmapScheduleWorkspace({
  doc,
  activePhase,
  apiBase,
  demo,
  onOpenNode,
  onDocUpdated,
  onScheduleAction,
  scheduleBusy,
}: {
  doc: RoadmapDoc;
  activePhase: number | null;
  apiBase: string;
  demo: boolean;
  onOpenNode: (id: string) => void;
  onDocUpdated: (doc: RoadmapDoc) => void;
  onScheduleAction: (request: ScheduleRequest) => Promise<void>;
  scheduleBusy: boolean;
}) {
  const [taskBusy, setTaskBusy] = useState<string | null>(null);
  const selectedIndex = activePhase ?? 0;
  const nodes = useMemo(() => doc.branches.flatMap((b) => b.nodes), [doc.branches]);
  const nodesById = useMemo(() => new Map(nodes.map((node) => [node.id, node])), [nodes]);
  const schedule = doc.schedule;

  async function toggleTask(nodeId: string, taskId: string) {
    const key = `${nodeId}:${taskId}`;
    setTaskBusy(key);
    try {
      if (demo) {
        const next = structuredClone(doc) as RoadmapDoc;
        const node = next.branches.flatMap((b) => b.nodes).find((n) => n.id === nodeId);
        const task = node?.tasks.find((t) => t.id === taskId);
        if (node && task) {
          task.done = !task.done;
          node.progress = nodeProgressFromTasks(node.tasks);
          if (node.progress === 100) node.status = "done";
          else if (node.status === "done") node.status = "current";
          node.completedAt = node.progress === 100 ? (node.completedAt ?? new Date()) : undefined;
          next.updatedAt = new Date();
          onDocUpdated(recomputeStatuses(next));
        }
        return;
      }
      const response = await fetch(`${apiBase}/node/${nodeId}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ toggleTask: taskId }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data?.error ?? "Could not update task");
      onDocUpdated(data.doc as RoadmapDoc);
    } catch (error) {
      console.error(error);
    } finally {
      setTaskBusy(null);
    }
  }

  if (!schedule) {
    return (
      <section className="mb-8 rounded-2xl bg-paper-card p-5 ring-1 ring-inset ring-polaris-500/10 dark:ring-white/[0.1]">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="text-[10px] uppercase tracking-[0.2em] text-ink-muted">Schedule workspace</div>
            <h2 className="font-serif text-[20px] font-bold text-ink mt-1">Build the weekly schedule</h2>
            <p className="text-[12.5px] text-ink-dim mt-1 max-w-[650px]">
              This saved roadmap is still available in the tree. Build a detailed schedule when you are ready; completed missions will be matched where possible.
            </p>
          </div>
          <button
            onClick={() => void onScheduleAction({ upgradeLegacy: true })}
            disabled={scheduleBusy}
            className="rounded-full bg-ink text-paper px-4 py-2.5 text-[12px] font-semibold disabled:opacity-60"
          >
            {scheduleBusy ? "Building…" : "Build weekly schedule"}
          </button>
        </div>
      </section>
    );
  }

  const selected = schedule.units[selectedIndex];
  if (!selected) return null;

  if (selected.detailState === "deferred" || selected.detailState === "summary") {
    const yearIndex = selected.yearIndex ?? (selectedIndex >= 12 ? Math.floor(selectedIndex / 12) : selectedIndex);
    const deferredYear = selected.yearIndex !== undefined && selected.yearIndex > 0;
    return (
      <section className="mb-8 rounded-2xl bg-paper-card p-5 ring-1 ring-inset ring-polaris-500/10 dark:ring-white/[0.1]">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="text-[10px] uppercase tracking-[0.2em] text-ink-muted">{selected.label} · deferred detail</div>
            <h2 className="font-serif text-[20px] font-bold text-ink mt-1">{selected.title}</h2>
            <p className="text-[12.5px] text-ink-dim mt-1 max-w-[650px]">{selected.objective}</p>
          </div>
          <button
            onClick={() => void onScheduleAction({ yearIndex })}
            disabled={scheduleBusy}
            className="rounded-full bg-ink text-paper px-4 py-2.5 text-[12px] font-semibold disabled:opacity-60"
          >
            {scheduleBusy ? "Generating…" : deferredYear ? `Generate Year ${yearIndex + 1} plan` : `Generate ${selected.label} plan`}
          </button>
        </div>
      </section>
    );
  }

  const months = selected.months ?? [];
  const unitTasks = (unit: RoadmapScheduleUnit, monthIndex?: number) => nodes.flatMap((node) => node.tasks
    .filter((task) => taskInUnit(task, unit, monthIndex))
    .map((task) => ({ task, node })));

  return (
    <motion.section initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="mb-8 rounded-2xl bg-paper-card p-5 ring-1 ring-inset ring-polaris-500/10 dark:ring-white/[0.1]">
      <div className="flex flex-wrap items-end justify-between gap-3 mb-4">
        <div>
          <div className="text-[10px] uppercase tracking-[0.2em] text-ink-muted">Schedule workspace · {selected.label}</div>
          <h2 className="font-serif text-[22px] font-bold text-ink mt-1">{selected.title}</h2>
          <p className="text-[12.5px] text-ink-dim mt-1">{selected.objective}</p>
        </div>
        <span className="text-[11px] font-mono text-ink-muted">{progressLabel(unitTasks(selected))}</span>
      </div>

      {months.length > 0 ? (
        <div className="space-y-5">
          {months.map((month) => (
            <MonthSection key={month.monthIndex} month={month} rows={unitTasks(selected, month.monthIndex)} nodesById={nodesById} taskBusy={taskBusy} onOpenNode={onOpenNode} onToggle={toggleTask} />
          ))}
        </div>
      ) : selected.weeks ? (
        <div className="grid gap-3 md:grid-cols-2">
          {selected.weeks.map((week) => (
            <WeekSection key={week.weekIndex} title={week.title} objective={week.objective} rows={unitTasks(selected).filter(({ task }) => task.weekIndex === week.weekIndex)} taskBusy={taskBusy} onOpenNode={onOpenNode} onToggle={toggleTask} />
          ))}
        </div>
      ) : (
        <WeekSection title={selected.label} objective={selected.objective} rows={unitTasks(selected)} taskBusy={taskBusy} onOpenNode={onOpenNode} onToggle={toggleTask} />
      )}
    </motion.section>
  );
}

function taskInUnit(task: NodeTask, unit: RoadmapScheduleUnit, monthIndex?: number): boolean {
  if (unit.yearIndex !== undefined) {
    return task.yearIndex === unit.yearIndex && (monthIndex === undefined || task.monthIndex === monthIndex);
  }
  return task.unitIndex === unit.unitIndex && (monthIndex === undefined || task.monthIndex === monthIndex);
}

function progressLabel(rows: Array<{ task: NodeTask; node: RoadmapNode }>): string {
  if (!rows.length) return "No tasks";
  return `${rows.filter((row) => row.task.done).length}/${rows.length} tasks done`;
}

function MonthSection({ month, rows, nodesById, taskBusy, onOpenNode, onToggle }: {
  month: NonNullable<RoadmapScheduleUnit["months"]>[number];
  rows: Array<{ task: NodeTask; node: RoadmapNode }>;
  nodesById: Map<string, RoadmapNode>;
  taskBusy: string | null;
  onOpenNode: (id: string) => void;
  onToggle: (nodeId: string, taskId: string) => Promise<void>;
}) {
  return (
    <div className="rounded-xl bg-paper-soft/60 p-4 ring-1 ring-inset ring-polaris-500/10">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div>
          <h3 className="font-serif text-[18px] font-bold text-ink">{month.title}</h3>
          <p className="text-[11.5px] text-ink-dim mt-0.5">{month.objective}</p>
        </div>
        <span className="text-[10.5px] font-mono text-ink-muted">{progressLabel(rows)}</span>
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        {month.weeks.map((week) => (
          <WeekSection key={week.weekIndex} title={week.title} objective={week.objective} rows={rows.filter(({ task }) => task.weekIndex === week.weekIndex)} taskBusy={taskBusy} onOpenNode={onOpenNode} onToggle={onToggle} nodesById={nodesById} />
        ))}
      </div>
    </div>
  );
}

function WeekSection({ title, objective, rows, taskBusy, onOpenNode, onToggle, nodesById }: {
  title: string;
  objective: string;
  rows: Array<{ task: NodeTask; node: RoadmapNode }>;
  taskBusy: string | null;
  onOpenNode: (id: string) => void;
  onToggle: (nodeId: string, taskId: string) => Promise<void>;
  nodesById?: Map<string, RoadmapNode>;
}) {
  void nodesById;
  return (
    <div className="rounded-xl bg-paper-card p-3 ring-1 ring-inset ring-polaris-500/10">
      <div className="mb-2">
        <div className="text-[11.5px] font-semibold text-ink">{title}</div>
        <div className="text-[10.5px] text-ink-muted mt-0.5">{objective}</div>
      </div>
      {rows.length ? rows.map(({ task, node }) => {
        const busy = taskBusy === `${node.id}:${task.id}`;
        return (
          <label key={task.id} className="flex items-start gap-2.5 py-2 border-t border-polaris-500/10 cursor-pointer group">
            <input type="checkbox" checked={task.done} disabled={busy} onChange={() => void onToggle(node.id, task.id)} className="mt-0.5 accent-polaris-600" />
            <span className={cn("text-[12px] leading-snug flex-1", task.done ? "text-ink-muted line-through" : "text-ink")}>{task.text}</span>
            <button type="button" onClick={(event) => { event.preventDefault(); onOpenNode(node.id); }} className="shrink-0 text-[10px] text-ink-muted opacity-0 group-hover:opacity-100 hover:text-polaris-600 transition-opacity" title="Open mission">↗</button>
          </label>
        );
      }) : <div className="text-[11px] text-ink-muted py-2">No tasks assigned.</div>}
    </div>
  );
}
