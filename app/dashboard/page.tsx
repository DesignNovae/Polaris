"use client";

import { useEffect, useMemo, useState, useCallback, useRef } from "react";
import Link from "next/link";
import { useSession } from "@/components/SessionProvider";
import { Nav } from "@/components/Nav";
import { Footer } from "@/components/Footer";
import { useLang } from "@/lib/i18n/LangProvider";
import { usePlan, UpgradeCard } from "@/components/PlanGate";
import { cn } from "@/lib/cn";
import {
  PROFILE_KEY,
  ROADMAP_KEY,
  type StudentProfile,
} from "@/lib/profile";
import type { RoadmapMilestone } from "@/lib/llm/gemma";

type MilestoneStatus = "pending" | "in-progress" | "done";

type DbMilestone = RoadmapMilestone & {
  id: string;
  status: MilestoneStatus;
  completedAt?: string;
  deadline?: string;
};

type RoadmapData = {
  summary: string;
  gaps: string[];
  milestones: DbMilestone[];
};

type Stored = {
  roadmap: RoadmapData;
  retrieved: Array<{ id: string; title: string; source: string; score: number }>;
  source: "gemma4" | "fallback";
  version?: number;
};

type BenchmarkInsight = {
  type: "gap" | "strength" | "stat";
  title: string;
  items: string[];
};

type BenchmarkMatch = {
  id: string;
  title: string;
  whatWorked: string;
  tags: string[];
  matchScore: number;
};

type BenchmarkData = {
  topMatches: BenchmarkMatch[];
  insights: BenchmarkInsight[];
};

const CATEGORY_COLORS: Record<RoadmapMilestone["category"], string> = {
  Academics: "from-polaris-400 to-polaris-600",
  Testing: "from-nova-400 to-nova-500",
  Extracurriculars: "from-aurora-400 to-aurora-500",
  Skills: "from-polaris-300 to-nova-400",
  Applications: "from-nova-500 to-aurora-500",
};

const PRIORITY_LABELS: Record<RoadmapMilestone["priority"], string> = {
  high: "high",
  medium: "medium",
  low: "low",
};

export default function DashboardPage() {
  const { t } = useLang();
  const { data: session } = useSession();
  const { plan, can } = usePlan();
  const [data, setData] = useState<Stored | null>(null);
  const [profile, setProfile] = useState<StudentProfile | null>(null);
  const [regenerating, setRegenerating] = useState(false);
  const [loading, setLoading] = useState(true);
  const [benchmark, setBenchmark] = useState<BenchmarkData | null>(null);
  const benchFetched = useRef(false);

  const isLoggedIn = !!session?.user;

  useEffect(() => {
    async function load() {
      if (isLoggedIn) {
        try {
          const [roadmapRes, profileRes] = await Promise.all([
            fetch("/api/roadmap"),
            fetch("/api/profile"),
          ]);
          if (roadmapRes.ok) {
            const rData = await roadmapRes.json();
            if (rData.roadmap) setData(rData);
          }
          if (profileRes.ok) {
            const pData = await profileRes.json();
            if (pData.profile) setProfile(pData.profile);
          }
        } catch {}
      } else {
        try {
          const rRaw = window.localStorage.getItem(ROADMAP_KEY);
          const pRaw = window.localStorage.getItem(PROFILE_KEY);
          if (rRaw) setData(JSON.parse(rRaw));
          if (pRaw) setProfile(JSON.parse(pRaw));
        } catch {}
      }
      setLoading(false);
    }
    load();
  }, [isLoggedIn]);

  useEffect(() => {
    // Benchmarking is a Pro feature - skip the call for free users.
    if (!profile || benchFetched.current || !can("benchmark")) return;
    benchFetched.current = true;
    fetch("/api/benchmark", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ profile }),
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => d && setBenchmark(d))
      .catch(() => {});
  }, [profile, can]);

  const grouped = useMemo(() => {
    if (!data) return [];
    const map = new Map<string, DbMilestone[]>();
    for (const m of data.roadmap.milestones) {
      const arr = map.get(m.quarter) ?? [];
      arr.push(m);
      map.set(m.quarter, arr);
    }
    return Array.from(map.entries());
  }, [data]);

  const next30 = useMemo(() => {
    if (!data) return [];
    return data.roadmap.milestones
      .filter((m) => m.priority === "high" && m.status !== "done")
      .slice(0, 3);
  }, [data]);

  const progress = useMemo(() => {
    if (!data) return { done: 0, inProgress: 0, total: 0, pct: 0 };
    const ms = data.roadmap.milestones;
    const done = ms.filter((m) => m.status === "done").length;
    const inProgress = ms.filter((m) => m.status === "in-progress").length;
    return { done, inProgress, total: ms.length, pct: ms.length ? Math.round((done / ms.length) * 100) : 0 };
  }, [data]);

  const updateMilestone = useCallback(
    async (milestoneId: string, status: MilestoneStatus) => {
      if (!data) return;

      setData((prev) => {
        if (!prev) return prev;
        const newData = {
          ...prev,
          roadmap: {
            ...prev.roadmap,
            milestones: prev.roadmap.milestones.map((m) =>
              m.id === milestoneId
                ? { ...m, status, completedAt: status === "done" ? new Date().toISOString() : undefined }
                : m,
            ),
          },
        };
        if (!isLoggedIn) {
          window.localStorage.setItem(ROADMAP_KEY, JSON.stringify(newData));
        }
        return newData;
      });

      if (isLoggedIn) {
        await fetch("/api/milestones", {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ milestoneId, status }),
        });
      }
    },
    [data, isLoggedIn],
  );

  async function regenerate() {
    if (!profile) return;
    setRegenerating(true);
    try {
      const res = await fetch("/api/roadmap", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ profile }),
      });
      const newData = await res.json();
      if (!isLoggedIn) {
        window.localStorage.setItem(ROADMAP_KEY, JSON.stringify(newData));
      }
      setData(newData);
    } finally {
      setRegenerating(false);
    }
  }

  if (loading) {
    return (
      <main className="min-h-screen">
        <Nav />
        <section className="mx-auto max-w-6xl px-4 sm:px-6 py-20 text-center">
          <p className="text-ink-dim">Loading…</p>
        </section>
      </main>
    );
  }

  return (
    <main className="min-h-screen">
      <Nav />
      <section className="mx-auto max-w-6xl px-4 sm:px-6 py-8 sm:py-12">
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
          <div>
            <h1 className="text-3xl sm:text-4xl md:text-5xl font-serif font-bold tracking-tight">
              {t.dashboard.title}
            </h1>
            <p className="mt-3 text-ink-dim max-w-2xl">{t.dashboard.subtitle}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              href="/roadmap"
              className="rounded-full border border-polaris-300 bg-white px-5 py-2.5 text-sm text-ink hover:bg-polaris-50 hover:border-polaris-400 transition-colors duration-150"
            >
              {t.dashboard.runIntake}
            </Link>
            {profile && (
              <button
                onClick={regenerate}
                disabled={regenerating}
                className={cn(
                  "rounded-full px-5 py-2.5 text-sm font-medium transition-colors duration-150",
                  regenerating
                    ? "bg-polaris-200 text-ink-dim cursor-wait"
                    : "bg-polaris-500 text-white hover:bg-polaris-600 active:bg-polaris-700",
                )}
              >
                {regenerating ? "…" : t.dashboard.regenerate}
              </button>
            )}
            <Link
              href="/university"
              className="rounded-full border border-aurora-400 bg-white px-5 py-2.5 text-sm text-aurora-500 hover:bg-aurora-400/10 hover:border-aurora-500 transition-colors duration-150"
            >
              {t.dashboard.tryUni}
            </Link>
            <Link
              href="/case-studies"
              className="rounded-full border border-polaris-300 bg-white px-5 py-2.5 text-sm text-ink hover:bg-polaris-50 hover:border-polaris-400 transition-colors duration-150"
            >
              Case studies
            </Link>
          </div>
        </div>

        {plan === "free" ? (
          <div className="mt-12">
            <UpgradeCard
              tier="pro"
              title="Your AI roadmap is a Pro feature"
              description="Upgrade to Polaris Pro to generate a personalized, AI-built academic roadmap, track milestones, benchmark against accepted students, and more."
            />
          </div>
        ) : !data ? (
          <EmptyState />
        ) : (
          <>
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

            {/* Benchmark insights */}
            {benchmark && (
              <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
                {benchmark.insights.map((insight, i) => (
                  <div
                    key={i}
                    className={cn(
                      "glass rounded-2xl p-5",
                      insight.type === "gap" && "border-l-4 border-l-nova-400",
                      insight.type === "strength" && "border-l-4 border-l-aurora-400",
                      insight.type === "stat" && "border-l-4 border-l-polaris-400",
                    )}
                  >
                    <div className="text-xs uppercase tracking-[0.15em] text-ink-muted mb-2">
                      {insight.type === "gap" ? "Profile gap" : insight.type === "strength" ? "Your strength" : "Benchmark"}
                    </div>
                    <div className="text-sm font-semibold text-ink mb-2">{insight.title}</div>
                    <ul className="space-y-1">
                      {insight.items.map((item, j) => (
                        <li key={j} className="text-sm text-ink-dim flex gap-2">
                          <span className={cn(
                            "mt-1.5 flex-none h-1.5 w-1.5 rounded-full",
                            insight.type === "gap" ? "bg-nova-400" : insight.type === "strength" ? "bg-aurora-400" : "bg-polaris-400",
                          )} />
                          {item}
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            )}

            {/* Students like you */}
            {benchmark && benchmark.topMatches.length > 0 && (
              <div className="mt-6 glass rounded-2xl p-5">
                <div className="text-xs uppercase tracking-[0.2em] text-ink-muted mb-3">
                  Students like you who got accepted
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {benchmark.topMatches.slice(0, 3).map((m) => (
                    <Link
                      key={m.id}
                      href="/case-studies"
                      className="glass-strong rounded-xl p-4 hover:border-polaris-400/30 transition"
                    >
                      <div className="text-sm font-semibold text-ink mb-1">{m.title}</div>
                      <p className="text-xs text-ink-dim leading-relaxed line-clamp-3">{m.whatWorked}</p>
                      <div className="mt-2 flex flex-wrap gap-1">
                        {m.tags.slice(0, 3).map((tag) => (
                          <span key={tag} className="text-[10px] rounded-full border border-polaris-500/20 px-2 py-0.5 text-ink-muted">
                            {tag}
                          </span>
                        ))}
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            )}

            {/* Top strip: source badge + summary + gaps */}
            <div className="mt-6 grid grid-cols-1 lg:grid-cols-3 gap-5">
              <div className="lg:col-span-2 glass-strong rounded-2xl p-7">
                <div className="flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-ink-muted">
                  <span>{t.dashboard.summary}</span>
                  <SourceBadge source={data.source} />
                </div>
                <p className="mt-3 text-lg text-ink leading-relaxed">
                  {data.roadmap.summary}
                </p>
                {data.retrieved.length > 0 && (
                  <div className="mt-5 pt-5 border-t border-polaris-500/15">
                    <div className="text-xs uppercase tracking-[0.2em] text-ink-muted mb-2">
                      Grounded in
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {data.retrieved.slice(0, 5).map((r) => (
                        <span
                          key={r.id}
                          className="text-xs rounded-full border border-polaris-500/25 bg-polaris-500/8 px-2.5 py-1 text-ink-dim"
                          title={`${r.source} · score ${(r.score * 100).toFixed(0)}`}
                        >
                          {r.title}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div className="glass rounded-2xl p-7">
                <div className="text-xs uppercase tracking-[0.2em] text-ink-muted mb-3">
                  {t.dashboard.gaps}
                </div>
                <ul className="space-y-2.5 text-sm text-ink-dim">
                  {data.roadmap.gaps.map((g, i) => (
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
                    {t.dashboard.next30}
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
          </>
        )}
      </section>
      <Footer />
    </main>
  );
}

function MilestoneCard({
  m,
  onStatusChange,
}: {
  m: DbMilestone;
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
        {m.deadline && (
          <div className="mt-1 text-ink-muted">
            Deadline: {m.deadline}
          </div>
        )}
      </div>
    </div>
  );
}

function PriorityChip({ p }: { p: RoadmapMilestone["priority"] }) {
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

function SourceBadge({ source }: { source: "gemma4" | "fallback" }) {
  if (source === "gemma4") {
    return (
      <span className="text-[10px] rounded-full border border-aurora-400/40 bg-aurora-500/10 px-2 py-0.5 text-aurora-500 normal-case tracking-normal">
        Polaris AI · structured plan
      </span>
    );
  }
  return (
    <span className="text-[10px] rounded-full border border-polaris-400/30 bg-polaris-500/8 px-2 py-0.5 text-polaris-500 normal-case tracking-normal">
      Heuristic engine (no API key)
    </span>
  );
}

function EmptyState() {
  const { t } = useLang();
  return (
    <div className="mt-12 sm:mt-16 glass rounded-3xl p-8 sm:p-12 text-center">
      <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-polaris-500/10">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="text-polaris-500"><path d="M12 2l1.7 6.5L20 10l-5.4 3.7L16 20l-4-3.8L8 20l1.4-6.3L4 10l6.3-1.5L12 2z" /></svg>
      </div>
      <div className="text-ink mb-2 font-semibold">{t.dashboard.empty}</div>
      <Link
        href="/roadmap"
        className="inline-flex mt-4 rounded-full bg-polaris-500 px-6 py-2.5 text-sm font-semibold text-white hover:bg-polaris-600 active:bg-polaris-700 transition-colors duration-150"
      >
        {t.dashboard.runIntake}
      </Link>
    </div>
  );
}
