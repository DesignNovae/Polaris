"use client";

/**
 * Deadlines - intelligent admission-planning calendar.
 *
 *   Workload strip   - next 7/14/30 days: counts, urgent, open items, est. hours
 *   View toggle      - Agenda (countdown cards) · Month (calendar) · Board (risk kanban)
 *   Detail modal     - countdown ring, checklist, notes, reminders, source badge,
 *                      reschedule, mark complete, Ask Strategist
 *   Create modal     - typed deadlines with checklist seeds
 *
 * Risk = days remaining × open checklist × priority. University-sourced
 * deadlines show the school's logo + official link. Completing/importing
 * emits shared-store events so the Strategist stays aware.
 */

import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/cn";

/* ─── types ─── */

export type UiChecklistItem = { id: string; text: string; done: boolean };

export type UiDeadline = {
  id: string;
  date: string; // YYYY-MM-DD
  title: string;
  kind: "hard" | "soft" | "repeat";
  milestoneId?: string;
  type: string;
  priority: "high" | "medium" | "low";
  status: "pending" | "done";
  universityId?: string;
  universityName?: string;
  officialLink?: string;
  notes: string;
  checklist: UiChecklistItem[];
  reminderDays: number[];
  source?: string;
};

type View = "agenda" | "month" | "board";
type Risk = "overdue" | "urgent" | "approaching" | "safe" | "done";
const DEMO_DEADLINES_KEY = "polaris.demo.deadlines.v1";

const TYPE_META: Record<string, { label: string; tone: string; tile: string }> = {
  "application":       { label: "Application",    tone: "text-polaris-600 dark:text-polaris-300", tile: "from-polaris-500/20 to-polaris-500/5 text-polaris-600 dark:text-polaris-300" },
  "scholarship":       { label: "Scholarship",    tone: "text-aurora-600 dark:text-aurora-200",   tile: "from-aurora-500/20 to-aurora-500/5 text-aurora-600 dark:text-aurora-200" },
  "test-registration": { label: "Test signup",    tone: "text-nova-600 dark:text-nova-200",       tile: "from-nova-500/20 to-nova-500/5 text-nova-600 dark:text-nova-200" },
  "test-exam":         { label: "Test day",       tone: "text-nova-600 dark:text-nova-200",       tile: "from-nova-500/25 to-nova-500/5 text-nova-600 dark:text-nova-200" },
  "school-exam":       { label: "School exam",    tone: "text-polaris-600 dark:text-polaris-300", tile: "from-polaris-500/20 to-polaris-500/5 text-polaris-600 dark:text-polaris-300" },
  "essay":             { label: "Essay",          tone: "text-rose-600 dark:text-rose-200",       tile: "from-rose-500/20 to-rose-500/5 text-rose-600 dark:text-rose-200" },
  "recommendation":    { label: "Recommendation", tone: "text-polaris-600 dark:text-polaris-300", tile: "from-polaris-500/15 to-polaris-500/5 text-polaris-600 dark:text-polaris-300" },
  "document":          { label: "Document",       tone: "text-ink-dim",                            tile: "from-ink/10 to-ink/[0.03] text-ink-dim dark:from-white/15 dark:to-white/5" },
  "interview":         { label: "Interview",      tone: "text-rose-600 dark:text-rose-200",       tile: "from-rose-500/20 to-rose-500/5 text-rose-600 dark:text-rose-200" },
  "visa":              { label: "Visa",           tone: "text-nova-600 dark:text-nova-200",       tile: "from-nova-500/20 to-nova-500/5 text-nova-600 dark:text-nova-200" },
  "olympiad":          { label: "Olympiad",       tone: "text-nova-600 dark:text-nova-200",       tile: "from-nova-500/25 to-nova-500/5 text-nova-600 dark:text-nova-200" },
  "project":           { label: "Project",        tone: "text-aurora-600 dark:text-aurora-200",   tile: "from-aurora-500/20 to-aurora-500/5 text-aurora-600 dark:text-aurora-200" },
  "custom":            { label: "Custom",         tone: "text-ink-dim",                            tile: "from-ink/10 to-ink/[0.03] text-ink-dim dark:from-white/15 dark:to-white/5" },
};

/** Line-icon set for deadline types - crisp SVGs instead of emojis. */
const TYPE_PATHS: Record<string, string> = {
  "application":       "M22 10L12 5 2 10l10 5 10-5zM6 12.5V17c0 1.4 2.7 2.5 6 2.5s6-1.1 6-2.5v-4.5M22 10v5",
  "scholarship":       "M12 13a5 5 0 1 0 0-10 5 5 0 0 0 0 10zM8.5 11.5 7 22l5-3 5 3-1.5-10.5",
  "test-registration": "M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z",
  "test-exam":         "M10 2h4M12 14l3-3M12 22a8 8 0 1 0 0-16 8 8 0 0 0 0 16z",
  "school-exam":       "M4 19.5A2.5 2.5 0 0 1 6.5 17H20M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z",
  "essay":             "M11 4H4v16h16v-7M18.5 2.5a2.1 2.1 0 0 1 3 3L12 15l-4 1 1-4z",
  "recommendation":    "M4 4h16a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2zM22 6l-10 7L2 6",
  "document":          "M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8zM14 2v6h6",
  "interview":         "M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3zM19 10v2a7 7 0 0 1-14 0v-2M12 19v4",
  "visa":              "M5 21h14M5 3h14v14H5zM12 12a3 3 0 1 0 0-6 3 3 0 0 0 0 6z",
  "olympiad":          "M12 21a6 6 0 1 0 0-12 6 6 0 0 0 0 12zM9 9.5 6 2h12l-3 7.5",
  "project":           "M14.7 6.3a5 5 0 0 0-6.6 6.6L3 18v3h3l5.1-5.1a5 5 0 0 0 6.6-6.6l-3.1 3.1-2.9-2.9z",
  "custom":            "M12 21s-7-5.3-7-11a7 7 0 0 1 14 0c0 5.7-7 11-7 11zM12 12.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z",
};

function TypeIcon({ type, size = 14, className }: { type: string; size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden>
      <path d={TYPE_PATHS[type] ?? TYPE_PATHS.custom} />
    </svg>
  );
}

/** Gradient icon tile - the modern replacement for emoji squares. */
function TypeTile({ type, size = 36 }: { type: string; size?: number }) {
  const meta = TYPE_META[type] ?? TYPE_META.custom;
  return (
    <span
      className={cn("shrink-0 rounded-lg bg-gradient-to-br ring-1 ring-inset ring-ink/[0.06] dark:ring-white/[0.08] flex items-center justify-center shadow-sm", meta.tile)}
      style={{ height: size, width: size }}
    >
      <TypeIcon type={type} size={Math.round(size * 0.5)} />
    </span>
  );
}

const CHECKLIST_SEEDS: Record<string, string[]> = {
  "application": ["Application form", "Essays", "Transcript", "Recommendations", "Test scores sent", "Aid documents"],
  "scholarship": ["Eligibility checked", "Essay/statement", "Documents gathered", "Submitted"],
  "test-exam": ["Practice test done", "ID + admission ticket", "Venue checked", "Sleep plan"],
  "essay": ["Outline", "Draft 1", "Feedback collected", "Final polish"],
  "recommendation": ["Recommender asked", "Brag sheet shared", "Reminder sent", "Submitted"],
  "interview": ["Stories prepared", "Mock interview", "Questions for them", "Logistics checked"],
  "visa": ["Documents gathered", "Fees paid", "Appointment booked", "Mock interview"],
};

/* ─── date helpers ─── */

const todayIso = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

function daysLeft(date: string): number {
  const t = new Date(todayIso());
  const d = new Date(date);
  return Math.round((d.getTime() - t.getTime()) / 86_400_000);
}

function riskOf(d: UiDeadline): Risk {
  if (d.status === "done") return "done";
  const left = daysLeft(d.date);
  const openItems = d.checklist.filter((c) => !c.done).length;
  if (left < 0) return "overdue";
  if (left <= 7 || (left <= 14 && openItems >= 4 && d.priority === "high")) return "urgent";
  if (left <= 21) return "approaching";
  return "safe";
}

const RISK_META: Record<Risk, { label: string; chip: string; bar: string }> = {
  overdue:     { label: "Overdue",     chip: "bg-rose-50 text-rose-700 ring-rose-200 dark:bg-rose-400/15 dark:text-rose-100 dark:ring-rose-400/30", bar: "bg-rose-500" },
  urgent:      { label: "Urgent",      chip: "bg-rose-50 text-rose-700 ring-rose-200 dark:bg-rose-400/15 dark:text-rose-100 dark:ring-rose-400/30", bar: "bg-rose-500" },
  approaching: { label: "Approaching", chip: "bg-nova-100 text-nova-600 ring-nova-400/40 dark:bg-nova-400/15 dark:text-nova-100 dark:ring-nova-400/30", bar: "bg-nova-500" },
  safe:        { label: "Safe",        chip: "bg-aurora-100 text-aurora-700 ring-aurora-400/40 dark:bg-aurora-400/15 dark:text-aurora-100 dark:ring-aurora-400/30", bar: "bg-aurora-500" },
  done:        { label: "Done",        chip: "bg-paper-deep text-ink-muted ring-ink-faint/30", bar: "bg-ink-faint" },
};

function fmtDate(date: string): string {
  return new Date(date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

/* ─── shared icon helpers ─── */

const CheckIcon = ({ size = 12 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20 6 9 17l-5-5"/>
  </svg>
);

const PlusIcon = ({ size = 13 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
    <path d="M12 5v14M5 12h14"/>
  </svg>
);

const ChevIcon = ({ size = 12 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M9 18l6-6-6-6"/>
  </svg>
);

/* ════════════════════════════════════════════════════════════════════════ */

export function DeadlinesClient({ initial, demo = false }: { initial: UiDeadline[]; demo?: boolean }) {
  const [items, setItems] = useState<UiDeadline[]>(initial);
  const [view, setView] = useState<View>(demo ? "month" : "agenda");
  const [openId, setOpenId] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState<string | null>(null); // prefill date
  const [monthAnchor, setMonthAnchor] = useState(() => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1); });

  useEffect(() => {
    if (!demo) return;
    try {
      const saved = localStorage.getItem(DEMO_DEADLINES_KEY);
      if (saved !== null) setItems(JSON.parse(saved) as UiDeadline[]);
      else localStorage.setItem(DEMO_DEADLINES_KEY, JSON.stringify(initial));
    } catch { /* keep the server-provided preview */ }
  }, [demo, initial]);

  const saveDemoItems = (next: UiDeadline[]) => {
    setItems(next);
    try { localStorage.setItem(DEMO_DEADLINES_KEY, JSON.stringify(next)); } catch { /* ignore */ }
  };

  const refresh = async () => {
    if (demo) {
      try {
        const saved = localStorage.getItem(DEMO_DEADLINES_KEY);
        setItems(saved === null ? initial : JSON.parse(saved) as UiDeadline[]);
      } catch { /* keep current state */ }
      return;
    }
    const r = await fetch("/api/deadlines", { cache: "no-store" });
    if (r.ok) {
      const d = await r.json();
      setItems((d.items as Array<Record<string, unknown>>).map(rowToUi));
    }
  };

  const open = items.find((i) => i.id === openId) ?? null;
  const pending = items.filter((i) => i.status !== "done");

  /* workload windows */
  const windows = useMemo(() => [7, 14, 30].map((days) => {
    const inWin = pending.filter((i) => { const l = daysLeft(i.date); return l >= 0 && l <= days; });
    const urgent = inWin.filter((i) => riskOf(i) === "urgent" || riskOf(i) === "overdue").length;
    const openItems = inWin.reduce((s, i) => s + i.checklist.filter((c) => !c.done).length, 0);
    const hours = Math.round(openItems * 1.5 + inWin.filter((i) => !i.checklist.length).length * 2);
    return { days, count: inWin.length, urgent, openItems, hours };
  }), [pending]);

  return (
    <div className="px-4 sm:px-6 lg:px-8 py-5 lg:py-7 max-w-[1280px] mx-auto">
      {/* ─── Header ─── */}
      <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }} className="flex flex-wrap items-end justify-between gap-4 mb-5">
        <div className="min-w-0">
          <div className="text-[10.5px] uppercase tracking-[0.22em] text-ink-muted font-medium mb-1.5">Deadline command</div>
          <h1 className="font-serif text-[28px] sm:text-[34px] leading-[1.05] font-bold tracking-tight text-ink">
            {pending.length} live deadline{pending.length === 1 ? "" : "s"} · <span className="grad-text">risk-aware</span>
          </h1>
        </div>
        <div className="flex items-center gap-2">
          <Segment value={view} onChange={setView} options={[
            { value: "agenda", label: "Agenda" }, { value: "month", label: "Month" }, { value: "board", label: "Board" },
          ]} />
          <button
            onClick={() => setCreateOpen(todayIso())}
            className="inline-flex items-center gap-1.5 rounded-full bg-ink text-paper px-4 py-2 text-[12.5px] font-semibold hover:bg-polaris-700 transition-colors"
          >
            <PlusIcon size={13} /> New
          </button>
        </div>
      </motion.div>

      {/* ─── Workload strip ─── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
        {windows.map((w, i) => (
          <motion.div
            key={w.days}
            initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: i * 0.06, ease: [0.16, 1, 0.3, 1] }}
            className="glass rounded-2xl p-4 relative overflow-hidden"
          >
            <div className={cn("absolute top-0 left-0 h-[2px] w-full bg-gradient-to-r", w.urgent > 0 ? "from-rose-400 to-nova-400" : "from-aurora-400 to-polaris-400")} />
            <div className="text-[10.5px] uppercase tracking-wider text-ink-muted font-medium">Next {w.days} days</div>
            <div className="mt-1 flex items-baseline gap-2">
              <span className="font-serif text-[26px] font-bold text-ink leading-none tabular-nums">{w.count}</span>
              <span className="text-[11.5px] text-ink-dim">deadline{w.count === 1 ? "" : "s"}</span>
              {w.urgent > 0 && (
                <span className="ml-auto text-[10px] uppercase tracking-wider font-bold text-rose-600 dark:text-rose-200 bg-rose-50 dark:bg-rose-400/15 rounded-full px-2 py-0.5 ring-1 ring-inset ring-rose-200 dark:ring-rose-400/30">
                  {w.urgent} urgent
                </span>
              )}
            </div>
            <div className="mt-1.5 text-[11px] font-mono text-ink-muted">
              {w.openItems} open items · ~{w.hours}h est.
            </div>
          </motion.div>
        ))}
      </div>

      {/* ─── Views ─── */}
      {items.length === 0 ? (
        <EmptyState onAdd={() => setCreateOpen(todayIso())} />
      ) : view === "agenda" ? (
        <Agenda items={items} onOpen={setOpenId} />
      ) : view === "month" ? (
        <MonthCalendar items={items} anchor={monthAnchor} setAnchor={setMonthAnchor} onOpen={setOpenId} onCreate={(d) => setCreateOpen(d)} />
      ) : (
        <RiskBoard items={pending} onOpen={setOpenId} />
      )}

      {/* ─── Modals ─── */}
      <AnimatePresence>
        {open && (
          <DetailModal
            key={open.id}
            d={open}
            onClose={() => setOpenId(null)}
            onChanged={refresh}
            onDeleted={() => { setOpenId(null); void refresh(); }}
            demo={demo}
            onLocalPatch={(id, patch) => saveDemoItems(items.map((item) => item.id === id ? { ...item, ...patch } : item))}
            onLocalDelete={(id) => { saveDemoItems(items.filter((item) => item.id !== id)); setOpenId(null); }}
          />
        )}
        {createOpen && (
          <CreateModal
            key="create"
            prefillDate={createOpen}
            demo={demo}
            onClose={() => setCreateOpen(null)}
            onCreated={(created) => {
              setCreateOpen(null);
              if (demo && created) saveDemoItems([...items, created].sort((a, b) => a.date.localeCompare(b.date)));
              else void refresh();
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

function rowToUi(d: Record<string, unknown>): UiDeadline {
  return {
    id: String((d._id as string) ?? d.id ?? ""),
    date: String(d.date ?? ""),
    title: String(d.title ?? ""),
    kind: (d.kind as UiDeadline["kind"]) ?? "soft",
    milestoneId: d.milestoneId as string | undefined,
    type: String(d.type ?? "custom"),
    priority: (d.priority as UiDeadline["priority"]) ?? "medium",
    status: (d.status as UiDeadline["status"]) ?? "pending",
    universityId: d.universityId as string | undefined,
    universityName: d.universityName as string | undefined,
    officialLink: d.officialLink as string | undefined,
    notes: String(d.notes ?? ""),
    checklist: (d.checklist as UiChecklistItem[]) ?? [],
    reminderDays: (d.reminderDays as number[]) ?? [],
    source: d.source as string | undefined,
  };
}

/* ════════════════════════════════════════════════════════════════════════
 * Agenda - countdown cards grouped by urgency
 * ════════════════════════════════════════════════════════════════════════ */

function Agenda({ items, onOpen }: { items: UiDeadline[]; onOpen: (id: string) => void }) {
  const groups: Array<{ title: string; filter: (d: UiDeadline) => boolean }> = [
    { title: "Overdue", filter: (d) => riskOf(d) === "overdue" },
    { title: "This week", filter: (d) => riskOf(d) === "urgent" },
    { title: "Next 3 weeks", filter: (d) => riskOf(d) === "approaching" },
    { title: "Later", filter: (d) => riskOf(d) === "safe" },
    { title: "Completed", filter: (d) => d.status === "done" },
  ];
  return (
    <div className="space-y-7">
      {groups.map((g) => {
        const list = items.filter(g.filter).sort((a, b) => a.date.localeCompare(b.date));
        if (!list.length) return null;
        return (
          <section key={g.title}>
            <h2 className="font-serif text-[17px] font-bold tracking-tight text-ink mb-3">{g.title} <span className="text-[11px] font-mono text-ink-muted font-normal">· {list.length}</span></h2>
            <motion.div
              initial="hidden" animate="visible"
              variants={{ hidden: {}, visible: { transition: { staggerChildren: 0.04 } } }}
              className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3"
            >
              {list.map((d) => <CountdownCard key={d.id} d={d} onOpen={() => onOpen(d.id)} />)}
            </motion.div>
          </section>
        );
      })}
    </div>
  );
}

function CountdownCard({ d, onOpen }: { d: UiDeadline; onOpen: () => void }) {
  const risk = riskOf(d);
  const meta = RISK_META[risk];
  const left = daysLeft(d.date);
  const done = d.checklist.filter((c) => c.done).length;
  const total = d.checklist.length;
  const t = TYPE_META[d.type] ?? TYPE_META.custom;

  return (
    <motion.button
      variants={{ hidden: { opacity: 0, y: 12 }, visible: { opacity: 1, y: 0, transition: { duration: 0.35 } } }}
      whileHover={{ y: -4, transition: { duration: 0.2 } }}
      onClick={onOpen}
      className={cn("glass rounded-2xl p-4 text-left relative overflow-hidden group", d.status === "done" && "opacity-65")}
    >
      <div className={cn("absolute left-0 top-0 bottom-0 w-[3px]", meta.bar)} />
      <div className="flex items-start gap-3">
        <TypeTile type={d.type} size={36} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 flex-wrap mb-0.5">
            <span className={cn("text-[9.5px] uppercase tracking-wider font-bold", t.tone)}>{t.label}</span>
            {d.priority === "high" && <span className="h-1.5 w-1.5 rounded-full bg-rose-500" title="High priority" />}
            {d.source === "university" && <span className="text-[9px] uppercase tracking-wider font-bold text-aurora-700 dark:text-aurora-200">official</span>}
          </div>
          <div className={cn("text-[13.5px] font-semibold text-ink leading-snug line-clamp-2", d.status === "done" && "line-through text-ink-muted")}>{d.title}</div>
          <div className="text-[10.5px] font-mono text-ink-muted mt-1">{fmtDate(d.date)}</div>
        </div>
        <CountdownRing left={left} done={d.status === "done"} />
      </div>
      {total > 0 && (
        <div className="mt-3 flex items-center gap-2">
          <div className="flex-1 h-1.5 rounded-full bg-paper-deep overflow-hidden">
            <div className={cn("h-full rounded-full transition-all", meta.bar)} style={{ width: `${total ? (done / total) * 100 : 0}%` }} />
          </div>
          <span className="text-[10px] font-mono text-ink-muted">{done}/{total}</span>
        </div>
      )}
    </motion.button>
  );
}

function CountdownRing({ left, done, size = 44 }: { left: number; done?: boolean; size?: number }) {
  const r = size * 0.36, c = 2 * Math.PI * r;
  const pct = done ? 1 : Math.max(0.04, Math.min(1, 1 - left / 60));
  const cls = done ? "stroke-aurora-500" : left <= 7 ? "stroke-rose-500" : left <= 21 ? "stroke-nova-500" : "stroke-aurora-500";
  return (
    <span className="relative shrink-0" style={{ height: size, width: size }}>
      <svg viewBox={`0 0 ${size} ${size}`} className="h-full w-full -rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth="3.5" className="stroke-paper-deep" />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth="3.5" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - pct)} className={cn("transition-all duration-700", cls)} />
      </svg>
      <span className="absolute inset-0 flex flex-col items-center justify-center leading-none">
        {done ? (
          <span className="text-aurora-600 dark:text-aurora-300"><CheckIcon size={14} /></span>
        ) : (
          <>
            <span className="font-serif text-[13px] font-bold text-ink tabular-nums">{left < 0 ? `${-left}` : left}</span>
            <span className="text-[7px] uppercase tracking-wider text-ink-muted font-bold">{left < 0 ? "late" : "days"}</span>
          </>
        )}
      </span>
    </span>
  );
}

/* ════════════════════════════════════════════════════════════════════════
 * Month calendar
 * ════════════════════════════════════════════════════════════════════════ */

function MonthCalendar({
  items, anchor, setAnchor, onOpen, onCreate,
}: {
  items: UiDeadline[];
  anchor: Date;
  setAnchor: (d: Date) => void;
  onOpen: (id: string) => void;
  onCreate: (date: string) => void;
}) {
  const startDow = (new Date(anchor.getFullYear(), anchor.getMonth(), 1).getDay() + 6) % 7;
  const start = new Date(anchor.getFullYear(), anchor.getMonth(), 1 - startDow);
  const days = Array.from({ length: 42 }, (_, i) => new Date(start.getFullYear(), start.getMonth(), start.getDate() + i));
  const byDate = useMemo(() => {
    const m: Record<string, UiDeadline[]> = {};
    for (const it of items) (m[it.date] ||= []).push(it);
    return m;
  }, [items]);
  const tIso = todayIso();

  return (
    <div className="glass rounded-2xl overflow-hidden">
      <div className="px-4 py-3 flex items-center gap-2 border-b border-polaris-500/10 dark:border-white/[0.08]">
        <button onClick={() => setAnchor(new Date(anchor.getFullYear(), anchor.getMonth() - 1, 1))} className="h-8 w-8 rounded-lg border border-polaris-500/20 bg-paper-card text-ink-dim hover:text-ink inline-flex items-center justify-center"><span className="rotate-180"><ChevIcon size={12} /></span></button>
        <button onClick={() => setAnchor(new Date(anchor.getFullYear(), anchor.getMonth() + 1, 1))} className="h-8 w-8 rounded-lg border border-polaris-500/20 bg-paper-card text-ink-dim hover:text-ink inline-flex items-center justify-center"><ChevIcon size={12} /></button>
        <h2 className="font-serif text-[17px] font-bold tracking-tight text-ink ml-1">
          {anchor.toLocaleDateString("en-US", { month: "long", year: "numeric" })}
        </h2>
        <button onClick={() => { const d = new Date(); setAnchor(new Date(d.getFullYear(), d.getMonth(), 1)); }} className="ml-auto text-[11.5px] font-medium text-polaris-600 dark:text-polaris-300 hover:underline">Today</button>
      </div>
      <div className="grid grid-cols-7 text-center text-[10px] uppercase tracking-wider font-bold text-ink-muted border-b border-polaris-500/10 dark:border-white/[0.08]">
        {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => <div key={d} className="py-2">{d}</div>)}
      </div>
      <div className="grid grid-cols-7">
        {days.map((day) => {
          const isoD = `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, "0")}-${String(day.getDate()).padStart(2, "0")}`;
          const inMonth = day.getMonth() === anchor.getMonth();
          const dayItems = byDate[isoD] ?? [];
          const isToday = isoD === tIso;
          return (
            <div
              key={isoD}
              role="button" tabIndex={0}
              onClick={() => dayItems.length === 0 && onCreate(isoD)}
              onKeyDown={(e) => { if (e.key === "Enter" && dayItems.length === 0) onCreate(isoD); }}
              className={cn(
                "min-h-[88px] p-1.5 border-b border-r border-polaris-500/[0.07] dark:border-white/[0.05] transition-colors",
                !inMonth && "opacity-40",
                dayItems.length === 0 && "hover:bg-paper-soft/60 cursor-pointer",
              )}
            >
              <div className={cn(
                "text-[10.5px] font-mono mb-1 h-5 w-5 flex items-center justify-center rounded-full",
                isToday ? "bg-polaris-500 text-white font-bold" : "text-ink-muted",
              )}>
                {day.getDate()}
              </div>
              <div className="space-y-1">
                {dayItems.slice(0, 3).map((it) => {
                  const meta = RISK_META[riskOf(it)];
                  return (
                    <button
                      key={it.id}
                      onClick={(e) => { e.stopPropagation(); onOpen(it.id); }}
                      className={cn("w-full text-left text-[10px] font-medium rounded px-1.5 py-1 ring-1 ring-inset truncate block hover:scale-[1.02] transition-transform", meta.chip)}
                      title={it.title}
                    >
                      {it.title}
                    </button>
                  );
                })}
                {dayItems.length > 3 && <div className="text-[9px] font-mono text-ink-muted px-1">+{dayItems.length - 3} more</div>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════════════
 * Risk board
 * ════════════════════════════════════════════════════════════════════════ */

function RiskBoard({ items, onOpen }: { items: UiDeadline[]; onOpen: (id: string) => void }) {
  const cols: Risk[] = ["overdue", "urgent", "approaching", "safe"];
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
      {cols.map((risk) => {
        const list = items.filter((i) => riskOf(i) === risk).sort((a, b) => a.date.localeCompare(b.date));
        const meta = RISK_META[risk];
        return (
          <div key={risk} className="glass rounded-2xl p-3 min-h-[160px]">
            <div className="flex items-center gap-2 px-1 mb-2.5">
              <span className={cn("h-2 w-2 rounded-full", meta.bar)} />
              <span className="text-[11px] uppercase tracking-wider font-bold text-ink-dim">{meta.label}</span>
              <span className="ml-auto font-mono text-[11px] text-ink-muted">{list.length}</span>
            </div>
            <div className="space-y-2">
              {list.length === 0 && <div className="text-[11px] text-ink-muted italic px-1 py-3">Nothing here.</div>}
              {list.map((d) => {
                const t = TYPE_META[d.type] ?? TYPE_META.custom;
                const openCount = d.checklist.filter((c) => !c.done).length;
                return (
                  <motion.button
                    key={d.id}
                    whileHover={{ y: -2 }}
                    onClick={() => onOpen(d.id)}
                    className="w-full text-left rounded-xl bg-paper-card border border-polaris-500/10 dark:border-white/[0.08] p-2.5 block"
                  >
                    <div className="flex items-center gap-1.5 mb-1">
                      <span className={t.tone}><TypeIcon type={d.type} size={12} /></span>
                      <span className="text-[10px] font-mono text-ink-muted">{fmtDate(d.date)}</span>
                      <span className="ml-auto font-mono text-[10px] font-bold text-ink">{daysLeft(d.date)}d</span>
                    </div>
                    <div className="text-[12px] font-medium text-ink leading-snug line-clamp-2">{d.title}</div>
                    {openCount > 0 && <div className="text-[9.5px] font-mono text-ink-muted mt-1">{openCount} item{openCount === 1 ? "" : "s"} left</div>}
                  </motion.button>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════════════
 * Detail modal
 * ════════════════════════════════════════════════════════════════════════ */

const REMINDER_OPTIONS = [0, 1, 3, 7, 14];

function DetailModal({
  d, onClose, onChanged, onDeleted, demo, onLocalPatch, onLocalDelete,
}: {
  d: UiDeadline;
  onClose: () => void;
  onChanged: () => Promise<void> | void;
  onDeleted: () => void;
  demo: boolean;
  onLocalPatch: (id: string, patch: Partial<UiDeadline>) => void;
  onLocalDelete: (id: string) => void;
}) {
  const [busy, setBusy] = useState<string | null>(null);
  const [notes, setNotes] = useState(d.notes);
  const [reschedule, setReschedule] = useState<string | null>(null);
  const t = TYPE_META[d.type] ?? TYPE_META.custom;
  const risk = riskOf(d);
  const left = daysLeft(d.date);

  async function patch(body: Record<string, unknown>, key: string) {
    setBusy(key);
    try {
      if (demo) {
        onLocalPatch(d.id, body as Partial<UiDeadline>);
        await onChanged();
        return;
      }
      const r = await fetch(`/api/deadlines?id=${d.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      if (r.ok || r.status === 204) await onChanged();
    } finally {
      setBusy(null);
    }
  }

  async function toggleItem(itemId: string) {
    const next = d.checklist.map((c) => (c.id === itemId ? { ...c, done: !c.done } : c));
    await patch({ checklist: next }, `c-${itemId}`);
  }

  async function markComplete() {
    await patch({ status: d.status === "done" ? "pending" : "done" }, "complete");
  }

  async function remove() {
    if (!confirm("Delete this deadline?")) return;
    setBusy("delete");
    if (demo) {
      onLocalDelete(d.id);
      setBusy(null);
      return;
    }
    const r = await fetch(`/api/deadlines?id=${d.id}`, { method: "DELETE" });
    if (r.ok || r.status === 204) onDeleted();
    setBusy(null);
  }

  async function toggleReminder(day: number) {
    const has = d.reminderDays.includes(day);
    const next = has ? d.reminderDays.filter((x) => x !== day) : [...d.reminderDays, day].sort((a, b) => b - a);
    await patch({ reminderDays: next }, `r-${day}`);
  }

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.18 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/45 backdrop-blur-sm p-4 sm:p-8"
      role="dialog" aria-modal="true" onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.95, y: 14, opacity: 0 }} animate={{ scale: 1, y: 0, opacity: 1 }} exit={{ scale: 0.95, y: 14, opacity: 0 }}
        transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-[560px] max-h-[88vh] overflow-y-auto overscroll-contain rounded-3xl bg-paper-card shadow-pop ring-1 ring-inset ring-polaris-500/10 dark:ring-white/[0.12]"
      >
        {/* Header */}
        <div className="px-6 pt-5 pb-4 border-b border-polaris-500/10 dark:border-white/[0.08]">
          <div className="flex items-start gap-3.5">
            <TypeTile type={d.type} size={44} />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5 flex-wrap mb-1">
                <span className={cn("text-[9.5px] uppercase tracking-wider font-bold", t.tone)}>{t.label}</span>
                <span className={cn("text-[9.5px] uppercase tracking-wider font-bold rounded-full px-1.5 py-[1px] ring-1 ring-inset", RISK_META[risk].chip)}>{RISK_META[risk].label}</span>
                <span className="text-[9.5px] uppercase tracking-wider font-bold text-ink-muted">{d.priority} priority</span>
                {d.source === "university" && (
                  <span className="text-[9px] uppercase tracking-wider font-bold text-aurora-700 dark:text-aurora-200 inline-flex items-center gap-0.5"><CheckIcon size={8} /> official source</span>
                )}
              </div>
              <h2 className="font-serif text-[19px] leading-tight font-bold tracking-tight text-ink">{d.title}</h2>
              <div className="text-[11.5px] font-mono text-ink-muted mt-1">{fmtDate(d.date)}</div>
            </div>
            <CountdownRing left={left} done={d.status === "done"} size={52} />
          </div>
          {d.officialLink && (
            <a href={d.officialLink} target="_blank" rel="noopener noreferrer" className="mt-3 inline-flex items-center gap-1 text-[11.5px] text-polaris-600 dark:text-polaris-300 hover:underline">
              Official page <span>↗</span>
            </a>
          )}
        </div>

        <div className="px-6 py-5 space-y-5">
          {/* Checklist */}
          {d.checklist.length > 0 && (
            <section>
              <Label>Checklist · {d.checklist.filter((c) => c.done).length}/{d.checklist.length}</Label>
              <ul className="space-y-1.5">
                {d.checklist.map((c) => (
                  <li key={c.id}>
                    <button
                      onClick={() => void toggleItem(c.id)}
                      disabled={busy !== null}
                      className={cn(
                        "w-full flex items-center gap-2.5 rounded-xl px-3 py-2 text-left ring-1 ring-inset transition-colors text-[12.5px]",
                        c.done ? "bg-aurora-100/50 dark:bg-aurora-400/10 ring-aurora-400/30" : "bg-paper-card ring-polaris-500/10 dark:ring-white/10 hover:ring-polaris-400/40",
                      )}
                    >
                      <span className={cn("h-[16px] w-[16px] shrink-0 rounded ring-1 ring-inset flex items-center justify-center", c.done ? "bg-aurora-500 ring-aurora-500 text-white" : "ring-ink-faint")}>
                        {busy === `c-${c.id}` ? <span className="h-2 w-2 rounded-full border border-current border-t-transparent animate-spin" /> : c.done ? <CheckIcon size={9} /> : null}
                      </span>
                      <span className={cn(c.done ? "text-ink-muted line-through" : "text-ink")}>{c.text}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {/* Reminders */}
          <section>
            <Label>Reminders</Label>
            <div className="flex flex-wrap gap-1.5">
              {REMINDER_OPTIONS.map((day) => {
                const on = d.reminderDays.includes(day);
                return (
                  <button
                    key={day}
                    onClick={() => void toggleReminder(day)}
                    disabled={busy !== null}
                    className={cn(
                      "text-[11px] font-medium px-2.5 py-1.5 rounded-full ring-1 ring-inset transition-colors",
                      on ? "bg-polaris-100 text-polaris-700 ring-polaris-300 dark:bg-polaris-400/20 dark:text-polaris-100 dark:ring-polaris-400/40"
                         : "bg-paper-card text-ink-dim ring-polaris-200 hover:ring-polaris-300 dark:ring-white/[0.15]",
                    )}
                  >
                    {on && "✓ "}{day === 0 ? "Same day" : `${day}d before`}
                  </button>
                );
              })}
            </div>
            <p className="text-[10.5px] text-ink-muted mt-1.5">Reminder slots are saved with the deadline; notifications ship with the notification service.</p>
          </section>

          {/* Notes */}
          <section>
            <Label>Notes</Label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              onBlur={() => { if (notes !== d.notes) void patch({ notes }, "notes"); }}
              rows={3}
              maxLength={2000}
              placeholder="Links, requirements, gotchas…"
              className="w-full rounded-xl border border-polaris-200 bg-paper-card px-3 py-2.5 text-[12.5px] text-ink placeholder:text-ink-muted/60 focus:border-polaris-400 focus:outline-none resize-y dark:border-white/[0.14] dark:bg-paper-deep"
            />
          </section>

          {/* Reschedule */}
          {reschedule !== null && (
            <section className="flex items-center gap-2">
              <input
                type="date"
                value={reschedule}
                onChange={(e) => setReschedule(e.target.value)}
                className="rounded-xl border border-polaris-200 bg-paper-card px-3 py-2 text-[12.5px] text-ink focus:border-polaris-400 focus:outline-none dark:border-white/[0.14] dark:bg-paper-deep"
              />
              <button
                onClick={() => { if (reschedule) void patch({ date: reschedule }, "date").then(() => setReschedule(null)); }}
                className="rounded-full bg-ink text-paper px-3.5 py-2 text-[12px] font-semibold hover:bg-polaris-700"
              >
                Move
              </button>
              <button onClick={() => setReschedule(null)} className="text-[12px] text-ink-dim hover:text-ink">Cancel</button>
            </section>
          )}
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 bg-paper-card/85 backdrop-blur-md px-6 py-3.5 border-t border-polaris-500/10 dark:border-white/[0.08] flex items-center gap-2 flex-wrap">
          <button
            onClick={() => void markComplete()}
            disabled={busy !== null}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-[12.5px] font-semibold transition-colors disabled:opacity-50",
              d.status === "done" ? "bg-paper-soft text-ink-dim border border-polaris-500/20" : "bg-aurora-600 text-white hover:bg-aurora-700",
            )}
          >
            {busy === "complete" ? "…" : d.status === "done" ? "Reopen" : "✓ Mark complete"}
          </button>
          <button onClick={() => setReschedule(d.date)} className="text-[12px] font-medium text-ink-dim hover:text-ink">Reschedule</button>
          <button onClick={() => void remove()} disabled={busy !== null} className="ml-auto text-[12px] text-rose-600 dark:text-rose-300 hover:underline">
            {busy === "delete" ? "…" : "Delete"}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

/* ════════════════════════════════════════════════════════════════════════
 * Create modal
 * ════════════════════════════════════════════════════════════════════════ */

function CreateModal({
  prefillDate, onClose, onCreated, demo,
}: {
  prefillDate: string;
  onClose: () => void;
  onCreated: (created?: UiDeadline) => void;
  demo: boolean;
}) {
  const [title, setTitle] = useState("");
  const [date, setDate] = useState(prefillDate);
  const [type, setType] = useState("custom");
  const [priority, setPriority] = useState<"high" | "medium" | "low">("medium");
  const [seedChecklist, setSeedChecklist] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function create() {
    if (!title.trim() || !date) return;
    setBusy(true);
    setError("");
    try {
      const seeds = seedChecklist ? CHECKLIST_SEEDS[type] : undefined;
      const checklist = seeds?.map((text, i) => ({ id: `c${i}`, text, done: false })) ?? [];
      const draft = {
        date,
        title: title.trim(),
        kind: priority === "high" ? "hard" as const : "soft" as const,
        type,
        priority,
        reminderDays: [7, 1],
        checklist,
      };
      if (demo) {
        onCreated({
          id: `demo-${crypto.randomUUID()}`,
          ...draft,
          status: "pending",
          notes: "",
          source: "user",
        });
        return;
      }
      const r = await fetch("/api/deadlines", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(draft),
      });
      if (r.ok) onCreated();
      else {
        const data = await r.json().catch(() => ({})) as { error?: string };
        setError(data.error || "The deadline could not be added. Please try again.");
      }
    } catch {
      setError("The deadline could not be added. Please check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  const PRIORITY_OPTIONS: { value: "high" | "medium" | "low"; label: string; dot: string }[] = [
    { value: "high", label: "High", dot: "bg-rose-500" },
    { value: "medium", label: "Medium", dot: "bg-nova-500" },
    { value: "low", label: "Low", dot: "bg-aurora-500" },
  ];

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/45 backdrop-blur-sm p-6"
      role="dialog" aria-modal="true" onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.96, y: 10 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.96, y: 10, opacity: 0 }}
        transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
        onClick={(e) => e.stopPropagation()}
        className="bg-paper-card rounded-3xl shadow-pop ring-1 ring-inset ring-polaris-500/10 dark:ring-white/[0.12] max-w-[440px] w-full p-6"
      >
        <h2 className="font-serif text-[19px] font-bold tracking-tight text-ink mb-4">New deadline</h2>
        <div className="space-y-3.5">
          <input
            value={title} onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. MIT Regular Action, IELTS exam, Essay draft 1"
            maxLength={120} autoFocus
            className="w-full rounded-xl border border-polaris-200 bg-paper-card px-3 py-2.5 text-[13px] text-ink placeholder:text-ink-muted/60 focus:border-polaris-400 focus:outline-none dark:border-white/[0.14] dark:bg-paper-deep"
          />
          <div className="flex gap-2">
            <input
              type="date" value={date} onChange={(e) => setDate(e.target.value)}
              className="flex-1 rounded-xl border border-polaris-200 bg-paper-card px-3 py-2 text-[13px] text-ink focus:border-polaris-400 focus:outline-none dark:border-white/[0.14] dark:bg-paper-deep"
            />
            {/* Priority selector */}
            <div className="flex rounded-xl border border-polaris-200 dark:border-white/[0.14] overflow-hidden shrink-0">
              {PRIORITY_OPTIONS.map((p) => (
                <button
                  key={p.value}
                  onClick={() => setPriority(p.value)}
                  className={cn(
                    "flex items-center gap-1.5 px-3 py-2 text-[11.5px] font-medium transition-colors",
                    priority === p.value
                      ? "bg-ink text-paper"
                      : "text-ink-dim hover:text-ink hover:bg-paper-soft",
                  )}
                >
                  <span className={cn("h-2 w-2 rounded-full", p.dot)} />
                  {p.label}
                </button>
              ))}
            </div>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {Object.entries(TYPE_META).map(([k, m]) => (
              <button
                key={k}
                onClick={() => setType(k)}
                className={cn(
                  "text-[11px] font-medium px-2.5 py-1 rounded-full ring-1 ring-inset transition-colors inline-flex items-center gap-1.5",
                  type === k ? "bg-ink text-paper ring-ink" : "bg-paper-card text-ink-dim ring-polaris-200 hover:ring-polaris-300 dark:ring-white/[0.15]",
                )}
              >
                <TypeIcon type={k} size={11} /> {m.label}
              </button>
            ))}
          </div>
          {CHECKLIST_SEEDS[type] && (
            <label className="flex items-center gap-2 text-[12px] text-ink-dim cursor-pointer">
              <input type="checkbox" checked={seedChecklist} onChange={(e) => setSeedChecklist(e.target.checked)} className="accent-polaris-500" />
              Start with a {TYPE_META[type].label.toLowerCase()} checklist ({CHECKLIST_SEEDS[type].length} items)
            </label>
          )}
          {error && <p role="alert" className="text-[11px] text-rose-600 dark:text-rose-300">{error}</p>}
        </div>
        <div className="mt-5 flex items-center justify-end gap-2">
          <button onClick={onClose} disabled={busy} className="text-[13px] text-ink-dim hover:text-ink px-3 py-2">Cancel</button>
          <button
            onClick={() => void create()}
            disabled={busy || !title.trim()}
            className="inline-flex items-center gap-2 rounded-full bg-ink text-paper px-5 py-2.5 text-[13px] font-semibold hover:bg-polaris-700 transition-colors disabled:opacity-50"
          >
            {busy ? "Adding…" : "Add deadline"}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

/* ─── shared bits ─── */

function Segment<T extends string>({
  options, value, onChange,
}: { options: { value: T; label: string }[]; value: T; onChange: (v: T) => void }) {
  return (
    <div className="inline-flex p-0.5 bg-paper-deep rounded-lg border border-polaris-500/15 dark:border-white/[0.08]">
      {options.map((o) => (
        <button key={o.value} onClick={() => onChange(o.value)}
          className={cn("h-8 px-3 text-[12px] font-medium rounded-md transition-colors", value === o.value ? "bg-paper-card text-ink shadow-sm" : "text-ink-dim hover:text-ink")}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return <div className="text-[10.5px] uppercase tracking-[0.22em] text-ink-muted font-medium mb-2">{children}</div>;
}

function EmptyState({ onAdd }: { onAdd: () => void }) {
  return (
    <div className="glass rounded-2xl p-12 text-center">
      <span className="mx-auto mb-3 h-14 w-14 rounded-2xl bg-gradient-to-br from-polaris-500/20 via-nova-500/15 to-aurora-500/15 ring-1 ring-inset ring-polaris-500/20 dark:ring-white/[0.1] flex items-center justify-center text-polaris-600 dark:text-polaris-300 shadow-sm">
        <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M3 7h18M5 5h14a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2zM8 3v4M16 3v4M9 14l2 2 4-4"/></svg>
      </span>
      <div className="font-serif text-[20px] font-bold text-ink">No deadlines yet</div>
      <p className="text-[12.5px] text-ink-dim mt-1.5 max-w-md mx-auto">
        Add your own deadlines here. Track applications, exams, essays, and more — all in one risk-aware view.
      </p>
      <button onClick={onAdd} className="mt-4 inline-flex items-center gap-1.5 px-4 h-9 rounded-full bg-ink text-paper text-[13px] font-medium hover:bg-polaris-700 transition-colors">
        <PlusIcon size={13} /> Add first deadline
      </button>
    </div>
  );
}
