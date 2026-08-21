"use client";

/**
 * RoadmapPageClient - orchestrates the roadmap v2 experience.
 *
 * No doc → RoadmapSetup. Doc → header (title, phase timeline, adapt) +
 * RoadmapTree + RoadmapNodeModal. Every mutation swaps in the full updated
 * doc, which is the same doc the Strategist reads - both stay in sync by
 * construction.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/cn";
import type { RoadmapDoc, RoadmapConfig, EducationLevel } from "@/lib/roadmap/types";
import { overallProgress } from "@/lib/roadmap/types";
import { roadmapStore, useRoadmapStrategist } from "@/lib/roadmap/store";
import { RoadmapSetup, type ProfileSeed, type SetupInitialProfile } from "./RoadmapSetup";
import { RoadmapTree, type RoadmapWeekLeaf } from "./RoadmapTree";
import { RoadmapNodeModal } from "./RoadmapNodeModal";
import { RoadmapScheduleWorkspace } from "./RoadmapScheduleWorkspace";
import { RoadmapWeekModal } from "./RoadmapWeekModal";
import { TargetPortfolioEditor } from "./TargetPortfolioEditor";

export function RoadmapPageClient({
  defaultLevel, initialProfile = null, initialDoc, apiBase = "/api/roadmap/v2", demo = false,
}: {
  defaultLevel: EducationLevel;
  initialProfile?: SetupInitialProfile;
  initialDoc?: RoadmapDoc;
  apiBase?: string;
  demo?: boolean;
}) {
  const [doc, setDoc] = useState<RoadmapDoc | null | undefined>(initialDoc); // undefined = loading
  const [genBusy, setGenBusy] = useState(false);
  const [genErr, setGenErr] = useState<string | null>(null);
  const [scheduleBusy, setScheduleBusy] = useState(false);
  const [openNodeId, setOpenNodeId] = useState<string | null>(null);
  const [adaptOpen, setAdaptOpen] = useState(false);
  const [targetsOpen, setTargetsOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  // New plans open on their first schedule unit by default.
  const [activePhase, setActivePhase] = useState<number | null>(0);
  const [openWeek, setOpenWeek] = useState<RoadmapWeekLeaf | null>(null);
  const timelineRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (initialDoc) {
      roadmapStore.setDoc(initialDoc);
      return;
    }
    let cancelled = false;
    fetch(apiBase, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : { doc: null }))
      .then((d) => {
        if (cancelled) return;
        setDoc(d.doc ?? null);
        roadmapStore.setDoc(d.doc ?? null);
      })
      .catch(() => { if (!cancelled) setDoc(null); });
    return () => { cancelled = true; };
  }, [apiBase, initialDoc]);

  // Adopt updates that arrive FROM the Strategist rail (Apply-to-roadmap):
  // the store is the shared channel; if its doc is newer, take it.
  const shared = useRoadmapStrategist();
  useEffect(() => {
    if (!shared.doc || doc === undefined) return;
    if (doc === null || shared.doc.updatedAt !== doc.updatedAt) {
      setDoc(shared.doc);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shared.doc]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 5000);
    return () => clearTimeout(t);
  }, [toast]);

  const generate = useCallback(async (config: RoadmapConfig, seed: ProfileSeed) => {
    setGenBusy(true);
    setGenErr(null);
    try {
      const r = await fetch(apiBase, {
        method: "POST",
        headers: { "content-type": "application/json" },
        // profileSeed makes the first roadmap double as onboarding - the
        // server creates/updates the student profile from these answers.
        body: JSON.stringify({ ...config, profileSeed: seed }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) {
        setGenErr(d?.error ?? "Generation failed - try again.");
        return;
      }
      setDoc(d.doc as RoadmapDoc);
      setActivePhase(0);
      roadmapStore.setDoc(d.doc as RoadmapDoc);
      roadmapStore.emit("ROADMAP_GENERATED", `Generated roadmap "${(d.doc as RoadmapDoc).title}"`);
    } finally {
      setGenBusy(false);
    }
  }, [apiBase]);

  const onDocUpdated = useCallback((next: RoadmapDoc, adaptation?: string | null) => {
    setDoc(next);
    roadmapStore.setDoc(next);
    if (adaptation) setToast(adaptation);
  }, []);

  const buildSchedule = useCallback(async (request: { upgradeLegacy?: boolean; yearIndex?: number; unitIndex?: number }) => {
    if (demo) {
      setToast("Schedule generation is available from a saved roadmap.");
      return;
    }
    setScheduleBusy(true);
    try {
      const response = await fetch(`${apiBase}/schedule`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(request),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setToast(data?.error ?? "Schedule generation failed - your current roadmap is unchanged.");
        return;
      }
      const next = data.doc as RoadmapDoc;
      setDoc(next);
      roadmapStore.setDoc(next);
      setActivePhase(request.unitIndex !== undefined
        ? request.unitIndex
        : request.yearIndex === undefined
          ? 0
          : next.schedule?.mode === "monthly" ? request.yearIndex * 12 : request.yearIndex);
      setToast(request.upgradeLegacy ? "Weekly schedule built." : "Deferred schedule generated.");
    } finally {
      setScheduleBusy(false);
    }
  }, [apiBase, demo]);

  const openNode = useCallback((id: string | null) => {
    setOpenNodeId(id);
    if (id) roadmapStore.selectNode(id); // keeps the Strategist rail focused on it
  }, []);

  /* ─── loading ─── */
  if (doc === undefined) {
    return (
      <div className="flex flex-col items-center justify-center py-28">
        <div className="h-10 w-10 rounded-full border-2 border-polaris-200 border-t-polaris-500 animate-spin" />
        <div className="mt-4 text-[13px] text-ink-dim">Loading your roadmap…</div>
      </div>
    );
  }

  /* ─── setup ─── */
  if (doc === null) {
    return (
      <RoadmapSetup
        defaultLevel={defaultLevel}
        initialProfile={initialProfile}
        onGenerate={generate}
        busy={genBusy}
        error={genErr}
      />
    );
  }

  const overall = overallProgress(doc);
  const nodes = doc.branches.flatMap((b) => b.nodes);
  const doneCount = nodes.filter((n) => n.status === "done").length;
  const currentNode = nodes.find((n) => n.status === "current");
  const lastAdaptation = doc.adaptations.slice(-1)[0];
  const activeUnit = activePhase === null ? undefined : doc.schedule?.units[activePhase];
  // Expanded schedule units are represented directly by tree leaves. The
  // workspace remains only for summaries/legacy units, where it provides the
  // generate action and the high-level explanation before tasks exist.
  const showScheduleWorkspace = !doc.schedule || activeUnit?.detailState !== "expanded";

  return (
    <div className="px-5 lg:px-10 py-7 max-w-[1160px] mx-auto">
      {/* ─── Header ─── */}
      <motion.div
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
        className="mb-8"
      >
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="min-w-0">
            <div className="text-[10.5px] uppercase tracking-[0.22em] text-ink-muted font-medium mb-1.5">
              {doc.config.durationDays}-day plan · {doc.schedule?.units.length ?? doc.phases.length} {doc.config.timelineMode} units · {doneCount}/{nodes.length} missions done
            </div>
            <h1 className="font-serif text-[30px] sm:text-[34px] leading-[1.05] font-bold tracking-tight text-ink">
              {doc.title}
            </h1>
            {currentNode && (
              <p className="text-[13px] text-ink-dim mt-1.5">
                <span className="inline-block h-2 w-2 rounded-full bg-polaris-500 animate-pulse mr-1.5" />
                Now growing: <button onClick={() => openNode(currentNode.id)} className="font-medium text-ink hover:text-polaris-600 transition-colors">{currentNode.title}</button>
              </p>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setTargetsOpen(true)}
              className="rounded-full hairline bg-paper-card px-3.5 py-2 text-[12px] font-medium text-ink-dim hover:text-ink transition-colors"
            >
              Targets
            </button>
            <button
              onClick={() => setAdaptOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-full bg-ink text-paper px-4 py-2 text-[12.5px] font-semibold hover:bg-polaris-700 transition-colors"
            >
              ✦ Adapt plan
            </button>
            <button
              onClick={async () => {
                if (!confirm("Start over with a new setup? Your current tree will be replaced.")) return;
                if (!demo) await fetch(apiBase, { method: "DELETE" });
                setDoc(null);
              }}
              className="rounded-full hairline bg-paper-card px-3.5 py-2 text-[12px] font-medium text-ink-dim hover:text-ink transition-colors"
              title="Re-run setup"
            >
              New setup
            </button>
          </div>
        </div>

        {/* Phase timeline */}
        <div className="relative mt-4">
          <button type="button" onClick={() => timelineRef.current?.scrollBy({ left: -260, behavior: "smooth" })} className="absolute left-0 top-1/2 z-10 hidden -translate-y-1/2 rounded-full bg-paper-card/95 px-2 py-1 text-ink-muted shadow-card ring-1 ring-inset ring-polaris-500/15 sm:block" aria-label="Scroll timeline left">‹</button>
          <div ref={timelineRef} className="flex items-center gap-1.5 overflow-x-auto py-2 pb-3 sm:px-7 [scrollbar-width:thin]">
          {doc.phases.map((p, i) => {
            const phaseNodes = nodes.filter((n) => n.phase === i);
            const phaseUnit = doc.schedule?.units[i];
            const phaseTasks = nodes.flatMap((n) => n.tasks.filter((t) => (
              phaseUnit?.yearIndex !== undefined ? t.yearIndex === phaseUnit.yearIndex : t.unitIndex === i
            )));
            const phaseDone = phaseTasks.length > 0
              ? phaseTasks.every((t) => t.done)
              : phaseNodes.length > 0 && phaseNodes.every((n) => n.status === "done");
            const phaseActive = phaseNodes.some((n) => n.status === "current");
            const phaseHasContent = phaseTasks.length > 0 || phaseNodes.length > 0 || phaseUnit?.detailState === "summary" || phaseUnit?.detailState === "deferred";
            const isSelected = activePhase === i;
            return (
              <button
                key={p}
                onClick={() => setActivePhase(doc.config.timelineMode === "monthly" ? i : isSelected ? null : i)}
                className={cn(
                  "shrink-0 rounded-full px-3 py-1 text-[11px] font-medium ring-1 ring-inset transition-colors cursor-pointer",
                  isSelected
                    ? "bg-ink text-paper ring-ink"
                    : phaseDone
                      ? "bg-aurora-100 text-aurora-700 ring-aurora-400/40 dark:bg-aurora-400/15 dark:text-aurora-100 hover:bg-aurora-200 dark:hover:bg-aurora-400/25"
                      : phaseActive
                        ? "bg-polaris-100 text-polaris-700 ring-polaris-300 dark:bg-polaris-400/20 dark:text-polaris-100 dark:ring-polaris-400/40 hover:bg-polaris-200 dark:hover:bg-polaris-400/30"
                        : phaseHasContent
                          ? "bg-polaris-100/60 text-polaris-700 ring-polaris-300/60 dark:bg-polaris-400/10 dark:text-polaris-200 dark:ring-polaris-400/25 hover:bg-polaris-100 dark:hover:bg-polaris-400/20"
                          : "bg-paper-card text-ink-muted ring-polaris-500/10 dark:ring-white/10 hover:bg-paper-soft hover:text-ink",
                )}
              >
                {phaseDone && "✓ "}{p}
                {phaseUnit?.detailState === "summary"
                  ? <span className="opacity-80 font-mono"> · prepared</span>
                  : phaseUnit?.detailState === "deferred"
                    ? <span className="opacity-60 font-mono"> · later</span>
                  : phaseTasks.length > 0
                    ? <span className="opacity-60 font-mono"> · {phaseTasks.filter((t) => t.done).length}/{phaseTasks.length}</span>
                    : phaseNodes.length > 0 && <span className="opacity-60 font-mono"> · {phaseNodes.filter((n) => n.status === "done").length}/{phaseNodes.length}</span>}
              </button>
            );
          })}
          <span className="shrink-0 ml-2 font-mono text-[11px] text-ink-muted tabular-nums">{overall}% grown</span>
          </div>
          <button type="button" onClick={() => timelineRef.current?.scrollBy({ left: 260, behavior: "smooth" })} className="absolute right-0 top-1/2 z-10 hidden -translate-y-1/2 rounded-full bg-paper-card/95 px-2 py-1 text-ink-muted shadow-card ring-1 ring-inset ring-polaris-500/15 sm:block" aria-label="Scroll timeline right">›</button>
        </div>

        {lastAdaptation && (
          <div className="mt-3 text-[11.5px] text-ink-muted">
            <span className="font-medium text-polaris-600 dark:text-polaris-300">Last adaptation:</span> {lastAdaptation.reason}
          </div>
        )}
      </motion.div>

      {/* Expanded schedule periods are represented by leaves in the tree.
          Summary and legacy periods use the workspace for preparation/actions. */}
      {showScheduleWorkspace && (
        <RoadmapScheduleWorkspace
          doc={doc}
          activePhase={activePhase}
          apiBase={apiBase}
          demo={demo}
          onOpenNode={openNode}
          onDocUpdated={onDocUpdated}
          onScheduleAction={buildSchedule}
          scheduleBusy={scheduleBusy}
        />
      )}

      {/* ─── Tree ─── */}
      <RoadmapTree doc={doc} onOpenNode={openNode} onOpenWeek={setOpenWeek} selectedNodeId={shared.selectedNodeId} activePhase={activePhase} />

      {/* ─── Modals + toast ─── */}
      <AnimatePresence>
        {openNodeId && (
          <RoadmapNodeModal
            key={openNodeId}
            doc={doc}
            nodeId={openNodeId}
            onClose={() => setOpenNodeId(null)}
            onDocUpdated={onDocUpdated}
            demo={demo}
          />
        )}
        {openWeek && (
          <RoadmapWeekModal
            key={`${openWeek.branchId}-${openWeek.kind}-${openWeek.unitIndex}-${openWeek.monthIndex ?? openWeek.weekIndex}`}
            doc={doc}
            unitIndex={openWeek.unitIndex}
            weekIndex={openWeek.weekIndex}
            monthIndex={openWeek.monthIndex}
            branchId={openWeek.branchId}
            apiBase={apiBase}
            demo={demo}
            onClose={() => setOpenWeek(null)}
            onDocUpdated={onDocUpdated}
            onOpenNode={openNode}
          />
        )}
        {targetsOpen && (
          <TargetPortfolioEditor
            doc={doc}
            apiBase={apiBase}
            demo={demo}
            onClose={() => setTargetsOpen(false)}
            onDocUpdated={onDocUpdated}
          />
        )}
        {adaptOpen && (
          <AdaptModal
            key="adapt"
            apiBase={apiBase}
            demo={demo}
            onClose={() => setAdaptOpen(false)}
            onDone={(next) => {
              setDoc(next);
              roadmapStore.setDoc(next);
              roadmapStore.emit("ROADMAP_REBALANCED", "Strategist re-planned the upcoming phases");
              setAdaptOpen(false);
              setToast("Plan adapted - upcoming missions updated.");
            }}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="pointer-events-none fixed inset-x-0 bottom-6 z-[60] flex justify-center px-4"
          >
            <div className="max-w-[min(92vw,560px)] rounded-full bg-ink px-5 py-2.5 text-center text-[12.5px] font-medium text-paper shadow-pop">
              ✦ {toast}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ─── Adapt modal ─── */
function AdaptModal({
  onClose, onDone, apiBase, demo,
}: {
  onClose: () => void;
  onDone: (doc: RoadmapDoc) => void;
  apiBase: string;
  demo: boolean;
}) {
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function run() {
    setBusy(true);
    setErr(null);
    try {
      if (demo) {
        const current = roadmapStore.get().doc;
        if (current) onDone({ ...current, updatedAt: new Date(), adaptations: [...current.adaptations, { id: crypto.randomUUID(), reason: reason.trim() || "Rebalanced around the highest-leverage unfinished work", at: new Date() }] });
        return;
      }
      const r = await fetch(`${apiBase}/adapt`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(reason.trim() ? { reason: reason.trim() } : {}),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) { setErr(d?.error ?? "Adaptation failed - try again."); return; }
      onDone(d.doc as RoadmapDoc);
    } finally {
      setBusy(false);
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 backdrop-blur-sm p-6"
      role="dialog" aria-modal="true" onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.96, y: 10 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.96, y: 10, opacity: 0 }}
        transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
        onClick={(e) => e.stopPropagation()}
        className="bg-paper-card rounded-3xl shadow-pop ring-1 ring-inset ring-polaris-500/10 dark:ring-white/[0.12] max-w-[480px] w-full p-6"
      >
        <h2 className="font-serif text-[19px] font-bold tracking-tight text-ink leading-tight">Adapt your roadmap</h2>
        <p className="text-[12.5px] text-ink-dim leading-relaxed mt-1.5 mb-3">
          The Strategist rewrites your remaining missions using your progress, scores, and notes. Completed work stays.
        </p>
        <textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          rows={3}
          maxLength={2000}
          placeholder="Optional - e.g. &quot;My SAT math mock was 600, focus there&quot; or &quot;Exams in 3 weeks, reduce the load&quot;"
          className="w-full rounded-xl border border-polaris-200 bg-paper-card px-3 py-2.5 text-[13px] text-ink placeholder:text-ink-muted/60 focus:border-polaris-400 focus:outline-none resize-none dark:border-white/[0.14] dark:bg-paper-deep"
        />
        {err && <div className="mt-2 text-[12px] text-rose-600 dark:text-rose-300">{err}</div>}
        <div className="mt-4 flex items-center justify-end gap-2">
          <button onClick={onClose} disabled={busy} className="text-[13px] text-ink-dim hover:text-ink px-3 py-2 transition-colors">Cancel</button>
          <button
            onClick={() => void run()}
            disabled={busy}
            className="inline-flex items-center gap-2 rounded-full bg-ink text-paper px-5 py-2.5 text-[13px] font-semibold hover:bg-polaris-700 transition-colors disabled:opacity-60"
          >
            {busy ? (
              <>
                <span className="h-3.5 w-3.5 rounded-full border-2 border-paper/30 border-t-paper animate-spin" />
                Adapting…
              </>
            ) : (
              <>✦ Adapt now</>
            )}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}
