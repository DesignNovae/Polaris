"use client";

/**
 * RoadmapNodeModal - the interactive mission popup for a clicked leaf.
 *
 * Sections: Mission Brief (what/why/how) · Task Checklist (live toggles) ·
 * Resource Pack (embedded YouTube + links) · Score input · Notes ·
 * Completion criteria · Mark done · Ask Strategist · Next unlock.
 *
 * Every mutation PATCHes /api/roadmap/v2/node/[id] and swaps in the full
 * updated doc - the same doc the Strategist reads.
 */

import { useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { cn } from "@/lib/cn";
import { nodeProgressFromTasks, recomputeStatuses, type RoadmapDoc, type RoadmapNode } from "@/lib/roadmap/types";
import { isYouTubeId } from "@/lib/roadmap/resources";
import { roadmapStore, nodeTip } from "@/lib/roadmap/store";

const TYPE_LABEL: Record<RoadmapNode["type"], string> = {
  study: "Study", practice: "Practice", project: "Project",
  test: "Test", activity: "Activity", application: "Application",
};

export function RoadmapNodeModal({
  doc, nodeId, onClose, onDocUpdated, demo = false,
}: {
  doc: RoadmapDoc;
  nodeId: string;
  onClose: () => void;
  onDocUpdated: (doc: RoadmapDoc, adaptation?: string | null) => void;
  demo?: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const found = useMemo(() => {
    for (const b of doc.branches) {
      const n = b.nodes.find((x) => x.id === nodeId);
      if (n) return { branch: b, node: n };
    }
    return null;
  }, [doc, nodeId]);

  const [noteDraft, setNoteDraft] = useState("");
  const [scoreKey, setScoreKey] = useState<string | null>(null);
  const [scoreVal, setScoreVal] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [adaptMsg, setAdaptMsg] = useState<string | null>(null);

  if (!found) return null;
  const { branch, node } = found;
  const locked = node.status === "locked";
  const phase = doc.phases[node.phase] ?? `Phase ${node.phase + 1}`;
  const tip = nodeTip(doc, node);

  // Next unlock = first non-done node after this one in the branch.
  const ordered = [...branch.nodes].sort((a, b) => a.phase - b.phase);
  const idx = ordered.findIndex((n) => n.id === node.id);
  const nextUp = ordered.slice(idx + 1).find((n) => n.status !== "done");

  async function patch(body: Record<string, unknown>, key: string) {
    setBusy(key);
    try {
      if (demo) {
        const next = structuredClone(doc) as RoadmapDoc;
        const nextNode = next.branches.flatMap((item) => item.nodes).find((item) => item.id === node.id);
        if (!nextNode) return false;
        if (typeof body.toggleTask === "string") {
          const task = nextNode.tasks.find((item) => item.id === body.toggleTask);
          if (task) task.done = !task.done;
          nextNode.progress = nodeProgressFromTasks(nextNode.tasks);
        }
        if (typeof body.note === "string") nextNode.notes.push({ id: crypto.randomUUID(), text: body.note, at: new Date() });
        if (body.score && typeof body.score === "object") {
          const score = body.score as { key: string; value: number };
          next.scores.push({ key: score.key, label: score.key, value: score.value, max: 1600, nodeId: nextNode.id, at: new Date() });
        }
        if (body.markDone) { nextNode.status = "done"; nextNode.progress = 100; nextNode.completedAt = new Date(); }
        next.updatedAt = new Date();
        recomputeStatuses(next);
        onDocUpdated(next);
        roadmapStore.setDoc(next);
        if (body.markDone) roadmapStore.emit("ROADMAP_NODE_COMPLETED", `Completed "${node.title}"`, node.id);
        else if (body.toggleTask) roadmapStore.emit("TASK_MARKED_DONE", `Updated checklist on "${node.title}"`, node.id);
        return true;
      }
      const r = await fetch(`/api/roadmap/v2/node/${node.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      if (r.ok) {
        const d = await r.json();
        if (d.doc) onDocUpdated(d.doc as RoadmapDoc, d.adaptation ?? null);
        if (d.adaptation) setAdaptMsg(d.adaptation as string);
        // Feed the shared event stream so the Strategist sees what happened.
        if (body.markDone) roadmapStore.emit("ROADMAP_NODE_COMPLETED", `Completed "${node.title}"`, node.id);
        else if (body.toggleTask) roadmapStore.emit("TASK_MARKED_DONE", `Updated checklist on "${node.title}" (${node.progress}%)`, node.id);
        else if (body.score) {
          const s = body.score as { key: string; value: number };
          roadmapStore.emit("SCORE_SUBMITTED", `Score logged on "${node.title}": ${s.key} = ${s.value}${d.adaptation ? ` → ${d.adaptation}` : ""}`, node.id);
        }
        return true;
      }
      return false;
    } finally {
      setBusy(null);
    }
  }

  function askStrategist() {
    const draft = `Help me with my roadmap mission "${node.title}" (${branch.category}, ${phase}). The completion criteria is: ${node.completionCriteria}. My progress is ${node.progress}%. `;
    roadmapStore.selectNode(node.id, { silent: true });
    if (pathname === "/strategist") {
      try { localStorage.setItem("polaris.strategist.draft", draft); } catch { /* ignore */ }
      router.refresh();
    } else {
      // Focus the Strategist rail in place - no navigation. Below xl this
      // opens the overlay; on desktop the rail is already visible and just
      // picks up the focused-node context card.
      window.dispatchEvent(new CustomEvent("polaris:openAgentRail", { detail: { draft } }));
    }
    onClose();
  }

  async function saveScore() {
    if (!scoreKey) return;
    const v = parseFloat(scoreVal);
    if (!Number.isFinite(v)) return;
    const ok = await patch({ score: { key: scoreKey, value: v } }, "score");
    if (ok) { setScoreVal(""); setScoreKey(null); }
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.18 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/45 backdrop-blur-sm p-4 sm:p-8"
      role="dialog"
      aria-modal="true"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.94, y: 16, opacity: 0 }}
        animate={{ scale: 1, y: 0, opacity: 1 }}
        exit={{ scale: 0.94, y: 16, opacity: 0 }}
        transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-[640px] max-h-[88vh] overflow-y-auto overscroll-contain rounded-3xl bg-paper-card shadow-pop ring-1 ring-inset ring-polaris-500/10 dark:ring-white/[0.12]"
      >
        {/* Header */}
        <div className="sticky top-0 z-10 bg-paper-card/85 backdrop-blur-md px-6 pt-5 pb-4 border-b border-polaris-500/10 dark:border-white/[0.08]">
          <div className="flex items-start gap-3">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5 flex-wrap mb-1.5">
                <Chip>{branch.category}</Chip>
                <Chip>{TYPE_LABEL[node.type]}</Chip>
                <Chip>{phase}</Chip>
                <Chip tone={node.priority === "high" ? "rose" : "ink"}>{node.priority} priority</Chip>
                <span className="text-[10.5px] font-mono text-ink-muted" title={`Difficulty ${node.difficulty}/5`}>
                  {"●".repeat(node.difficulty)}{"○".repeat(5 - node.difficulty)}
                </span>
              </div>
              <h2 className="font-serif text-[22px] leading-tight font-bold tracking-tight text-ink">{node.title}</h2>
              <div className="mt-1 flex items-center gap-3 text-[11px] font-mono text-ink-muted">
                <span>~{node.estimatedHoursPerWeek}h/week</span>
                <span>·</span>
                <span className="inline-flex items-center gap-1">
                  <span className={cn("h-1.5 w-1.5 rounded-full", node.status === "done" ? "bg-aurora-500" : node.status === "current" ? "bg-polaris-500 animate-pulse" : node.status === "locked" ? "bg-ink-faint" : "bg-nova-500")} />
                  {node.status}
                </span>
                <span>·</span>
                <span>{node.progress}% done</span>
              </div>
            </div>
            <button onClick={onClose} aria-label="Close" className="text-ink-muted hover:text-ink p-1.5 rounded-lg hover:bg-paper-soft transition-colors">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>
            </button>
          </div>
          {/* progress bar */}
          <div className="mt-3 h-1.5 rounded-full bg-paper-deep overflow-hidden">
            <div className={cn("h-full rounded-full transition-all duration-500 bg-gradient-to-r", node.status === "done" ? "from-aurora-400 to-aurora-600" : "from-polaris-400 via-nova-400 to-aurora-400")} style={{ width: `${node.progress}%` }} />
          </div>
        </div>

        <div className="px-6 py-5 space-y-6">
          {locked && (
            <div className="rounded-xl bg-paper-soft ring-1 ring-inset ring-polaris-500/10 dark:ring-white/10 px-4 py-3 text-[12.5px] text-ink-dim flex items-center gap-2.5">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="text-ink-muted shrink-0"><rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></svg>
              This mission unlocks after the earlier ones in <strong className="text-ink">{branch.title}</strong>. You can preview it now.
            </div>
          )}

          {adaptMsg && (
            <div className="rounded-xl bg-polaris-100/60 dark:bg-polaris-400/10 ring-1 ring-inset ring-polaris-400/40 px-4 py-3 text-[12.5px] text-ink">
              <strong className="text-polaris-700 dark:text-polaris-200">Roadmap adapted:</strong> {adaptMsg}
            </div>
          )}

          {/* ─── Mission brief ─── */}
          <section>
            <Label>Mission brief</Label>
            <p className="text-[13.5px] text-ink leading-relaxed">{node.description}</p>
            <div className="mt-3 grid sm:grid-cols-2 gap-3">
              <div className="rounded-xl bg-paper-soft p-3.5">
                <div className="text-[10px] uppercase tracking-wider font-bold text-nova-600 dark:text-nova-200 mb-1">Why it matters</div>
                <p className="text-[12.5px] text-ink leading-relaxed">{node.why}</p>
              </div>
              <div className="rounded-xl bg-paper-soft p-3.5">
                <div className="text-[10px] uppercase tracking-wider font-bold text-polaris-600 dark:text-polaris-300 mb-1">How to do it</div>
                <p className="text-[12.5px] text-ink leading-relaxed">{node.how}</p>
              </div>
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-2 text-[11.5px]">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-aurora-100 dark:bg-aurora-400/15 text-aurora-700 dark:text-aurora-100 ring-1 ring-inset ring-aurora-400/40 px-2.5 py-1 font-medium">
                ✓ Done when: {node.completionCriteria}
              </span>
              <span className="inline-flex items-center rounded-full bg-paper-soft px-2.5 py-1 font-medium text-ink-dim ring-1 ring-inset ring-polaris-500/10 dark:ring-white/10">
                {node.impact}
              </span>
            </div>
          </section>

          {/* ─── Strategist tip (context-derived, instant) ─── */}
          {tip && (
            <section className="relative rounded-xl p-[1.5px] overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-r from-polaris-400/60 via-nova-400/50 to-aurora-400/60" />
              <div className="relative rounded-[10.5px] bg-paper-card px-4 py-3">
                <div className="flex items-center gap-2 mb-1">
                  <span className="h-5 w-5 rounded-full bg-gradient-to-br from-polaris-500 to-nova-500 text-white inline-flex items-center justify-center text-[9px]">✦</span>
                  <span className="text-[10.5px] uppercase tracking-wider font-bold text-polaris-600 dark:text-polaris-300">Strategist tip</span>
                </div>
                <p className="text-[12.5px] text-ink leading-relaxed">{tip}</p>
              </div>
            </section>
          )}

          {/* ─── Checklist ─── */}
          <section>
            <Label>Task checklist</Label>
            <ul className="space-y-1.5">
              {node.tasks.map((t) => (
                <li key={t.id}>
                  <button
                    onClick={() => void patch({ toggleTask: t.id }, `task-${t.id}`)}
                    disabled={busy !== null || locked}
                    className={cn(
                      "w-full flex items-start gap-2.5 rounded-xl px-3 py-2.5 text-left transition-colors ring-1 ring-inset",
                      t.done
                        ? "bg-aurora-100/50 dark:bg-aurora-400/10 ring-aurora-400/30"
                        : "bg-paper-card ring-polaris-500/10 dark:ring-white/10 hover:ring-polaris-400/40",
                      locked && "opacity-60 cursor-not-allowed",
                    )}
                  >
                    <span className={cn(
                      "mt-0.5 h-[18px] w-[18px] shrink-0 rounded-md ring-1 ring-inset flex items-center justify-center transition-colors",
                      t.done ? "bg-aurora-500 ring-aurora-500 text-white" : "ring-ink-faint bg-paper-card",
                    )}>
                      {busy === `task-${t.id}` ? (
                        <span className="h-2 w-2 rounded-full border border-current border-t-transparent animate-spin" />
                      ) : t.done ? (
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5"/></svg>
                      ) : null}
                    </span>
                    <span className={cn("text-[13px] leading-snug", t.done ? "text-ink-muted line-through" : "text-ink")}>{t.text}</span>
                  </button>
                </li>
              ))}
            </ul>
          </section>

          {/* ─── Resource pack ─── */}
          {node.resources.length > 0 && (
            <section>
              <Label>Resource pack</Label>
              <div className="space-y-2">
                {node.resources.map((r) => (
                  <ResourceRow key={r.ref} r={r} />
                ))}
              </div>
            </section>
          )}

          {/* ─── Score input ─── */}
          {node.scoreInputs.length > 0 && (
            <section>
              <Label>Log a score</Label>
              <p className="text-[11.5px] text-ink-muted mb-2">
                Took a test or mock for this mission? Log it - the roadmap re-prioritizes automatically and the Strategist sees it.
              </p>
              <div className="flex flex-wrap items-end gap-2">
                <div className="flex flex-wrap gap-1.5">
                  {node.scoreInputs.map((s) => (
                    <button
                      key={s.key}
                      onClick={() => setScoreKey(scoreKey === s.key ? null : s.key)}
                      className={cn(
                        "rounded-full px-3 py-1.5 text-[12px] font-medium ring-1 ring-inset transition-colors",
                        scoreKey === s.key
                          ? "bg-ink text-paper ring-ink"
                          : "bg-paper-card text-ink-dim ring-polaris-200 hover:ring-polaris-300 dark:ring-white/[0.15]",
                      )}
                    >
                      {s.label}
                    </button>
                  ))}
                </div>
                {scoreKey && (
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      value={scoreVal}
                      onChange={(e) => setScoreVal(e.target.value)}
                      placeholder={(() => { const d = node.scoreInputs.find((s) => s.key === scoreKey); return d ? `${d.min}–${d.max}` : ""; })()}
                      step={node.scoreInputs.find((s) => s.key === scoreKey)?.step ?? 1}
                      className="w-28 rounded-xl border border-polaris-200 bg-paper-card px-3 py-2 text-sm text-ink focus:border-polaris-400 focus:outline-none dark:border-white/[0.14] dark:bg-paper-deep"
                    />
                    <button
                      onClick={() => void saveScore()}
                      disabled={busy !== null || !scoreVal}
                      className="rounded-xl bg-ink text-paper px-3.5 py-2 text-[12px] font-semibold hover:bg-polaris-700 transition-colors disabled:opacity-40"
                    >
                      {busy === "score" ? "…" : "Save"}
                    </button>
                  </div>
                )}
              </div>
              {/* recent scores for this node */}
              {doc.scores.filter((s) => s.nodeId === node.id).slice(-3).map((s, i) => (
                <div key={i} className="mt-2 text-[11.5px] font-mono text-ink-muted">
                  {s.label}: <span className="text-ink font-semibold">{s.value}</span>/{s.max} · {new Date(s.at).toLocaleDateString()}
                </div>
              ))}
            </section>
          )}

          {/* ─── Notes ─── */}
          <section>
            <Label>Notes</Label>
            {node.notes.length > 0 && (
              <ul className="space-y-1.5 mb-2">
                {node.notes.map((n) => (
                  <li key={n.id} className="rounded-xl bg-paper-soft px-3 py-2 text-[12.5px] text-ink leading-relaxed">
                    <span className="block text-[10px] font-mono text-ink-muted mb-0.5">{new Date(n.at).toLocaleString()}</span>
                    {n.text}
                  </li>
                ))}
              </ul>
            )}
            <div className="flex items-end gap-2">
              <textarea
                value={noteDraft}
                onChange={(e) => setNoteDraft(e.target.value)}
                rows={2}
                maxLength={2000}
                placeholder="Log progress, blockers, results…"
                onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) { e.preventDefault(); if (noteDraft.trim()) void patch({ note: noteDraft.trim() }, "note").then((ok) => ok && setNoteDraft("")); } }}
                className="flex-1 rounded-xl border border-polaris-200 bg-paper-card px-3 py-2 text-[12.5px] text-ink placeholder:text-ink-muted/60 focus:border-polaris-400 focus:outline-none resize-none dark:border-white/[0.14] dark:bg-paper-deep"
              />
              <button
                onClick={() => { if (noteDraft.trim()) void patch({ note: noteDraft.trim() }, "note").then((ok) => ok && setNoteDraft("")); }}
                disabled={busy !== null || !noteDraft.trim()}
                className="rounded-xl bg-ink text-paper h-9 px-3.5 text-[12px] font-semibold hover:bg-polaris-700 transition-colors disabled:opacity-40"
              >
                {busy === "note" ? "…" : "Add"}
              </button>
            </div>
          </section>
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 bg-paper-card/85 backdrop-blur-md px-6 py-4 border-t border-polaris-500/10 dark:border-white/[0.08] flex items-center gap-2">
          {node.status !== "done" ? (
            <button
              onClick={() => void patch({ markDone: true }, "done")}
              disabled={busy !== null || locked}
              className="inline-flex items-center gap-1.5 rounded-full bg-aurora-600 text-white px-4 py-2 text-[12.5px] font-semibold hover:bg-aurora-700 transition-colors disabled:opacity-40"
            >
              {busy === "done" ? "Completing…" : "✓ Mark mission done"}
            </button>
          ) : (
            <span className="inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-aurora-700 dark:text-aurora-200">
              ✓ Completed {node.completedAt ? new Date(node.completedAt).toLocaleDateString() : ""}
            </span>
          )}
          <button
            onClick={askStrategist}
            className="text-[12.5px] text-polaris-600 dark:text-polaris-300 hover:underline font-medium"
          >
            Ask Strategist →
          </button>
          {nextUp && (
            <span className="ml-auto text-[11px] text-ink-muted truncate max-w-[200px]" title={nextUp.title}>
              Next unlock: <span className="text-ink font-medium">{nextUp.title}</span>
            </span>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return <div className="text-[10.5px] uppercase tracking-[0.22em] text-ink-muted font-medium mb-2">{children}</div>;
}

function Chip({ children, tone = "ink" }: { children: React.ReactNode; tone?: "ink" | "rose" }) {
  return (
    <span className={cn(
      "text-[10px] uppercase tracking-wider font-bold rounded-full px-2 py-0.5 ring-1 ring-inset",
      tone === "rose"
        ? "text-rose-600 dark:text-rose-200 bg-rose-50 dark:bg-rose-400/15 ring-rose-200 dark:ring-rose-400/30"
        : "text-ink-dim bg-paper-soft ring-polaris-500/10 dark:ring-white/10",
    )}>
      {children}
    </span>
  );
}

function ResourceRow({ r }: { r: { kind: string; title: string; ref: string; note?: string } }) {
  const [playing, setPlaying] = useState(false);
  const embeddable = r.kind === "youtube" && isYouTubeId(r.ref);
  const logOpen = () => roadmapStore.emit("RESOURCE_OPENED", `Opened resource "${r.title}"`);

  if (embeddable && playing) {
    return (
      <div className="rounded-xl overflow-hidden ring-1 ring-inset ring-polaris-500/15 dark:ring-white/10">
        <div className="aspect-video">
          <iframe
            src={`https://www.youtube.com/embed/${r.ref}?autoplay=1`}
            title={r.title}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            className="h-full w-full"
          />
        </div>
        <div className="px-3 py-2 bg-paper-soft text-[11.5px] text-ink-dim flex items-center justify-between">
          <span className="truncate">{r.title}</span>
          <button onClick={() => setPlaying(false)} className="text-ink-muted hover:text-ink ml-2 shrink-0">close player</button>
        </div>
      </div>
    );
  }

  const icon =
    r.kind === "youtube" ? "▶" :
    r.kind === "pdf" ? "⤓" :
    r.kind === "book" ? "❐" :
    r.kind === "practice" ? "✎" : "↗";

  const inner = (
    <>
      <span className={cn(
        "h-8 w-8 shrink-0 rounded-lg flex items-center justify-center text-[13px] font-bold",
        r.kind === "youtube" ? "bg-rose-50 text-rose-600 dark:bg-rose-400/15 dark:text-rose-200" :
        r.kind === "practice" ? "bg-polaris-100 text-polaris-700 dark:bg-polaris-400/20 dark:text-polaris-100" :
        "bg-paper-soft text-ink-dim",
      )}>
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[12.5px] font-medium text-ink truncate">{r.title}</span>
        {r.note && <span className="block text-[11px] text-ink-muted truncate">{r.note}</span>}
      </span>
      <span className="text-[10px] uppercase tracking-wider font-bold text-ink-muted shrink-0">{embeddable ? "play" : r.kind}</span>
    </>
  );

  const cls = "w-full flex items-center gap-3 rounded-xl px-3 py-2.5 ring-1 ring-inset ring-polaris-500/10 dark:ring-white/10 bg-paper-card hover:ring-polaris-400/40 transition-all text-left";

  return embeddable ? (
    <button onClick={() => { logOpen(); setPlaying(true); }} className={cls}>{inner}</button>
  ) : (
    <a href={r.ref} target="_blank" rel="noopener noreferrer" onClick={logOpen} className={cls}>{inner}</a>
  );
}
