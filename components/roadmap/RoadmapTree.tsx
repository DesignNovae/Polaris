"use client";

/**
 * RoadmapTree - the skill-tree / growth-map visual.
 *
 *        ◎  crown = the goal (overall progress ring, glow)
 *        │
 *   ┌────┤ trunk (gradient line, fills with progress)
 *   │ 🌿 branch panel (left)
 *        ├────┐
 *        │ 🌿 branch panel (right)
 *        │
 *
 * Branches alternate sides on desktop, stack on mobile. Leaf nodes are
 * circular buttons with progress rings: done = lit green leaf, current =
 * glowing pulse, available = neutral, locked = dimmed + lock. Click → modal.
 */

import { motion } from "framer-motion";
import { cn } from "@/lib/cn";
import type { RoadmapDoc, RoadmapNode, RoadmapBranch, RoadmapScheduleUnit } from "@/lib/roadmap/types";
import { branchProgress, overallProgress } from "@/lib/roadmap/types";

const TONE = {
  polaris: { ring: "stroke-polaris-500", text: "text-polaris-600 dark:text-polaris-300", chip: "bg-polaris-100 text-polaris-700 ring-polaris-300 dark:bg-polaris-400/20 dark:text-polaris-100 dark:ring-polaris-400/40", bar: "from-polaris-400 to-polaris-600" },
  nova:    { ring: "stroke-nova-500",    text: "text-nova-600 dark:text-nova-200",       chip: "bg-nova-100 text-nova-600 ring-nova-400/40 dark:bg-nova-400/20 dark:text-nova-100 dark:ring-nova-400/40",       bar: "from-nova-400 to-nova-600" },
  aurora:  { ring: "stroke-aurora-500",  text: "text-aurora-600 dark:text-aurora-200",   chip: "bg-aurora-100 text-aurora-700 ring-aurora-400/40 dark:bg-aurora-400/20 dark:text-aurora-100 dark:ring-aurora-400/40", bar: "from-aurora-400 to-aurora-600" },
  rose:    { ring: "stroke-rose-500",    text: "text-rose-600 dark:text-rose-200",       chip: "bg-rose-50 text-rose-700 ring-rose-200 dark:bg-rose-400/20 dark:text-rose-100 dark:ring-rose-400/40",           bar: "from-rose-400 to-rose-500" },
} as const;

export type RoadmapWeekLeaf = {
  id: string;
  branchId: string;
  unitIndex: number;
  weekIndex: number;
  monthIndex?: number;
  kind: "day" | "week" | "month";
  title: string;
  objective: string;
  taskCount: number;
  doneCount: number;
  progress: number;
  taskRefs: Array<{ nodeId: string; taskId: string }>;
};

export function RoadmapTree({
  doc, onOpenNode, onOpenWeek, selectedNodeId, activePhase = null,
}: {
  doc: RoadmapDoc;
  onOpenNode: (nodeId: string) => void;
  onOpenWeek?: (week: RoadmapWeekLeaf) => void;
  selectedNodeId?: string | null;
  activePhase?: number | null;
}) {
  const overall = overallProgress(doc);
  // Order branches: high priority first, then by earliest node phase.
  const branches = [...doc.branches].sort((a, b) => {
    const pri = { high: 0, medium: 1, low: 2 };
    const ap = Math.min(...a.nodes.map((n) => n.phase), 99);
    const bp = Math.min(...b.nodes.map((n) => n.phase), 99);
    return ap - bp || pri[a.priority] - pri[b.priority];
  });
  const activeScheduleUnit = activePhase !== null
    ? doc.schedule?.units[activePhase]
    : undefined;

  return (
    <div className="relative isolate overflow-hidden rounded-[34px] border border-polaris-500/10 bg-gradient-to-b from-paper-card/35 via-transparent to-paper-card/25 px-2 py-8 sm:px-5">
      <div aria-hidden className="pointer-events-none absolute inset-0 opacity-60 [background-image:radial-gradient(circle_at_20%_15%,rgba(196,125,78,.17),transparent_24%),radial-gradient(circle_at_82%_42%,rgba(91,140,109,.14),transparent_26%),linear-gradient(rgba(196,125,78,.055)_1px,transparent_1px),linear-gradient(90deg,rgba(196,125,78,.055)_1px,transparent_1px)] [background-size:auto,auto,44px_44px,44px_44px]" />
      <motion.div aria-hidden className="pointer-events-none absolute left-[12%] top-20 h-2 w-2 rounded-full bg-polaris-400 shadow-[0_0_22px_rgba(196,125,78,.9)]" animate={{ y: [0, 20, 0], opacity: [.35, 1, .35] }} transition={{ duration: 5, repeat: Infinity }} />
      <motion.div aria-hidden className="pointer-events-none absolute right-[16%] top-[38%] h-2.5 w-2.5 rounded-full bg-aurora-400 shadow-[0_0_24px_rgba(91,140,109,.9)]" animate={{ y: [0, -24, 0], x: [0, 9, 0] }} transition={{ duration: 7, repeat: Infinity }} />
      {/* Trunk */}
      <div className="absolute top-[120px] bottom-6 left-6 lg:left-1/2 lg:-translate-x-1/2 w-[3px] rounded-full bg-paper-deep overflow-hidden" aria-hidden>
        <motion.div
          initial={{ height: 0 }}
          animate={{ height: `${Math.max(8, overall)}%` }}
          transition={{ duration: 1.4, ease: [0.16, 1, 0.3, 1], delay: 0.3 }}
          className="w-full bg-gradient-to-b from-polaris-500 via-nova-500 to-aurora-500"
        />
      </div>

      {/* Crown - the goal */}
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
        className="relative z-10 flex flex-col items-center mb-10 pl-12 lg:pl-0"
      >
        <div className="relative">
          <div className="absolute -inset-4 rounded-full bg-gradient-to-tr from-polaris-400/25 via-nova-400/20 to-aurora-400/25 blur-xl animate-pulse" style={{ animationDuration: "4s" }} />
          <motion.span aria-hidden className="absolute -inset-8 rounded-full border border-dashed border-polaris-400/25" animate={{ rotate: 360 }} transition={{ duration: 22, repeat: Infinity, ease: "linear" }} />
          <motion.span aria-hidden className="absolute -inset-14 rounded-full border border-aurora-400/10" animate={{ rotate: -360 }} transition={{ duration: 30, repeat: Infinity, ease: "linear" }} />
          <CrownRing pct={overall} />
        </div>
        <div className="mt-3 app-glass rounded-2xl px-5 py-2.5 text-center max-w-md">
          <div className="text-[10px] uppercase tracking-[0.2em] text-ink-muted font-medium">The goal</div>
          <div className="font-serif text-[16px] font-bold text-ink leading-tight">{doc.config.targetGoal}</div>
        </div>
      </motion.div>

      {/* Branches */}
      <div className="space-y-10">
        {branches
          .filter(b => activePhase === null || b.nodes.some(n => n.phase === activePhase))
          .map((b, i) => (
            <BranchRow key={b.id} branch={b} side={i % 2 === 0 ? "left" : "right"} phases={doc.phases} onOpenNode={onOpenNode} onOpenWeek={onOpenWeek} scheduleUnit={activeScheduleUnit} mode={doc.config.timelineMode} index={i} selectedNodeId={selectedNodeId} activePhase={activePhase} />
        ))}
      </div>
    </div>
  );
}

function CrownRing({ pct }: { pct: number }) {
  const r = 40;
  const c = 2 * Math.PI * r;
  return (
    <div className="relative h-[104px] w-[104px]">
      <svg viewBox="0 0 104 104" className="h-full w-full -rotate-90">
        <circle cx="52" cy="52" r={r} fill="none" strokeWidth="7" className="stroke-paper-deep" />
        <motion.circle
          cx="52" cy="52" r={r} fill="none" strokeWidth="7" strokeLinecap="round"
          stroke="url(#crownGrad)"
          initial={{ strokeDasharray: c, strokeDashoffset: c }}
          animate={{ strokeDashoffset: c - (c * pct) / 100 }}
          transition={{ duration: 1.4, ease: [0.16, 1, 0.3, 1], delay: 0.4 }}
        />
        <defs>
          <linearGradient id="crownGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#C47451" />
            <stop offset="55%" stopColor="#D9A441" />
            <stop offset="100%" stopColor="#5B8C6D" />
          </linearGradient>
        </defs>
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="font-serif text-[24px] font-bold text-ink leading-none tabular-nums">{pct}<span className="text-[12px]">%</span></span>
        <span className="text-[8.5px] uppercase tracking-wider text-ink-muted font-medium mt-0.5">grown</span>
      </div>
    </div>
  );
}

function BranchRow({
  branch, side, phases, onOpenNode, onOpenWeek, scheduleUnit, mode, index, selectedNodeId, activePhase,
}: {
  branch: RoadmapBranch;
  side: "left" | "right";
  phases: string[];
  onOpenNode: (id: string) => void;
  onOpenWeek?: (week: RoadmapWeekLeaf) => void;
  scheduleUnit?: RoadmapScheduleUnit;
  mode: RoadmapDoc["config"]["timelineMode"];
  index: number;
  selectedNodeId?: string | null;
  activePhase?: number | null;
}) {
  const tone = TONE[branch.tone];
  const pct = branchProgress(branch);
  const nodes = [...branch.nodes].sort((a, b) => a.phase - b.phase);
  const displayNodes = activePhase === null ? nodes : nodes.filter(n => n.phase === activePhase);
  const makeLeaf = (title: string, objective: string, kind: RoadmapWeekLeaf["kind"], weekIndex: number, monthIndex?: number): RoadmapWeekLeaf => {
    const rows = displayNodes.flatMap((node) => node.tasks
      .filter((task) => {
        if (kind === "month") return task.yearIndex === scheduleUnit?.yearIndex && task.monthIndex === monthIndex;
        if (mode === "monthly") return task.unitIndex === scheduleUnit?.unitIndex && task.weekIndex === weekIndex;
        return task.unitIndex === scheduleUnit?.unitIndex;
      })
      .map((task) => ({ nodeId: node.id, taskId: task.id, done: task.done })));
    const doneCount = rows.filter((row) => row.done).length;
    return {
      id: `${branch.id}-${kind}-${scheduleUnit?.unitIndex ?? 0}-${monthIndex ?? weekIndex}`,
      branchId: branch.id,
      unitIndex: scheduleUnit?.unitIndex ?? 0,
      weekIndex,
      ...(monthIndex !== undefined ? { monthIndex } : {}),
      kind,
      title,
      objective,
      taskCount: rows.length,
      doneCount,
      progress: rows.length ? Math.round((doneCount / rows.length) * 100) : 0,
      taskRefs: rows.map(({ nodeId, taskId }) => ({ nodeId, taskId })),
    };
  };
  const scheduleLeaves: RoadmapWeekLeaf[] = scheduleUnit
    ? mode === "monthly"
      ? (scheduleUnit.weeks ?? []).map((week) => makeLeaf(week.title || `Week ${week.weekIndex + 1}`, week.objective, "week", week.weekIndex))
      : mode === "yearly"
        ? (scheduleUnit.months ?? []).map((month) => makeLeaf(month.title, month.objective, "month", 0, month.monthIndex))
        : [makeLeaf(scheduleUnit.title, scheduleUnit.objective, mode === "daily" ? "day" : "week", 0)]
    : [];

  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-60px" }}
      transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1], delay: index * 0.04 }}
      className={cn(
        "relative grid grid-cols-1 lg:grid-cols-2 items-center",
        "pl-12 lg:pl-0",
      )}
    >
      {/* Connector: trunk → panel */}
      <svg
        aria-hidden
        className={cn(
          "absolute top-1/2 -translate-y-1/2 h-16 pointer-events-none",
          "left-6 w-6 lg:w-[8%]",
          side === "left" ? "lg:left-auto lg:right-1/2" : "lg:left-1/2",
          side === "left" && "lg:-scale-x-100",
        )}
        viewBox="0 0 100 64"
        preserveAspectRatio="none"
      >
        <path d="M0 32 C 35 32, 55 32, 100 32" fill="none" strokeWidth="2" strokeDasharray="5 5" className={cn("opacity-50", tone.ring)} />
      </svg>
      {/* Trunk junction dot */}
      <span
        aria-hidden
        className={cn(
          "absolute top-1/2 -translate-y-1/2 h-3 w-3 rounded-full ring-4 ring-paper z-10",
          "left-6 -translate-x-[4.5px] lg:left-1/2 lg:-translate-x-1/2",
          pct === 100 ? "bg-aurora-500" : pct > 0 ? "bg-polaris-500" : "bg-ink-faint",
        )}
      />

      {/* Panel */}
      <div className={cn(side === "right" && "lg:col-start-2", "lg:px-[10%] py-2", side === "left" ? "lg:pr-[10%] lg:pl-4" : "lg:pl-[10%] lg:pr-4")}>
        <div className="app-glass rounded-3xl p-5 relative overflow-hidden group transition-all duration-500 hover:-translate-y-1 hover:shadow-[0_24px_70px_-34px_rgba(196,125,78,.55)] [transform-style:preserve-3d] before:pointer-events-none before:absolute before:inset-0 before:bg-gradient-to-br before:from-white/[0.035] before:to-transparent before:opacity-0 hover:before:opacity-100">
          {/* top accent */}
          <div className={cn("absolute top-0 left-0 right-0 h-[3px] bg-gradient-to-r", tone.bar)} />
          <div className="flex items-center gap-2.5 mb-1">
            <span className={cn("text-[10.5px] uppercase tracking-wider font-bold rounded-full px-2 py-0.5 ring-1 ring-inset", tone.chip)}>
              {branch.category}
            </span>
            {branch.priority === "high" && (
              <span className="text-[9.5px] uppercase tracking-wider font-bold text-rose-600 dark:text-rose-200 bg-rose-50 dark:bg-rose-400/15 ring-1 ring-inset ring-rose-200 dark:ring-rose-400/30 rounded-full px-1.5 py-[1px]">
                priority
              </span>
            )}
            <span className="ml-auto font-mono text-[11px] text-ink-muted tabular-nums">{pct}%</span>
          </div>
          <h3 className="font-serif text-[18px] font-bold tracking-tight text-ink">{branch.title}</h3>
          {/* branch progress */}
          <div className="mt-2 h-1.5 rounded-full bg-paper-deep overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              whileInView={{ width: `${pct}%` }}
              viewport={{ once: true }}
              transition={{ duration: 1, ease: [0.16, 1, 0.3, 1], delay: 0.2 }}
              className={cn("h-full rounded-full bg-gradient-to-r", tone.bar)}
            />
          </div>

          {/* Leaves */}
          <div className="mt-5 flex flex-wrap gap-x-5 gap-y-6 justify-start">
            {scheduleUnit
              ? scheduleLeaves.map((week, wi) => (
                <WeekLeaf key={week.id} week={week} tone={branch.tone} onOpen={() => onOpenWeek?.(week)} delay={wi * 0.05} />
              ))
              : displayNodes.map((n, ni) => (
                <Leaf key={n.id} node={n} tone={branch.tone} phaseLabel={phases[n.phase] ?? `P${n.phase + 1}`} onOpen={() => onOpenNode(n.id)} delay={ni * 0.05} selected={n.id === selectedNodeId} />
              ))}
          </div>
        </div>
      </div>
    </motion.div>
  );
}

function Leaf({
  node, tone, phaseLabel, onOpen, delay, selected,
}: {
  node: RoadmapNode;
  tone: keyof typeof TONE;
  phaseLabel: string;
  onOpen: () => void;
  delay: number;
  selected?: boolean;
}) {
  const t = TONE[tone];
  const r = 26;
  const c = 2 * Math.PI * r;
  const pct = node.status === "done" ? 100 : node.progress;
  const locked = node.status === "locked";

  return (
    <motion.button
      initial={{ opacity: 0, scale: 0.8 }}
      whileInView={{ opacity: 1, scale: 1 }}
      viewport={{ once: true }}
      transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1], delay }}
      whileHover={locked ? {} : { y: -4, scale: 1.04 }}
      onClick={onOpen}
      className={cn("group/leaf flex flex-col items-center w-[86px] text-center", locked && "opacity-45")}
      title={locked ? `${node.title} (unlocks later)` : node.title}
    >
      <span className="relative h-[64px] w-[64px]">
        {/* glow for current */}
        {node.status === "current" && !selected && (
          <span className="absolute -inset-2 rounded-full bg-polaris-400/30 blur-md animate-pulse" aria-hidden />
        )}
        {/* Strategist-focus glow - mirrors the rail's focus card */}
        {selected && (
          <>
            <span className="absolute -inset-3 rounded-full bg-gradient-to-tr from-polaris-400/40 via-nova-400/30 to-aurora-400/40 blur-lg animate-pulse" aria-hidden />
            <span className="absolute -inset-1 rounded-full ring-2 ring-polaris-400/70" aria-hidden />
          </>
        )}
        <svg viewBox="0 0 64 64" className="absolute inset-0 h-full w-full -rotate-90">
          <circle cx="32" cy="32" r={r} fill="none" strokeWidth="4" className="stroke-paper-deep" />
          <circle
            cx="32" cy="32" r={r} fill="none" strokeWidth="4" strokeLinecap="round"
            strokeDasharray={c}
            strokeDashoffset={c - (c * pct) / 100}
            className={cn("transition-all duration-700", node.status === "done" ? "stroke-aurora-500" : t.ring)}
          />
        </svg>
        <span
          className={cn(
            "absolute inset-[7px] rounded-full flex items-center justify-center text-[16px] font-serif font-bold transition-all",
            node.status === "done"
              ? "bg-aurora-500 text-white shadow-[0_4px_14px_-4px_rgba(91,140,109,0.6)]"
              : "bg-paper-card text-ink shadow-card group-hover/leaf:shadow-pop",
            node.status === "current" && "ring-2 ring-polaris-400/60",
          )}
        >
          {node.status === "done" ? (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5"/></svg>
          ) : locked ? (
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="text-ink-muted"><rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></svg>
          ) : (
            node.title[0]?.toUpperCase()
          )}
        </span>
        {/* priority badge */}
        {node.priority === "high" && node.status !== "done" && (
          <span className="absolute -top-0.5 -right-0.5 h-3.5 w-3.5 rounded-full bg-rose-500 ring-2 ring-paper flex items-center justify-center" title="High priority">
            <span className="h-1 w-1 rounded-full bg-white" />
          </span>
        )}
      </span>
      <span className={cn("mt-2 text-[10.5px] leading-tight font-medium line-clamp-2", node.status === "done" ? "text-ink-muted line-through decoration-aurora-500/50" : "text-ink")}>
        {node.title}
      </span>
      <span className="mt-0.5 text-[9px] font-mono text-ink-muted">{phaseLabel}</span>
    </motion.button>
  );
}

function WeekLeaf({ week, tone, onOpen, delay }: {
  week: RoadmapWeekLeaf;
  tone: keyof typeof TONE;
  onOpen: () => void;
  delay: number;
}) {
  const t = TONE[tone];
  const r = 26;
  const c = 2 * Math.PI * r;
  const done = week.progress === 100 && week.taskCount > 0;

  return (
    <motion.button
      initial={{ opacity: 0, scale: 0.8 }}
      whileInView={{ opacity: 1, scale: 1 }}
      viewport={{ once: true }}
      transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1], delay }}
      whileHover={{ y: -4, scale: 1.04 }}
      onClick={onOpen}
      className="group/leaf flex flex-col items-center w-[86px] text-center"
      title={`${week.title}: ${week.objective}`}
    >
      <span className="relative h-[64px] w-[64px]">
        {week.progress > 0 && !done && <span className="absolute -inset-2 rounded-full bg-polaris-400/20 blur-md animate-pulse" aria-hidden />}
        <svg viewBox="0 0 64 64" className="absolute inset-0 h-full w-full -rotate-90">
          <circle cx="32" cy="32" r={r} fill="none" strokeWidth="4" className="stroke-paper-deep" />
          <circle
            cx="32" cy="32" r={r} fill="none" strokeWidth="4" strokeLinecap="round"
            strokeDasharray={c}
            strokeDashoffset={c - (c * week.progress) / 100}
            className={cn("transition-all duration-700", done ? "stroke-aurora-500" : t.ring)}
          />
        </svg>
        <span className={cn(
          "absolute inset-[7px] rounded-full flex items-center justify-center text-[14px] font-serif font-bold transition-all bg-paper-card text-ink shadow-card group-hover/leaf:shadow-pop",
          done && "bg-aurora-500 text-white shadow-[0_4px_14px_-4px_rgba(91,140,109,0.6)]",
        )}>
          {done ? "✓" : String((week.monthIndex ?? week.weekIndex) + 1).padStart(2, "0")}
        </span>
      </span>
      <span className={cn("mt-2 text-[10.5px] leading-tight font-medium line-clamp-2", done ? "text-ink-muted" : "text-ink")}>{week.title}</span>
      <span className="mt-0.5 text-[9px] font-mono text-ink-muted">{week.doneCount}/{week.taskCount} tasks</span>
    </motion.button>
  );
}
