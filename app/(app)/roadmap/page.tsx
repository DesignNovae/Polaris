"use client";

/**
 * Dashboard / Roadmap homepage — static skeleton with hardcoded mock data.
 *
 * All UI elements match the prototype visually. Buttons toggle client-side
 * state but nothing persists to a backend. Navigation links that would go
 * to other app sections are disabled.
 */

import { useMemo, useState, useCallback } from "react";
import { cn } from "@/lib/cn";

/* ─── Types ─── */

type MilestoneCategory = "Academics" | "Testing" | "Extracurriculars" | "Skills" | "Applications";
type MilestonePriority = "high" | "medium" | "low";
type MilestoneStatus = "pending" | "in-progress" | "done";

type MockMilestone = {
  id: string;
  title: string;
  description: string;
  category: MilestoneCategory;
  priority: MilestonePriority;
  quarter: string;
  metric: string;
  rationale: string;
  status: MilestoneStatus;
};

/* ─── Static mock data ─── */

const MOCK_SUMMARY = "Based on your profile, Polaris has designed a structured roadmap that addresses key academic gaps while building on your existing strengths in extracurriculars and leadership. The plan balances test preparation, research exposure, and application readiness across the next 12 months.";

const MOCK_GAPS = [
  "No standardised test scores on record yet (SAT/ACT needed for target tier)",
  "Research experience is limited — at least one guided project recommended",
  "Application essays need early drafting to allow iterative refinement",
  "Letter of recommendation pipeline needs 2–3 faculty or mentor connections",
];

const MOCK_MILESTONES: MockMilestone[] = [
  {
    id: "m1", title: "Register for SAT and begin prep",
    description: "Sign up for the next available SAT date and start a structured study plan covering all sections.",
    category: "Testing", priority: "high", quarter: "Q3 2025",
    metric: "Target score ≥ 1400", rationale: "Top-50 schools expect scores in the 1400+ range. Early registration gives 3 months of prep time.",
    status: "in-progress",
  },
  {
    id: "m2", title: "Complete AP Calculus BC with A grade",
    description: "Finish the AP Calculus BC curriculum and aim for an A in the course to demonstrate quantitative readiness.",
    category: "Academics", priority: "high", quarter: "Q3 2025",
    metric: "Course grade A or A+", rationale: "Strong calculus performance signals STEM readiness to admissions committees.",
    status: "done",
  },
  {
    id: "m3", title: "Start undergraduate research project",
    description: "Approach a faculty mentor about joining an ongoing research project or propose a small independent study.",
    category: "Extracurriculars", priority: "high", quarter: "Q3 2025",
    metric: "Active research by end of quarter", rationale: "Research experience is a significant differentiator for elite-tier applications.",
    status: "pending",
  },
  {
    id: "m4", title: "Draft Common App personal essay",
    description: "Write a first draft of your main personal statement. Focus on authentic storytelling and unique perspective.",
    category: "Applications", priority: "medium", quarter: "Q4 2025",
    metric: "Complete first draft (650 words)", rationale: "Starting early allows multiple revision cycles and feedback from mentors.",
    status: "pending",
  },
  {
    id: "m5", title: "Build portfolio website",
    description: "Create a simple personal website showcasing projects, achievements, and extracurricular involvement.",
    category: "Skills", priority: "medium", quarter: "Q4 2025",
    metric: "Live site with 3+ project showcases", rationale: "A portfolio demonstrates initiative and technical skill beyond what transcripts show.",
    status: "pending",
  },
  {
    id: "m6", title: "Secure 2 recommendation letters",
    description: "Identify and approach 2 teachers or mentors who know your work well. Provide them context packets.",
    category: "Applications", priority: "high", quarter: "Q4 2025",
    metric: "2 confirmed recommenders", rationale: "Strong, specific letters are critical. Early asks give writers time to craft thoughtful responses.",
    status: "pending",
  },
  {
    id: "m7", title: "Complete 40 hours of community service",
    description: "Engage in a sustained community service commitment rather than one-off events.",
    category: "Extracurriculars", priority: "low", quarter: "Q4 2025",
    metric: "40+ hours logged", rationale: "Consistent community engagement demonstrates character and commitment beyond academics.",
    status: "pending",
  },
  {
    id: "m8", title: "Take SAT and achieve target score",
    description: "Sit for the SAT exam. If score is below target, plan a retake within 2 months.",
    category: "Testing", priority: "high", quarter: "Q1 2026",
    metric: "Score ≥ 1400", rationale: "Having scores finalized early allows focus to shift entirely to applications.",
    status: "pending",
  },
  {
    id: "m9", title: "Finalize university shortlist",
    description: "Research and finalise a balanced list of 8–12 universities across reach, match, and safety tiers.",
    category: "Applications", priority: "medium", quarter: "Q1 2026",
    metric: "Finalised list of 8–12 schools", rationale: "A strategic mix ensures strong options regardless of individual outcomes.",
    status: "pending",
  },
  {
    id: "m10", title: "Learn Python for data analysis",
    description: "Complete an introductory Python course focused on data manipulation and visualisation.",
    category: "Skills", priority: "low", quarter: "Q1 2026",
    metric: "Complete online course + 1 project", rationale: "Python proficiency strengthens STEM applications and enables research tooling.",
    status: "pending",
  },
];

const CATEGORY_COLORS: Record<MilestoneCategory, string> = {
  Academics: "from-polaris-400 to-polaris-600",
  Testing: "from-nova-400 to-nova-500",
  Extracurriculars: "from-aurora-400 to-aurora-500",
  Skills: "from-polaris-300 to-nova-400",
  Applications: "from-nova-500 to-aurora-500",
};

const PRIORITY_LABELS: Record<MilestonePriority, string> = {
  high: "high",
  medium: "medium",
  low: "low",
};

/* ─── Page component ─── */

export default function RoadmapPage() {
  const [milestones, setMilestones] = useState(MOCK_MILESTONES);

  const grouped = useMemo(() => {
    const map = new Map<string, MockMilestone[]>();
    for (const m of milestones) {
      const arr = map.get(m.quarter) ?? [];
      arr.push(m);
      map.set(m.quarter, arr);
    }
    return Array.from(map.entries());
  }, [milestones]);

  const next30 = useMemo(() => {
    return milestones
      .filter((m) => m.priority === "high" && m.status !== "done")
      .slice(0, 3);
  }, [milestones]);

  const progress = useMemo(() => {
    const done = milestones.filter((m) => m.status === "done").length;
    const inProgress = milestones.filter((m) => m.status === "in-progress").length;
    return { done, inProgress, total: milestones.length, pct: milestones.length ? Math.round((done / milestones.length) * 100) : 0 };
  }, [milestones]);

  const updateMilestone = useCallback(
    (milestoneId: string, status: MilestoneStatus) => {
      setMilestones((prev) =>
        prev.map((m) =>
          m.id === milestoneId ? { ...m, status } : m,
        ),
      );
    },
    [],
  );

  return (
    <section className="mx-auto max-w-6xl px-4 sm:px-6 py-8 sm:py-12">
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
        <div>
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-serif font-bold tracking-tight">
            Your Roadmap
          </h1>
          <p className="mt-3 text-ink-dim max-w-2xl">Your personalised academic strategy, powered by AI analysis of your profile.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => {}}
            className="rounded-full border border-polaris-300 bg-white px-5 py-2.5 text-sm text-ink hover:bg-polaris-50 hover:border-polaris-400 transition-colors duration-150 cursor-default"
          >
            Run intake
          </button>
          <button
            onClick={() => {}}
            className="rounded-full bg-polaris-500 px-5 py-2.5 text-sm font-medium text-white hover:bg-polaris-600 active:bg-polaris-700 transition-colors duration-150 cursor-default"
          >
            Regenerate
          </button>
          <button
            onClick={() => {}}
            className="rounded-full border border-aurora-400 bg-white px-5 py-2.5 text-sm text-aurora-500 hover:bg-aurora-400/10 hover:border-aurora-500 transition-colors duration-150 cursor-default"
          >
            Try University Fit
          </button>
          <button
            onClick={() => {}}
            className="rounded-full border border-polaris-300 bg-white px-5 py-2.5 text-sm text-ink hover:bg-polaris-50 hover:border-polaris-400 transition-colors duration-150 cursor-default"
          >
            Case studies
          </button>
        </div>
      </div>

      {/* Progress bar */}
      <div className="mt-10 glass-strong rounded-2xl p-5">
        <div className="flex items-center justify-between mb-3">
          <div className="text-xs uppercase tracking-[0.2em] text-ink-muted">
            Your progress
          </div>
          <div className="text-sm font-semibold text-ink tabular-nums">
            {progress.done}/{progress.total} completed ({progress.pct}%)
          </div>
        </div>
        <div className="h-2 rounded-full bg-polaris-100 overflow-hidden">
          <div
            className="h-full bg-aurora-500 rounded-full transition-all duration-500"
            style={{ width: `${progress.pct}%` }}
          />
        </div>
        <div className="mt-2 flex gap-4 text-xs text-ink-muted">
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-aurora-500" />
            {progress.done} done
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-polaris-400" />
            {progress.inProgress} in progress
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-polaris-200" />
            {progress.total - progress.done - progress.inProgress} pending
          </span>
        </div>
      </div>

      {/* Summary + Gaps */}
      <div className="mt-6 grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2 glass-strong rounded-2xl p-7">
          <div className="flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-ink-muted">
            <span>Summary</span>
            <span className="text-[10px] rounded-full border border-aurora-400/40 bg-aurora-500/10 px-2 py-0.5 text-aurora-500 normal-case tracking-normal">
              AI Generated · static demo
            </span>
          </div>
          <p className="mt-3 text-lg text-ink leading-relaxed">
            {MOCK_SUMMARY}
          </p>
        </div>

        <div className="glass rounded-2xl p-7">
          <div className="text-xs uppercase tracking-[0.2em] text-ink-muted mb-3">
            Profile Gaps
          </div>
          <ul className="space-y-2.5 text-sm text-ink-dim">
            {MOCK_GAPS.map((g, i) => (
              <li key={i} className="flex gap-2">
                <span className="text-nova-400 mt-0.5">●</span>
                <span>{g}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Next 30 days focus card */}
      {next30.length > 0 && (
        <div className="mt-8 rounded-2xl p-7 relative overflow-hidden border-2 border-polaris-400/30 bg-gradient-to-br from-polaris-500/8 to-nova-500/8">
          <div className="absolute -top-20 -right-20 h-48 w-48 rounded-full bg-polaris-500/10 blur-3xl" />
          <div className="relative">
            <div className="text-xs uppercase tracking-[0.2em] text-polaris-500 mb-3 flex items-center gap-1.5">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-polaris-400"><circle cx="12" cy="12" r="10" /><circle cx="12" cy="12" r="6" /><circle cx="12" cy="12" r="2" /></svg>
              Next 30 Days Focus
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {next30.map((m) => (
                <div key={m.id} className="glass-strong rounded-xl p-4">
                  <div className="text-xs text-ink-muted mb-1">{m.category}</div>
                  <div className="text-sm font-semibold text-ink">{m.title}</div>
                  <div className="mt-2 text-xs text-aurora-500 font-medium">{m.metric}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Quarter-grouped milestones */}
      <div className="mt-12 space-y-8">
        {grouped.map(([quarter, items]) => (
          <div key={quarter}>
            <div className="flex items-center gap-3 mb-4">
              <div className="text-xs uppercase tracking-[0.2em] text-ink-muted">
                {quarter}
              </div>
              <div className="flex-1 h-px bg-polaris-500/15" />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {items.map((m) => (
                <MilestoneCard
                  key={m.id}
                  m={m}
                  onStatusChange={updateMilestone}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

/* ─── Milestone Card ─── */

function MilestoneCard({
  m,
  onStatusChange,
}: {
  m: MockMilestone;
  onStatusChange: (id: string, status: MilestoneStatus) => void;
}) {
  const accent = CATEGORY_COLORS[m.category];
  const nextStatus: Record<MilestoneStatus, MilestoneStatus> = {
    pending: "in-progress",
    "in-progress": "done",
    done: "pending",
  };
  const statusLabel: Record<MilestoneStatus, string> = {
    pending: "Start",
    "in-progress": "Complete",
    done: "Done",
  };
  const statusStyle: Record<MilestoneStatus, string> = {
    pending: "border-polaris-300 text-ink-dim hover:bg-polaris-50",
    "in-progress": "border-polaris-400 bg-polaris-500 text-white hover:bg-polaris-600",
    done: "border-aurora-400 bg-aurora-500 text-white hover:bg-aurora-400",
  };

  return (
    <div
      className={cn(
        "glass rounded-2xl p-5 relative overflow-hidden hover:border-polaris-400/30 hover:shadow-md transition",
        m.status === "done" && "opacity-75",
      )}
    >
      <div className={cn("absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r", accent)} />
      <div className="flex items-start justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <span
            className={cn(
              "text-xs rounded-full px-2.5 py-0.5 bg-gradient-to-r text-white font-medium",
              accent,
            )}
          >
            {m.category}
          </span>
          <PriorityChip p={m.priority} />
        </div>
        <button
          onClick={() => onStatusChange(m.id, nextStatus[m.status])}
          className={cn(
            "text-xs rounded-full border px-3 py-1 font-medium transition-colors duration-150",
            statusStyle[m.status],
          )}
        >
          {m.status === "done" ? "✓ Done" : statusLabel[m.status]}
        </button>
      </div>
      <div className={cn("mt-3 font-semibold text-ink", m.status === "done" && "line-through")}>
        {m.title}
      </div>
      <p className="mt-1.5 text-sm text-ink-dim leading-relaxed">{m.description}</p>
      <div className="mt-3 pt-3 border-t border-polaris-500/15 text-xs">
        <div className="text-ink-muted italic leading-relaxed">{m.rationale}</div>
        <div className="mt-2 inline-flex items-center gap-1.5 text-aurora-500 font-medium">
          <Target /> {m.metric}
        </div>
      </div>
    </div>
  );
}

function PriorityChip({ p }: { p: MilestonePriority }) {
  const map = {
    high: "border-nova-500/40 bg-nova-500/10 text-nova-500",
    medium: "border-polaris-400/30 bg-polaris-500/8 text-polaris-500",
    low: "border-ink-muted/30 bg-bg-soft/50 text-ink-muted",
  };
  return (
    <span className={cn("text-xs rounded-full border px-2.5 py-0.5", map[p])}>
      {PRIORITY_LABELS[p]}
    </span>
  );
}

function Target() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <circle cx="12" cy="12" r="6" />
      <circle cx="12" cy="12" r="2" />
    </svg>
  );
}
