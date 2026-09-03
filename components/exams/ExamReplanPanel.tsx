"use client";

/**
 * The plan change an exam result proposes.
 *
 * Renders as a diff the student approves, not as something that already
 * happened. Each row carries the arithmetic that produced it - "48% on Heart of
 * Algebra vs 71% overall" - because a change you cannot interrogate is one you
 * will not trust the second time.
 *
 * Additions are pre-selected (they are the point), deprioritisations are not
 * (removing effort from a plan is the student's call, not ours).
 */

import { useCallback, useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/cn";
import { track } from "@/lib/analytics";

type AddChange = {
  kind: "add";
  id: string;
  domain: string;
  title: string;
  summary: string;
  practice: string;
  priority: "high" | "medium";
  reason: string;
};

type DeprioritiseChange = {
  kind: "deprioritise";
  taskId: string;
  title: string;
  from: string;
  to: string;
  reason: string;
};

type PlanChange = AddChange | DeprioritiseChange;

type Proposal = {
  sessionId: string;
  exam: string;
  accuracy: number;
  weakDomains: { domain: string; accuracy: number; delta: number }[];
  changes: PlanChange[];
  targetWeek: number;
  noop: boolean;
  rationale: string;
};

const changeKey = (c: PlanChange) => (c.kind === "add" ? c.id : c.taskId);

export function ExamReplanPanel({ sessionId }: { sessionId: string }) {
  const [proposal, setProposal] = useState<Proposal | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [applied, setApplied] = useState<{ added: number; deprioritised: number } | null>(null);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/exams/sessions/${sessionId}/replan`, { cache: "no-store" });
      if (!res.ok) throw new Error("Could not read the plan proposal");
      const d = await res.json();
      const p: Proposal = d.proposal;
      setProposal(p);
      // Additions default on; removing effort is opt-in.
      setSelected(new Set(p.changes.filter((c) => c.kind === "add").map(changeKey)));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    }
  }, [sessionId]);

  useEffect(() => { void load(); }, [load]);

  function toggle(key: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  async function apply() {
    if (selected.size === 0) return;
    setBusy(true);
    setError("");
    try {
      const res = await fetch(`/api/exams/sessions/${sessionId}/replan`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ accept: [...selected] }),
      });
      if (!res.ok) throw new Error("Could not apply the changes");
      const d = await res.json();
      setApplied(d.applied);
      setProposal(d.proposal);
      track("action_lab_tool_used", { tool: "exam_replan_applied" });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  if (!proposal) {
    return (
      <div className="rounded-2xl border border-polaris-500/12 bg-paper-card p-5">
        <p className="text-[13px] text-ink-dim">{error || "Reading this attempt…"}</p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-polaris-500/12 bg-paper-card p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-[10.5px] uppercase tracking-[0.2em] text-polaris-600">
            What this changes
          </div>
          <h3 className="mt-2 font-serif text-[19px] font-bold text-ink">
            {proposal.noop ? "Your plan already fits" : "Proposed change to your week"}
          </h3>
          <p className="mt-1.5 max-w-lg text-[13px] leading-relaxed text-ink-dim">
            {proposal.rationale}
          </p>
        </div>
        {!proposal.noop && (
          <span className="shrink-0 rounded-full bg-paper-soft px-2.5 py-1 text-[11.5px] font-medium text-ink-dim dark:bg-white/[0.06]">
            Week {proposal.targetWeek}
          </span>
        )}
      </div>

      <AnimatePresence>
        {applied && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            className="overflow-hidden"
          >
            <div className="mt-4 rounded-xl border border-aurora-500/25 bg-aurora-500/[0.07] p-3.5 text-[13px] text-ink">
              Plan updated: {applied.added} task{applied.added === 1 ? "" : "s"} added
              {applied.deprioritised > 0 && `, ${applied.deprioritised} deprioritised`}.
              These now appear in your roadmap for week {proposal.targetWeek}.
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {proposal.changes.length > 0 && (
        <>
          <ul className="mt-5 space-y-2.5">
            {proposal.changes.map((c) => {
              const key = changeKey(c);
              const on = selected.has(key);
              const isAdd = c.kind === "add";
              return (
                <li key={key}>
                  <label
                    className={cn(
                      "flex cursor-pointer gap-3 rounded-xl border p-4 transition-colors",
                      on
                        ? isAdd
                          ? "border-aurora-500/35 bg-aurora-500/[0.05]"
                          : "border-polaris-500/35 bg-polaris-500/[0.05]"
                        : "border-polaris-500/12 bg-paper-soft dark:bg-white/[0.03]",
                    )}
                  >
                    <input
                      type="checkbox"
                      checked={on}
                      disabled={!!applied}
                      onChange={() => toggle(key)}
                      className="mt-1 shrink-0 accent-polaris-500"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span
                          className={cn(
                            "rounded px-1.5 py-0.5 text-[9.5px] font-bold uppercase tracking-[0.1em]",
                            isAdd
                              ? "bg-aurora-500/15 text-aurora-700 dark:text-aurora-200"
                              : "bg-ink/[0.07] text-ink-dim dark:bg-white/[0.08]",
                          )}
                        >
                          {isAdd ? "Add" : `${c.from} → ${c.to}`}
                        </span>
                        <span className="text-[14px] font-semibold text-ink">{c.title}</span>
                      </div>

                      {isAdd && (
                        <p className="mt-1.5 text-[13px] leading-relaxed text-ink-dim">
                          {c.summary}
                        </p>
                      )}

                      {/* The arithmetic behind the row. */}
                      <p className="mt-2 font-mono text-[11.5px] text-polaris-700 dark:text-polaris-300">
                        {c.reason}
                      </p>
                    </div>
                  </label>
                </li>
              );
            })}
          </ul>

          {!applied && (
            <div className="mt-5 flex flex-wrap items-center gap-3">
              <button
                type="button"
                disabled={busy || selected.size === 0}
                onClick={apply}
                className="rounded-full bg-ink px-5 py-2.5 text-[13.5px] font-semibold text-paper transition-colors hover:bg-ink/90 disabled:opacity-45"
              >
                {busy
                  ? "Applying…"
                  : `Apply ${selected.size} change${selected.size === 1 ? "" : "s"}`}
              </button>
              <button
                type="button"
                onClick={() => setSelected(new Set())}
                className="text-[13px] font-medium text-ink-dim hover:text-ink"
              >
                Reject all
              </button>
            </div>
          )}
        </>
      )}

      {error && <p className="mt-3 text-[12.5px] text-rose-600">{error}</p>}
    </div>
  );
}
