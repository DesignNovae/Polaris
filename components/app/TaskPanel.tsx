"use client";

/**
 * Expanded task panel. Slides in from the right (rendered as a route
 * modal - Next.js parallel routes / @modal slot in the future).
 *
 * The status toggle and deadline edit call PATCH /api/tasks/[id]; the
 * server revalidates /roadmap so the underlying list updates.
 */

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import type { DbMilestone, MilestoneStatus } from "@/types/app";
import { Btn, Pill, StatusBadge, Progress } from "./ui";
import { cn } from "@/lib/cn";

export function TaskPanel({ task }: { task: DbMilestone }) {
  const router = useRouter();
  const [tab, setTab] = useState<"plan" | "resources" | "why" | "activity">("plan");
  const [optimistic, setOptimistic] = useState<MilestoneStatus>(task.status);
  const [pending, startTransition] = useTransition();

  async function setStatus(next: MilestoneStatus) {
    setOptimistic(next);
    const res = await fetch(`/api/tasks/${task.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: next }),
    });
    if (!res.ok) {
      setOptimistic(task.status); // rollback
      console.error("[tasks] patch failed", res.status);
      return;
    }
    startTransition(() => router.refresh());
  }

  function close() {
    router.back();
  }

  const tabs = [
    { id: "plan",       label: "Plan" },
    { id: "resources",  label: "Resources" },
    { id: "why",        label: "Why this" },
    { id: "activity",   label: "Activity" },
  ] as const;

  return (
    <div className="fixed inset-0 z-40 flex" role="dialog" aria-modal="true">
      <button className="flex-1 bg-ink/30 backdrop-blur-sm" onClick={close} aria-label="Close"/>
      <div className="w-[640px] h-full bg-bg border-l border-polaris-500/10 shadow-2xl overflow-y-auto">

        {/* Header */}
        <div className="px-7 py-5 border-b border-polaris-500/10 sticky top-0 bg-bg/95 backdrop-blur z-10">
          <div className="flex items-start gap-4">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5 mb-1">
                <Pill tone="polaris">{task.category}</Pill>
                <StatusBadge s={optimistic}/>
                {task.deadline && <span className="ml-2 text-[11px] font-mono text-ink-muted">due {task.deadline}</span>}
              </div>
              <h2 className="font-serif text-[22px] leading-tight font-bold tracking-tight text-ink">{task.title}</h2>
            </div>
            <button onClick={close} className="text-ink-muted hover:text-ink p-1" aria-label="Close">
              <Close/>
            </button>
          </div>

          {/* Status toggle */}
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <span className="text-[11px] text-ink-muted">Status →</span>
            {(["pending", "in-progress", "done"] as MilestoneStatus[]).map(s => (
              <button
                key={s}
                onClick={() => setStatus(s)}
                disabled={pending}
                className={cn(
                  "h-7 px-2.5 text-xs font-medium rounded-md transition-colors",
                  optimistic === s ? "bg-ink text-bg" : "bg-bg-card ring-1 ring-inset ring-polaris-500/10 text-ink-dim hover:text-ink",
                )}
              >
                {s === "in-progress" ? "In progress" : s === "pending" ? "To do" : "Done"}
              </button>
            ))}
            <div className="ml-auto flex items-center gap-2 min-w-[160px]">
              <Progress value={optimistic === "done" ? 100 : optimistic === "in-progress" ? 50 : 0}/>
              <span className="font-mono text-[11px] text-ink-dim tabular-nums">{optimistic === "done" ? 100 : optimistic === "in-progress" ? 50 : 0}%</span>
            </div>
          </div>

          {/* Tabs */}
          <div className="mt-4 flex items-center gap-1 -mb-5">
            {tabs.map(t => (
              <button key={t.id} onClick={() => setTab(t.id)}
                className={cn(
                  "px-2.5 h-8 text-[12.5px] font-medium border-b-2 -mb-px",
                  tab === t.id ? "border-polaris-500 text-ink" : "border-transparent text-ink-dim hover:text-ink",
                )}>
                {t.label}
              </button>
            ))}
          </div>
        </div>

        <div className="px-7 py-6 space-y-6">
          {tab === "plan" && (
            <>
              <Block label="Description">{task.description}</Block>
              <Block label="Success metric">
                <span className="inline-flex items-center gap-1.5 rounded-md bg-aurora-50 text-aurora-600 px-2 py-1 text-[12px] font-medium">
                  {task.metric}
                </span>
              </Block>
            </>
          )}
          {tab === "why" && (
            <>
              <Block label="Rationale">{task.rationale}</Block>
              <Block label="Grounded in">
                <span className="text-ink-muted text-[12px]">Sources resolved from your live KB on render - see /strategist for the full citation graph.</span>
              </Block>
            </>
          )}
          {tab === "resources" && (
            <Block label="Linked resources">
              <span className="text-ink-muted text-[12px]">Resources attached to this milestone will appear here. Add new ones from /resources.</span>
            </Block>
          )}
          {tab === "activity" && (
            <Block label="Audit trail">
              <span className="text-ink-muted text-[12px]">Status changes, deadline edits, and Strategist notes are logged here.</span>
            </Block>
          )}
        </div>
      </div>
    </div>
  );
}

function Block({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-[10.5px] uppercase tracking-[0.22em] text-ink-muted font-medium mb-2">{label}</div>
      <div className="text-[14px] text-ink leading-relaxed">{children}</div>
    </div>
  );
}

function Close() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <path d="M6 6l12 12 M18 6L6 18"/>
    </svg>
  );
}

