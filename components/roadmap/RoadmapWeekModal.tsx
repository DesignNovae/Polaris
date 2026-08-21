"use client";

import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/cn";
import { isYouTubeId, resourcesForTask } from "@/lib/roadmap/resources";
import { roadmapStore } from "@/lib/roadmap/store";
import {
  nodeProgressFromTasks,
  recomputeStatuses,
  type NodeTask,
  type RoadmapDoc,
  type RoadmapNode,
} from "@/lib/roadmap/types";

type WeekRow = { node: RoadmapNode; task: NodeTask; branchTitle: string };

/**
 * Rich weekly leaf detail. It deliberately uses the same information density
 * and visual language as RoadmapNodeModal, while aggregating the missions and
 * resources that belong to this branch/week.
 */
export function RoadmapWeekModal({
  doc, unitIndex, weekIndex, monthIndex, branchId, apiBase, demo, onClose, onDocUpdated, onOpenNode,
}: {
  doc: RoadmapDoc;
  unitIndex: number;
  weekIndex: number;
  monthIndex?: number;
  branchId?: string;
  apiBase: string;
  demo: boolean;
  onClose: () => void;
  onDocUpdated: (doc: RoadmapDoc, adaptation?: string | null) => void;
  onOpenNode: (id: string) => void;
}) {
  const [busy, setBusy] = useState<string | null>(null);
  const [noteDraft, setNoteDraft] = useState("");
  const [scoreKey, setScoreKey] = useState<string | null>(null);
  const [scoreVal, setScoreVal] = useState("");
  const [error, setError] = useState<string | null>(null);
  const unit = doc.schedule?.units[unitIndex];
  const month = monthIndex === undefined ? undefined : unit?.months?.find((item) => item.monthIndex === monthIndex);
  const week = month?.weeks.find((item) => item.weekIndex === weekIndex) ?? unit?.weeks?.find((item) => item.weekIndex === weekIndex);
  const activePeriod = month ?? week ?? (unit ? { title: unit.title, objective: unit.objective } : undefined);

  const rows = useMemo<WeekRow[]>(() => {
    if (!unit) return [];
    const branches = branchId ? doc.branches.filter((branch) => branch.id === branchId) : doc.branches;
    return branches.flatMap((branch) => branch.nodes.flatMap((node) => node.tasks
      .filter((task) => monthIndex !== undefined
        ? task.yearIndex === unit?.yearIndex && task.monthIndex === monthIndex
        : unit?.weeks?.length
          ? task.unitIndex === unitIndex && task.weekIndex === weekIndex
          : task.unitIndex === unitIndex)
      .map((task) => ({ node, task, branchTitle: branch.title }))));
  }, [doc, unit, unitIndex, weekIndex, monthIndex, branchId]);

  const missionNodes = useMemo(() => {
    const seen = new Set<string>();
    return rows.flatMap((row) => {
      if (seen.has(row.node.id)) return [];
      seen.add(row.node.id);
      return [row.node];
    });
  }, [rows]);

  if (!unit || !activePeriod) return null;
  const activeUnit = unit;
  const activeWeek = activePeriod;

  const primary = missionNodes[0];
  const doneCount = rows.filter((row) => row.task.done).length;
  const progress = rows.length ? Math.round((doneCount / rows.length) * 100) : 0;
  const priority = missionNodes.some((node) => node.priority === "high") ? "high" : missionNodes.some((node) => node.priority === "medium") ? "medium" : "low";
  const hours = Math.round(missionNodes.reduce((sum, node) => sum + node.estimatedHoursPerWeek, 0) * 2) / 2;
  const difficulty = missionNodes.length ? Math.max(...missionNodes.map((node) => node.difficulty)) : 1;
  const impact = missionNodes.map((node) => node.impact).find(Boolean) ?? "+ Consistent weekly progress";
  const resources = [...new Map(rows.flatMap((row) => row.task.resources ?? resourcesForTask(row.task.text, row.node.topics)).map((resource) => [resource.ref, resource])).values()].slice(0, 8);
  const periodLabel = monthIndex !== undefined ? "Month" : activeUnit.label.startsWith("Day") ? "Day" : "Week";
  const scoreInputs = [...new Map(missionNodes.flatMap((node) => node.scoreInputs).map((score) => [score.key, score])).values()];
  const notes = missionNodes.flatMap((node) => node.notes.map((note) => ({ ...note, nodeTitle: node.title }))).slice(-6);

  async function toggle(row: WeekRow) {
    setBusy(row.task.id);
    setError(null);
    try {
      if (demo) {
        const next = structuredClone(doc) as RoadmapDoc;
        const node = next.branches.flatMap((branch) => branch.nodes).find((item) => item.id === row.node.id);
        const task = node?.tasks.find((item) => item.id === row.task.id);
        if (node && task) {
          task.done = !task.done;
          node.progress = nodeProgressFromTasks(node.tasks);
          if (node.progress === 100) {
            node.status = "done";
            node.completedAt = node.completedAt ?? new Date();
          } else if (node.status === "done") {
            node.status = "current";
            node.completedAt = undefined;
          }
          next.updatedAt = new Date();
          onDocUpdated(recomputeStatuses(next));
        }
        return;
      }
      const response = await fetch(`${apiBase}/node/${row.node.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ toggleTask: row.task.id }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.doc) throw new Error(data?.error ?? `Could not update ${periodLabel.toLowerCase()} task`);
      onDocUpdated(data.doc as RoadmapDoc, data.adaptation ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : `Could not update ${periodLabel.toLowerCase()} task`);
    } finally {
      setBusy(null);
    }
  }

  async function completeWeek() {
    const remaining = rows.filter((row) => !row.task.done);
    if (!remaining.length) return;
    setBusy("complete-week");
    setError(null);
    try {
      if (demo) {
        const next = structuredClone(doc) as RoadmapDoc;
        const refSet = new Set(remaining.map((row) => `${row.node.id}:${row.task.id}`));
        for (const node of next.branches.flatMap((branch) => branch.nodes)) {
          for (const task of node.tasks) if (refSet.has(`${node.id}:${task.id}`)) task.done = true;
          node.progress = nodeProgressFromTasks(node.tasks);
          if (node.progress === 100) { node.status = "done"; node.completedAt = node.completedAt ?? new Date(); }
        }
        next.updatedAt = new Date();
        onDocUpdated(recomputeStatuses(next));
        return;
      }
      let latest = doc;
      for (const row of remaining) {
        const response = await fetch(`${apiBase}/node/${row.node.id}`, {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ toggleTask: row.task.id }),
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok || !data.doc) throw new Error(data?.error ?? `Could not complete ${periodLabel.toLowerCase()}`);
        latest = data.doc as RoadmapDoc;
      }
      onDocUpdated(latest);
    } catch (err) {
      setError(err instanceof Error ? err.message : `Could not complete ${periodLabel.toLowerCase()}`);
    } finally {
      setBusy(null);
    }
  }

  async function saveNote() {
    if (!primary || !noteDraft.trim()) return;
    setBusy("note");
    setError(null);
    try {
      if (demo) {
        const next = structuredClone(doc) as RoadmapDoc;
        const node = next.branches.flatMap((branch) => branch.nodes).find((item) => item.id === primary.id);
        if (node) node.notes.push({ id: crypto.randomUUID(), text: noteDraft.trim(), at: new Date() });
        next.updatedAt = new Date();
        onDocUpdated(next);
      } else {
        const response = await fetch(`${apiBase}/node/${primary.id}`, {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ note: noteDraft.trim() }),
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok || !data.doc) throw new Error(data?.error ?? "Could not save note");
        onDocUpdated(data.doc as RoadmapDoc);
      }
      setNoteDraft("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save note");
    } finally {
      setBusy(null);
    }
  }

  async function saveScore() {
    if (!primary || !scoreKey) return;
    const value = Number(scoreVal);
    if (!Number.isFinite(value)) return;
    setBusy("score");
    setError(null);
    try {
      if (demo) {
        const next = structuredClone(doc) as RoadmapDoc;
        next.scores.push({ key: scoreKey, label: scoreInputs.find((score) => score.key === scoreKey)?.label ?? scoreKey, value, max: scoreInputs.find((score) => score.key === scoreKey)?.max ?? 100, nodeId: primary.id, at: new Date() });
        next.updatedAt = new Date();
        onDocUpdated(next);
      } else {
        const response = await fetch(`${apiBase}/node/${primary.id}`, {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ score: { key: scoreKey, value } }),
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok || !data.doc) throw new Error(data?.error ?? "Could not save score");
        onDocUpdated(data.doc as RoadmapDoc, data.adaptation ?? null);
      }
      setScoreVal("");
      setScoreKey(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save score");
    } finally {
      setBusy(null);
    }
  }

  function askStrategist() {
    if (!primary) return;
    const draft = `Help me with ${activeUnit.label}, ${activeWeek.title}: ${activeWeek.objective} The ${periodLabel.toLowerCase()} progress is ${progress}%.`;
    roadmapStore.selectNode(primary.id, { silent: true });
    window.dispatchEvent(new CustomEvent("polaris:openAgentRail", { detail: { draft } }));
    onClose();
  }

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-[55] flex items-center justify-center bg-ink/45 backdrop-blur-sm p-4 sm:p-8"
      role="dialog" aria-modal="true" onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.94, y: 16, opacity: 0 }} animate={{ scale: 1, y: 0, opacity: 1 }} exit={{ scale: 0.94, y: 16, opacity: 0 }}
        onClick={(event) => event.stopPropagation()}
        className="relative w-full max-w-[680px] max-h-[90vh] overflow-y-auto overscroll-contain rounded-3xl bg-paper-card shadow-pop ring-1 ring-inset ring-polaris-500/10 dark:ring-white/[0.12]"
      >
        <div className="sticky top-0 z-10 bg-paper-card/90 backdrop-blur-md px-6 pt-5 pb-4 border-b border-polaris-500/10 dark:border-white/[0.08]">
          <div className="flex items-start gap-3">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5 flex-wrap mb-1.5">
                {branchId && <Chip>{rows[0]?.branchTitle ?? "Roadmap"}</Chip>}
                <Chip>{periodLabel}</Chip>
                <Chip>{unit.label}</Chip>
                <Chip tone={priority === "high" ? "rose" : "ink"}>{priority} priority</Chip>
                <span className="text-[10.5px] font-mono text-ink-muted">{"●".repeat(difficulty)}{"○".repeat(5 - difficulty)}</span>
              </div>
              <h2 className="font-serif text-[23px] leading-tight font-bold tracking-tight text-ink">{activeWeek.title}</h2>
              <div className="mt-1 flex items-center gap-3 text-[11px] font-mono text-ink-muted">
                <span>~{hours || 0}h/week</span><span>·</span><span>{unit.label}</span><span>·</span><span>{progress}% done</span>
              </div>
            </div>
            <button onClick={onClose} aria-label="Close" className="text-ink-muted hover:text-ink p-1.5 rounded-lg hover:bg-paper-soft transition-colors">×</button>
          </div>
          <div className="mt-3 h-1.5 rounded-full bg-paper-deep overflow-hidden"><div className="h-full rounded-full bg-gradient-to-r from-polaris-400 via-nova-400 to-aurora-400 transition-all duration-500" style={{ width: `${progress}%` }} /></div>
        </div>

        <div className="px-6 py-5 space-y-6">
          {error && <div className="rounded-xl bg-rose-50 dark:bg-rose-400/10 px-4 py-3 text-[12px] text-rose-700 dark:text-rose-200">{error}</div>}

          <section>
            <Label>Mission brief</Label>
            <p className="text-[13.5px] text-ink leading-relaxed">{activeWeek.objective}</p>
            <div className="mt-3 grid sm:grid-cols-2 gap-3">
              <div className="rounded-xl bg-paper-soft p-3.5"><div className="text-[10px] uppercase tracking-wider font-bold text-nova-600 dark:text-nova-200 mb-1">Why it matters</div><p className="text-[12.5px] text-ink leading-relaxed">{missionNodes.slice(0, 2).map((node) => node.why).join(" ") || `This ${periodLabel.toLowerCase()} turns the roadmap objective into measurable evidence.`}</p></div>
              <div className="rounded-xl bg-paper-soft p-3.5"><div className="text-[10px] uppercase tracking-wider font-bold text-polaris-600 dark:text-polaris-300 mb-1">How to do it</div><p className="text-[12.5px] text-ink leading-relaxed">{missionNodes[0]?.how || `Complete the checklist in order and capture evidence before the ${periodLabel.toLowerCase()} closes.`}</p></div>
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-2 text-[11.5px]"><span className="inline-flex items-center gap-1.5 rounded-full bg-aurora-100 dark:bg-aurora-400/15 text-aurora-700 dark:text-aurora-100 ring-1 ring-inset ring-aurora-400/40 px-2.5 py-1 font-medium">✓ Done when: all {periodLabel.toLowerCase()} tasks are complete</span><span className="inline-flex items-center rounded-full bg-paper-soft px-2.5 py-1 font-medium text-ink-dim ring-1 ring-inset ring-polaris-500/10 dark:ring-white/10">{impact}</span></div>
          </section>

          <section className="relative rounded-xl p-[1.5px] overflow-hidden"><div className="absolute inset-0 bg-gradient-to-r from-polaris-400/60 via-nova-400/50 to-aurora-400/60" /><div className="relative rounded-[10.5px] bg-paper-card px-4 py-3"><div className="flex items-center gap-2 mb-1"><span className="h-5 w-5 rounded-full bg-gradient-to-br from-polaris-500 to-nova-500 text-white inline-flex items-center justify-center text-[9px]">✦</span><span className="text-[10.5px] uppercase tracking-wider font-bold text-polaris-600 dark:text-polaris-300">Strategist tip</span></div><p className="text-[12.5px] text-ink leading-relaxed">{primary ? `Prioritize “${primary.title}” first, then keep the evidence from each task in one place before the ${periodLabel.toLowerCase()} ends.` : "Finish the checklist in order and keep one concrete piece of evidence."}</p></div></section>

          <section><Label>{periodLabel} task checklist</Label><ul className="space-y-1.5">{rows.map((row) => <li key={row.task.id}><button onClick={() => void toggle(row)} disabled={busy !== null} className={cn("w-full flex items-start gap-2.5 rounded-xl px-3 py-2.5 text-left transition-colors ring-1 ring-inset", row.task.done ? "bg-aurora-100/50 dark:bg-aurora-400/10 ring-aurora-400/30" : "bg-paper-card ring-polaris-500/10 dark:ring-white/10 hover:ring-polaris-400/40")}><span className={cn("mt-0.5 h-[18px] w-[18px] shrink-0 rounded-md ring-1 ring-inset flex items-center justify-center", row.task.done ? "bg-aurora-500 ring-aurora-500 text-white" : "ring-ink-faint bg-paper-card")}>{busy === row.task.id ? <span className="h-2 w-2 rounded-full border border-current border-t-transparent animate-spin" /> : row.task.done ? "✓" : null}</span><span className="flex-1"><span className={cn("block text-[13px] leading-snug", row.task.done ? "text-ink-muted line-through" : "text-ink")}>{row.task.text}</span><span className="block mt-1 text-[10.5px] text-ink-muted">{row.node.title}</span></span></button></li>)}</ul></section>

          {resources.length > 0 && <section><Label>Resources for these tasks</Label><div className="space-y-2">{resources.map((resource) => <ResourceRow key={resource.ref} resource={resource} />)}</div></section>}

          {scoreInputs.length > 0 && <section><Label>Log a score</Label><p className="text-[11.5px] text-ink-muted mb-2">Log a test or benchmark connected to this {periodLabel.toLowerCase()}&apos;s missions.</p><div className="flex flex-wrap items-end gap-2"><div className="flex flex-wrap gap-1.5">{scoreInputs.map((score) => <button key={score.key} onClick={() => setScoreKey(scoreKey === score.key ? null : score.key)} className={cn("rounded-full px-3 py-1.5 text-[12px] font-medium ring-1 ring-inset transition-colors", scoreKey === score.key ? "bg-ink text-paper ring-ink" : "bg-paper-card text-ink-dim ring-polaris-200 dark:ring-white/[0.15]")}>{score.label}</button>)}</div>{scoreKey && <div className="flex items-center gap-2"><input type="number" value={scoreVal} onChange={(event) => setScoreVal(event.target.value)} placeholder={`${scoreInputs.find((score) => score.key === scoreKey)?.min ?? ""}–${scoreInputs.find((score) => score.key === scoreKey)?.max ?? ""}`} step={scoreInputs.find((score) => score.key === scoreKey)?.step ?? 1} className="w-28 rounded-xl border border-polaris-200 bg-paper-card px-3 py-2 text-sm text-ink focus:border-polaris-400 focus:outline-none dark:border-white/[0.14] dark:bg-paper-deep" /><button onClick={() => void saveScore()} disabled={busy !== null || !scoreVal} className="rounded-xl bg-ink text-paper px-3.5 py-2 text-[12px] font-semibold disabled:opacity-40">{busy === "score" ? "…" : "Save"}</button></div>}</div></section>}

          <section><Label>Notes</Label>{notes.length > 0 && <ul className="space-y-1.5 mb-2">{notes.map((note) => <li key={note.id} className="rounded-xl bg-paper-soft px-3 py-2 text-[12.5px] text-ink leading-relaxed"><span className="block text-[10px] font-mono text-ink-muted mb-0.5">{note.nodeTitle} · {new Date(note.at).toLocaleString()}</span>{note.text}</li>)}</ul>}<div className="flex items-end gap-2"><textarea value={noteDraft} onChange={(event) => setNoteDraft(event.target.value)} rows={2} maxLength={2000} placeholder="Log progress, blockers, results…" className="flex-1 rounded-xl border border-polaris-200 bg-paper-card px-3 py-2 text-[12.5px] text-ink placeholder:text-ink-muted/60 focus:border-polaris-400 focus:outline-none resize-none dark:border-white/[0.14] dark:bg-paper-deep" /><button onClick={() => void saveNote()} disabled={busy !== null || !noteDraft.trim()} className="rounded-xl bg-ink text-paper h-9 px-3.5 text-[12px] font-semibold disabled:opacity-40">{busy === "note" ? "…" : "Add"}</button></div></section>
        </div>

        <div className="sticky bottom-0 bg-paper-card/90 backdrop-blur-md px-6 py-4 border-t border-polaris-500/10 dark:border-white/[0.08] flex items-center gap-2"><button onClick={() => void completeWeek()} disabled={busy !== null || progress === 100 || !rows.length} className="inline-flex items-center gap-1.5 rounded-full bg-aurora-600 text-white px-4 py-2 text-[12.5px] font-semibold hover:bg-aurora-700 transition-colors disabled:opacity-40">{progress === 100 ? `✓ ${periodLabel} complete` : busy === "complete-week" ? "Completing…" : `✓ Mark ${periodLabel.toLowerCase()} done`}</button><button onClick={askStrategist} className="text-[12.5px] text-polaris-600 dark:text-polaris-300 hover:underline font-medium">Ask Strategist →</button>{primary && <button onClick={() => { onClose(); onOpenNode(primary.id); }} className="ml-auto text-[11px] text-ink-muted hover:text-ink truncate max-w-[180px]">Open mission details</button>}</div>
      </motion.div>
    </motion.div>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return <div className="text-[10.5px] uppercase tracking-[0.22em] text-ink-muted font-medium mb-2">{children}</div>;
}

function Chip({ children, tone = "ink" }: { children: React.ReactNode; tone?: "ink" | "rose" }) {
  return <span className={cn("text-[10px] uppercase tracking-wider font-bold rounded-full px-2 py-0.5 ring-1 ring-inset", tone === "rose" ? "text-rose-600 dark:text-rose-200 bg-rose-50 dark:bg-rose-400/15 ring-rose-200 dark:ring-rose-400/30" : "text-ink-dim bg-paper-soft ring-polaris-500/10 dark:ring-white/10")}>{children}</span>;
}

function ResourceRow({ resource }: { resource: { kind: string; title: string; ref: string; note?: string } }) {
  const [playing, setPlaying] = useState(false);
  const embeddable = resource.kind === "youtube" && isYouTubeId(resource.ref);
  if (embeddable && playing) return <div className="rounded-xl overflow-hidden ring-1 ring-inset ring-polaris-500/15"><div className="aspect-video"><iframe src={`https://www.youtube.com/embed/${resource.ref}?autoplay=1`} title={resource.title} allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen className="h-full w-full" /></div><div className="px-3 py-2 bg-paper-soft text-[11.5px] text-ink-dim flex items-center justify-between"><span className="truncate">{resource.title}</span><button onClick={() => setPlaying(false)} className="text-ink-muted hover:text-ink ml-2">close player</button></div></div>;
  const inner = <><span className="h-8 w-8 shrink-0 rounded-lg flex items-center justify-center text-[13px] font-bold bg-paper-soft text-ink-dim">{resource.kind === "youtube" ? "▶" : resource.kind === "practice" ? "✎" : "↗"}</span><span className="min-w-0 flex-1"><span className="block text-[12.5px] font-medium text-ink truncate">{resource.title}</span>{resource.note && <span className="block text-[11px] text-ink-muted truncate">{resource.note}</span>}</span><span className="text-[10px] uppercase tracking-wider font-bold text-ink-muted shrink-0">{embeddable ? "play" : resource.kind}</span></>;
  const className = "w-full flex items-center gap-3 rounded-xl px-3 py-2.5 ring-1 ring-inset ring-polaris-500/10 dark:ring-white/10 bg-paper-card hover:ring-polaris-400/40 transition-all text-left";
  return embeddable ? <button onClick={() => setPlaying(true)} className={className}>{inner}</button> : <a href={resource.ref} target="_blank" rel="noopener noreferrer" className={className}>{inner}</a>;
}
