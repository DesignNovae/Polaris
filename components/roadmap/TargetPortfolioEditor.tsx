"use client";

import { useState } from "react";
import { cn } from "@/lib/cn";
import type { RoadmapConfig, RoadmapDoc } from "@/lib/roadmap/types";

type Target = NonNullable<RoadmapConfig["targets"]>[number];

export function TargetPortfolioEditor({ doc, apiBase, demo, onClose, onDocUpdated }: {
  doc: RoadmapDoc;
  apiBase: string;
  demo: boolean;
  onClose: () => void;
  onDocUpdated: (doc: RoadmapDoc, adaptation?: string | null) => void;
}) {
  const [targets, setTargets] = useState<Target[]>(doc.config.targets ?? []);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function update(index: number, patch: Partial<Target>) {
    setTargets((current) => current.map((target, i) => i === index ? { ...target, ...patch } : target));
  }

  async function save() {
    const clean = targets.filter((target) => target.query.trim()).map((target) => ({ ...target, query: target.query.trim() }));
    if (!clean.length) {
      setError("Add at least one target so the planner has something explicit to resolve.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      if (demo) {
        const next = structuredClone(doc) as RoadmapDoc;
        next.config.targets = clean;
        next.updatedAt = new Date();
        onDocUpdated(next, "Target portfolio updated in the local demo.");
        onClose();
        return;
      }
      const response = await fetch(`${apiBase}/targets`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ targets: clean }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data?.error ?? "Could not update targets.");
      onDocUpdated(data.doc as RoadmapDoc, "Target portfolio updated; strategy and priorities were recalculated.");
      onClose();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not update targets.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/50 p-4" role="dialog" aria-modal="true" aria-label="Target portfolio">
      <div className="w-full max-w-2xl rounded-2xl bg-paper-card p-5 shadow-2xl ring-1 ring-inset ring-polaris-500/15">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="text-[10px] uppercase tracking-[0.2em] text-ink-muted">Planning inputs</div>
            <h2 className="mt-1 font-serif text-[23px] font-bold text-ink">Target portfolio</h2>
            <p className="mt-1 text-[12px] text-ink-dim">Targets are resolved by kind, identity, country, and program before they influence requirements or priorities.</p>
          </div>
          <button type="button" onClick={onClose} className="text-ink-muted hover:text-ink" aria-label="Close">×</button>
        </div>

        <div className="mt-5 space-y-3">
          {targets.map((target, index) => (
            <div key={`${index}-${target.query}`} className="rounded-xl bg-paper-soft/70 p-3 ring-1 ring-inset ring-polaris-500/10">
              <div className="grid gap-2 sm:grid-cols-[1fr_140px_110px]">
                <input value={target.query} onChange={(event) => update(index, { query: event.target.value })} placeholder="University or scholarship name" className="rounded-lg bg-paper-card px-3 py-2 text-[12px] text-ink outline-none ring-1 ring-inset ring-polaris-500/15" />
                <select value={target.kind} onChange={(event) => update(index, { kind: event.target.value as Target["kind"] })} className="rounded-lg bg-paper-card px-3 py-2 text-[12px] text-ink outline-none ring-1 ring-inset ring-polaris-500/15">
                  <option value="university">University</option>
                  <option value="scholarship">Scholarship</option>
                </select>
                <select value={target.priority} onChange={(event) => update(index, { priority: event.target.value as Target["priority"] })} className="rounded-lg bg-paper-card px-3 py-2 text-[12px] text-ink outline-none ring-1 ring-inset ring-polaris-500/15">
                  <option value="primary">Primary</option>
                  <option value="secondary">Secondary</option>
                </select>
              </div>
              <div className="mt-2 grid gap-2 sm:grid-cols-3">
                <input value={target.country ?? ""} onChange={(event) => update(index, { country: event.target.value || undefined })} placeholder="Country" className="rounded-lg bg-paper-card px-3 py-2 text-[11px] text-ink outline-none ring-1 ring-inset ring-polaris-500/15" />
                <input value={target.program ?? ""} onChange={(event) => update(index, { program: event.target.value || undefined })} placeholder="Program / degree" className="rounded-lg bg-paper-card px-3 py-2 text-[11px] text-ink outline-none ring-1 ring-inset ring-polaris-500/15" />
                <select value={target.degreeLevel ?? "general"} onChange={(event) => update(index, { degreeLevel: event.target.value as Target["degreeLevel"] })} className="rounded-lg bg-paper-card px-3 py-2 text-[11px] text-ink outline-none ring-1 ring-inset ring-polaris-500/15">
                  <option value="general">Degree unknown</option>
                  <option value="undergrad">Undergraduate</option>
                  <option value="masters">Master&apos;s</option>
                  <option value="phd">PhD</option>
                </select>
              </div>
              <button type="button" onClick={() => setTargets((current) => current.filter((_, i) => i !== index))} className="mt-2 text-[11px] text-rose-600 hover:text-rose-700 dark:text-rose-300">Remove target</button>
            </div>
          ))}
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <button type="button" onClick={() => setTargets((current) => [...current, { query: "", kind: "university", priority: "secondary" }])} disabled={targets.length >= 12} className="rounded-full bg-paper-soft px-3.5 py-2 text-[11.5px] font-semibold text-ink disabled:opacity-50">+ Add target</button>
          <div className="flex items-center gap-2">
            {error && <span className="max-w-[260px] text-right text-[11px] text-rose-600 dark:text-rose-300">{error}</span>}
            <button type="button" onClick={onClose} className="rounded-full px-3.5 py-2 text-[11.5px] text-ink-muted hover:text-ink">Cancel</button>
            <button type="button" onClick={() => void save()} disabled={busy} className={cn("rounded-full bg-ink px-4 py-2 text-[11.5px] font-semibold text-paper", busy && "opacity-60")}>{busy ? "Rebuilding…" : "Save targets"}</button>
          </div>
        </div>
      </div>
    </div>
  );
}
