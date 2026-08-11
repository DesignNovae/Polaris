"use client";

/**
 * StreakWidget - the real day streak, in the dark sidebar.
 *
 * Reads /api/streak (earned server-side by meaningful actions only - roadmap
 * progress, scores, replans, weekly tasks, deadlines; refreshes never count).
 *
 * Compact card: energy flame (lit when today is earned) + last-14-day
 * capsules + next-milestone bar. Click → detail overlay with the 8-week
 * heatmap, milestone badges, weekly consistency, and what earned today.
 */

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/cn";

type StreakDto = {
  current: number;
  longest: number;
  todayDone: boolean;
  days: string[];
  todayActions: string[];
  nextMilestone: number;
  earned: number[];
  weekCount: number;
};

const MILESTONES = [3, 7, 14, 30, 60, 100];
const MILESTONE_LABEL: Record<number, string> = {
  3: "Consistency", 7: "One week", 14: "Fortnight", 30: "Momentum", 60: "Relentless", 100: "Centurion",
};

function dayKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function StreakWidget({ demo = false }: { demo?: boolean }) {
  const [data, setData] = useState<StreakDto | null>(demo ? {
    current: 0, longest: 0, todayDone: false, days: [], todayActions: [],
    nextMilestone: 3, earned: [], weekCount: 0,
  } : null);
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    let alive = true;
    if (!demo) {
      fetch("/api/streak", { cache: "no-store" })
        .then((r) => (r.ok ? r.json() : null))
        .then((d) => { if (alive && d) setData(d as StreakDto); })
        .catch(() => {});
    }
    // The header account menu's "Day streak" item opens the detail overlay.
    function onOpen() { setOpen(true); }
    window.addEventListener("polaris:openStreak", onOpen);
    return () => { alive = false; window.removeEventListener("polaris:openStreak", onOpen); };
  }, [demo]);

  // Last 14 calendar days for the capsule strip.
  const daySet = new Set(data?.days ?? []);
  const capsules = Array.from({ length: 14 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (13 - i));
    const key = dayKey(d);
    return { key, active: daySet.has(key), isToday: i === 13 };
  });

  const current = data?.current ?? 0;
  const next = data?.nextMilestone ?? 3;
  const prevMilestone = [...MILESTONES].reverse().find((m) => m <= current) ?? 0;
  const milestonePct = next > prevMilestone
    ? Math.min(100, Math.max(4, ((current - prevMilestone) / (next - prevMilestone)) * 100))
    : 100;

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="w-full mt-5 mb-3 mx-1 rounded-xl bg-white/[0.04] ring-1 ring-inset ring-white/[0.08] p-3 text-left hover:bg-white/[0.07] transition-colors group"
        aria-label="Open streak details"
      >
        <div className="flex items-center gap-2 mb-2.5">
          <Flame lit={data?.todayDone ?? false} />
          <div className="min-w-0">
            <div className="text-[11px] font-semibold text-paper leading-tight">Day streak</div>
            <div className="text-[9.5px] text-paper/45 leading-tight">
              {data === null ? "loading…" : data.todayDone ? "today earned" : "do one task today"}
            </div>
          </div>
          <span className="ml-auto font-serif text-[20px] font-bold text-paper tabular-nums leading-none group-hover:scale-110 transition-transform">
            {data === null ? "·" : current}
          </span>
        </div>

        {/* capsule strip */}
        <div className="flex gap-[3px]">
          {capsules.map((c) => (
            <span
              key={c.key}
              className={cn(
                "h-4 flex-1 rounded-[3px] transition-colors",
                c.active
                  ? "bg-gradient-to-b from-polaris-300 to-polaris-500 shadow-[0_0_6px_rgba(196,125,78,0.55)]"
                  : "bg-white/[0.07]",
                c.isToday && !c.active && "ring-1 ring-inset ring-polaris-400/60",
              )}
            />
          ))}
        </div>

        {/* milestone bar */}
        <div className="mt-2.5 flex items-center gap-2">
          <div className="flex-1 h-1 rounded-full bg-white/[0.08] overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${data ? milestonePct : 0}%` }}
              transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
              className="h-full rounded-full bg-gradient-to-r from-polaris-400 to-aurora-400"
            />
          </div>
          <span className="font-mono text-[9px] text-paper/45 shrink-0">{current}/{next}</span>
        </div>
      </button>

      {/* Portal to <body>: the sidebar's backdrop-filter creates a containing
          block that would trap this fixed overlay inside the 250px column,
          and the .app-glass-dark variable flip would force it light. Outside
          both, it centers on the viewport and follows the page theme. */}
      {mounted &&
        createPortal(
          <AnimatePresence>
            {open && data && <StreakDetail data={data} onClose={() => setOpen(false)} />}
          </AnimatePresence>,
          document.body,
        )}
    </>
  );
}

/* ─── flame orb ─── */

function Flame({ lit }: { lit: boolean }) {
  return (
    <span className="relative h-8 w-8 shrink-0 inline-flex items-center justify-center">
      {lit && <span className="absolute inset-0 rounded-full bg-polaris-400/35 blur-md animate-pulse" aria-hidden />}
      <span className={cn(
        "relative h-8 w-8 rounded-full inline-flex items-center justify-center ring-1 ring-inset transition-colors",
        lit ? "bg-gradient-to-b from-polaris-400/30 to-nova-400/20 ring-polaris-300/40 text-polaris-300" : "bg-white/[0.05] ring-white/[0.1] text-paper/30",
      )}>
        <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
          <path d="M12 23c-4.4 0-8-3.2-8-7.7 0-2.8 1.3-4.8 2.8-6.6.9-1.1 2-2.2 2.7-3.5.4.9.5 1.8.3 2.8-.2 1-.7 1.9-.7 2.9 0 1.4 1.1 2.4 2.4 2.4 2 0 2.9-1.7 2.6-3.6-.2-1.3-.8-2.4-.8-3.7 0-1.8 1-3.3 2.5-4-1 2.6 2 4.3 3.3 6.3 1.2 1.8 1.9 3.7 1.9 5.9 0 4.6-3.6 8.8-9 8.8z"/>
        </svg>
      </span>
    </span>
  );
}

/* ─── detail overlay ─── */

function StreakDetail({ data, onClose }: { data: StreakDto; onClose: () => void }) {
  // 8-week heatmap: columns = weeks (oldest → newest), rows = Mon..Sun.
  const daySet = new Set(data.days);
  const today = new Date();
  const monOffset = (today.getDay() + 6) % 7; // days since Monday
  const weeks: Array<Array<{ key: string; active: boolean; future: boolean }>> = [];
  for (let w = 7; w >= 0; w--) {
    const col: Array<{ key: string; active: boolean; future: boolean }> = [];
    for (let dow = 0; dow < 7; dow++) {
      const d = new Date(today);
      d.setDate(today.getDate() - monOffset - w * 7 + dow);
      const key = dayKey(d);
      col.push({ key, active: daySet.has(key), future: d > today });
    }
    weeks.push(col);
  }

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.18 }}
      className="fixed inset-0 z-[70] flex items-center justify-center bg-ink/55 backdrop-blur-sm p-4"
      role="dialog" aria-modal="true" onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.95, y: 14, opacity: 0 }} animate={{ scale: 1, y: 0, opacity: 1 }} exit={{ scale: 0.95, y: 14, opacity: 0 }}
        transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-[420px] max-h-[88vh] overflow-y-auto rounded-3xl bg-paper-card shadow-pop ring-1 ring-inset ring-polaris-500/10 dark:ring-white/[0.12] p-6"
      >
        <div className="flex items-start gap-3 mb-5">
          <Flame lit={data.todayDone} />
          <div className="flex-1 min-w-0">
            <h2 className="font-serif text-[20px] font-bold tracking-tight text-ink leading-tight">
              {data.current}-day streak
            </h2>
            <p className="text-[11.5px] text-ink-muted mt-0.5">
              {data.todayDone
                ? "Today is locked in - real work, not refreshes."
                : "Complete one roadmap task, score, or deadline today to keep it alive."}
            </p>
          </div>
          <button onClick={onClose} className="text-ink-muted hover:text-ink p-1" aria-label="Close">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M18 6L6 18M6 6l12 12"/></svg>
          </button>
        </div>

        {/* stats row */}
        <div className="grid grid-cols-3 gap-2 mb-5">
          <MiniStat label="Current" value={String(data.current)} />
          <MiniStat label="Longest" value={String(data.longest)} />
          <MiniStat label="This week" value={`${data.weekCount}/7`} />
        </div>

        {/* heatmap */}
        <div className="mb-5">
          <div className="text-[10px] uppercase tracking-[0.2em] text-ink-muted font-bold mb-2">Last 8 weeks</div>
          <div className="flex gap-[4px]">
            {weeks.map((col, i) => (
              <div key={i} className="flex flex-col gap-[4px] flex-1">
                {col.map((c) => (
                  <div
                    key={c.key}
                    title={c.key}
                    className={cn(
                      "aspect-square rounded-[4px]",
                      c.future ? "bg-transparent" :
                      c.active
                        ? "bg-gradient-to-br from-polaris-400 to-polaris-600 shadow-[0_0_5px_rgba(196,125,78,0.4)]"
                        : "bg-paper-deep dark:bg-white/[0.06]",
                    )}
                  />
                ))}
              </div>
            ))}
          </div>
        </div>

        {/* milestones */}
        <div className="mb-5">
          <div className="text-[10px] uppercase tracking-[0.2em] text-ink-muted font-bold mb-2">Milestones</div>
          <div className="flex flex-wrap gap-1.5">
            {MILESTONES.map((m) => {
              const earned = data.earned.includes(m);
              return (
                <span key={m} className={cn(
                  "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10.5px] font-semibold ring-1 ring-inset",
                  earned
                    ? "bg-aurora-100 text-aurora-700 ring-aurora-400/40 dark:bg-aurora-400/15 dark:text-aurora-100 dark:ring-aurora-400/30"
                    : "bg-paper-soft text-ink-muted ring-polaris-500/10 dark:ring-white/[0.08]",
                )}>
                  {earned ? (
                    <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5"/></svg>
                  ) : (
                    <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></svg>
                  )}
                  {m}d · {MILESTONE_LABEL[m]}
                </span>
              );
            })}
          </div>
        </div>

        {/* what earned today */}
        {data.todayActions.length > 0 && (
          <div className="rounded-xl bg-paper-soft px-4 py-3">
            <div className="text-[10px] uppercase tracking-[0.2em] text-ink-muted font-bold mb-1.5">Earned today by</div>
            <ul className="space-y-1">
              {data.todayActions.map((a) => (
                <li key={a} className="flex items-start gap-2 text-[12px] text-ink leading-relaxed">
                  <span className="mt-1.5 h-1 w-1 rounded-full bg-aurora-500 shrink-0" /> {a}
                </li>
              ))}
            </ul>
          </div>
        )}
        {!data.todayDone && (
          <Link href="/roadmap" onClick={onClose}
            className="mt-4 block w-full h-10 rounded-full bg-ink text-paper text-[12.5px] font-semibold hover:bg-polaris-700 transition-colors text-center leading-10">
            Do today&apos;s task →
          </Link>
        )}
      </motion.div>
    </motion.div>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-paper-soft px-3 py-2.5 text-center">
      <div className="font-serif text-[18px] font-bold text-ink tabular-nums leading-none">{value}</div>
      <div className="text-[9px] uppercase tracking-wider font-bold text-ink-muted mt-1">{label}</div>
    </div>
  );
}
