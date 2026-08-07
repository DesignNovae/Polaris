"use client";

/**
 * Roadmap ⇄ Strategist shared client store.
 *
 * One module-level external store imported by BOTH client islands - the
 * roadmap page (RoadmapPageClient) and the Strategist rail (AgentChat) -
 * so they read/write the SAME live state regardless of where they mount
 * in the tree:
 *
 *   doc            - the live RoadmapDoc (server is source of truth; every
 *                    fetch/mutation publishes the fresh doc here)
 *   selectedNodeId - the leaf the user is focused on (clicking a node,
 *                    opening its modal, or "Ask Strategist about this node")
 *   events         - recent roadmap events (NODE_SELECTED, SCORE_SUBMITTED,
 *                    TASK_MARKED_DONE, ROADMAP_REBALANCED, RESOURCE_OPENED…)
 *   lastSyncAt     - timestamp of the last doc publish (drives the
 *                    "Synced with Roadmap · updated Xs ago" indicator)
 *
 * Events are mirrored to sessionStorage so the full-page /strategist chat
 * (a separate island) can hand recent context to the API as well.
 */

import { useSyncExternalStore } from "react";
import type { RoadmapDoc, RoadmapNode, RoadmapBranch } from "./types";
import { branchProgress, overallProgress } from "./types";

export type RoadmapEventType =
  | "ROADMAP_NODE_SELECTED"
  | "ROADMAP_NODE_COMPLETED"
  | "TASK_MARKED_DONE"
  | "SCORE_SUBMITTED"
  | "RESOURCE_OPENED"
  | "ROADMAP_REBALANCED"
  | "ROADMAP_GENERATED"
  | "STRATEGIST_RECOMMENDATION_APPLIED"
  | "UNIVERSITY_SHORTLISTED"
  | "UNIVERSITY_VIEWED"
  | "DEADLINES_IMPORTED"
  | "DEADLINE_COMPLETED"
  | "CASE_STUDY_VIEWED"
  | "SCHOLARSHIP_SAVED"
  | "SCHOLARSHIP_DEADLINE_ADDED"
  | "COST_GUIDE_VIEWED"
  | "RESOURCE_ADDED_TO_ROADMAP"
  | "INTEGRATION_CONNECTED"
  | "INTEGRATION_SYNCED"
  | "INTEGRATION_REVOKED"
  | "INTEGRATION_COMING_SOON_REQUESTED"
  | "PARTNER_OFFER_VIEWED"
  | "PARTNER_OFFER_SAVED"
  | "PARTNER_OFFER_CLAIMED"
  | "PARTNER_OFFER_ADDED_TO_ROADMAP"
  | "PARTNER_FREEBIE_OPENED"
  | "PARTNER_COMING_SOON_REQUESTED";

export type RoadmapEvent = {
  id: string;
  type: RoadmapEventType;
  /** Human-readable line, also sent to the Strategist API. */
  label: string;
  nodeId?: string;
  at: number;
};

type StoreState = {
  doc: RoadmapDoc | null;
  selectedNodeId: string | null;
  events: RoadmapEvent[];
  lastSyncAt: number | null;
};

const EVENTS_KEY = "polaris.roadmap.events";
export const DEMO_ROADMAP_KEY = "polaris.demo.roadmap.v1";
const MAX_EVENTS = 20;

let state: StoreState = { doc: null, selectedNodeId: null, events: [], lastSyncAt: null };
const listeners = new Set<() => void>();

function notify() {
  for (const l of listeners) l();
}

function persistEvents() {
  try {
    sessionStorage.setItem(EVENTS_KEY, JSON.stringify(state.events.slice(-MAX_EVENTS)));
  } catch { /* ignore */ }
}

/** Hydrate events from sessionStorage (first subscriber). */
function hydrateEvents() {
  if (state.events.length) return;
  try {
    const raw = sessionStorage.getItem(EVENTS_KEY);
    if (raw) state.events = JSON.parse(raw) as RoadmapEvent[];
  } catch { /* ignore */ }
}

export function loadDemoRoadmap(): RoadmapDoc | null {
  try {
    const raw = localStorage.getItem(DEMO_ROADMAP_KEY);
    if (!raw) return null;
    const doc = JSON.parse(raw) as RoadmapDoc;
    doc.createdAt = new Date(doc.createdAt);
    doc.updatedAt = new Date(doc.updatedAt);
    doc.adaptations = doc.adaptations.map((item) => ({ ...item, at: new Date(item.at) }));
    doc.scores = doc.scores.map((item) => ({ ...item, at: new Date(item.at) }));
    doc.branches = doc.branches.map((branch) => ({
      ...branch,
      nodes: branch.nodes.map((node) => ({
        ...node,
        ...(node.completedAt ? { completedAt: new Date(node.completedAt) } : {}),
        notes: node.notes.map((note) => ({ ...note, at: new Date(note.at) })),
      })),
    }));
    return doc;
  } catch {
    return null;
  }
}

export function saveDemoRoadmap(doc: RoadmapDoc): void {
  try { localStorage.setItem(DEMO_ROADMAP_KEY, JSON.stringify(doc)); } catch { /* ignore */ }
}

export function clearDemoRoadmap(): void {
  try { localStorage.removeItem(DEMO_ROADMAP_KEY); } catch { /* ignore */ }
}

export const roadmapStore = {
  get(): StoreState {
    return state;
  },
  subscribe(cb: () => void): () => void {
    hydrateEvents();
    listeners.add(cb);
    return () => listeners.delete(cb);
  },
  /** Publish a fresh doc (after fetch or any mutation). */
  setDoc(doc: RoadmapDoc | null) {
    state = { ...state, doc, lastSyncAt: Date.now() };
    notify();
  },
  selectNode(nodeId: string | null, opts: { silent?: boolean } = {}) {
    if (state.selectedNodeId === nodeId) return;
    state = { ...state, selectedNodeId: nodeId };
    if (nodeId && !opts.silent) {
      const node = findNode(state.doc, nodeId);
      if (node) {
        roadmapStore.emit("ROADMAP_NODE_SELECTED", `Selected node "${node.title}"`, nodeId);
        return; // emit() already notified
      }
    }
    notify();
  },
  emit(type: RoadmapEventType, label: string, nodeId?: string) {
    const ev: RoadmapEvent = {
      id: Math.random().toString(36).slice(2, 9),
      type,
      label: label.slice(0, 200),
      nodeId,
      at: Date.now(),
    };
    state = { ...state, events: [...state.events.slice(-(MAX_EVENTS - 1)), ev] };
    persistEvents();
    notify();
  },
};

/** React hook - re-renders on any store change. */
export function useRoadmapStrategist(): StoreState {
  return useSyncExternalStore(roadmapStore.subscribe, roadmapStore.get, roadmapStore.get);
}

/* ─── derivation helpers ─── */

export function findNode(doc: RoadmapDoc | null, nodeId: string | null):
  | (RoadmapNode & { branchTitle: string; branchCategory: string })
  | null {
  if (!doc || !nodeId) return null;
  for (const b of doc.branches) {
    const n = b.nodes.find((x) => x.id === nodeId);
    if (n) return { ...n, branchTitle: b.title, branchCategory: b.category };
  }
  return null;
}

/** "Currently growing" node - the highest-priority current mission. */
export function currentFocus(doc: RoadmapDoc | null) {
  if (!doc) return null;
  const currents = doc.branches.flatMap((b) =>
    b.nodes.filter((n) => n.status === "current").map((n) => ({ ...n, branchTitle: b.title, branchCategory: b.category })),
  );
  if (!currents.length) return null;
  const pri = { high: 0, medium: 1, low: 2 };
  currents.sort((a, b) => pri[a.priority] - pri[b.priority] || a.phase - b.phase);
  return currents[0];
}

export type Insight = {
  text: string;
  tone: "warn" | "good" | "info";
  /** When set, the insight is actionable - "Apply to roadmap" runs an adapt with this reason. */
  applyReason?: string;
};

/**
 * One deterministic, roadmap-grounded insight. Priority order:
 * recent weak score → branch imbalance → deadline-ish phase pressure →
 * positive momentum.
 */
export function deriveInsight(s: StoreState): Insight | null {
  const doc = s.doc;
  if (!doc) return null;

  // 1. Most recent weak score (<60% of max).
  const weak = [...doc.scores].reverse().find((sc) => sc.value / sc.max < 0.6);
  if (weak) {
    return {
      text: `Your last ${weak.label} (${weak.value}/${weak.max}) is below target. I'd add focused remediation before advancing.`,
      tone: "warn",
      applyReason: `Recent ${weak.label} was ${weak.value}/${weak.max} - add remedial focus on the matching topics and rebalance the upcoming phases.`,
    };
  }

  // 2. Branch imbalance: strongest vs weakest progress gap > 35 points.
  const progs = doc.branches.map((b) => ({ b, p: branchProgress(b) }));
  if (progs.length >= 2) {
    const sorted = [...progs].sort((a, b) => b.p - a.p);
    const ahead = sorted[0];
    const behind = sorted[sorted.length - 1];
    if (ahead.p - behind.p > 35) {
      return {
        text: `You're ahead in ${ahead.b.category} (${ahead.p}%) but behind in ${behind.b.category} (${behind.p}%). Shift this week's energy toward ${behind.b.title}.`,
        tone: "warn",
        applyReason: `${behind.b.category} is far behind ${ahead.b.category} - rebalance upcoming phases to prioritize "${behind.b.title}".`,
      };
    }
  }

  // 3. Positive momentum.
  const overall = overallProgress(doc);
  if (overall >= 60) {
    return { text: `Strong momentum - ${overall}% of the plan is grown. Keep the current pace and protect your streak.`, tone: "good" };
  }
  const focus = currentFocus(doc);
  if (focus) {
    return { text: `Current focus: "${focus.title}" (${focus.branchCategory}). Done when: ${focus.completionCriteria}`, tone: "info" };
  }
  return null;
}

/** Roadmap-aware quick prompts for the chat - replaces static suggestions. */
export function deriveQuickPrompts(s: StoreState): string[] {
  const doc = s.doc;
  if (!doc) {
    return ["Plan my week", "Why is my probability where it is?", "What am I missing vs. admits?"];
  }
  const node = findNode(doc, s.selectedNodeId);
  if (node) {
    return [
      `Explain "${node.title}" simply`,
      `Give me a 1-hour plan for "${node.title}"`,
      "What should I do first?",
      "Make this task easier",
    ];
  }
  const weakScore = [...doc.scores].reverse().find((sc) => sc.value / sc.max < 0.6);
  if (weakScore) {
    return [
      `Analyze my ${weakScore.label} result`,
      "Add remedial tasks for my weak area",
      "Give me practice resources",
      "Predict my next score target",
    ];
  }
  const level = doc.config.educationLevel;
  if (level === "early-school" || level === "middle-school") {
    return ["Suggest an Olympiad for me", "Make this week fun", "Suggest a beginner project", "Build my reading habit"];
  }
  if (level === "gap-applicant") {
    return ["Review my application timeline", "What deadline is most urgent?", "Improve my essay plan", "Find scholarships for me"];
  }
  const overall = overallProgress(doc);
  if (overall < 25 && doc.branches.some((b) => b.nodes.some((n) => n.status === "done"))) {
    return ["Rebalance my week", "What can I skip?", "Prioritize urgent tasks", "Reduce my workload"];
  }
  return ["Balance academics and test prep", "What's highest-leverage this week?", "Review my progress", "Improve my ECA profile"];
}

/** Compact context payload for the Strategist API. */
export function strategistContextPayload(s: StoreState): {
  selectedNodeId?: string;
  recentEvents?: string[];
} {
  const out: { selectedNodeId?: string; recentEvents?: string[] } = {};
  if (s.selectedNodeId) out.selectedNodeId = s.selectedNodeId;
  const ev = s.events.slice(-8).map((e) => e.label);
  if (ev.length) out.recentEvents = ev;
  return out;
}

/** Read recent event labels straight from sessionStorage (for islands that
 *  mount without the store having hydrated, e.g. full-page /strategist). */
export function recentEventLabels(): string[] {
  try {
    const raw = sessionStorage.getItem(EVENTS_KEY);
    if (!raw) return [];
    return (JSON.parse(raw) as RoadmapEvent[]).slice(-8).map((e) => e.label);
  } catch {
    return [];
  }
}

/* ─── deterministic node tip (modal "Strategist Tip" - no LLM round-trip) ─── */

export function nodeTip(doc: RoadmapDoc | null, node: RoadmapNode | null): string | null {
  if (!doc || !node) return null;
  // Score-aware tip first.
  const related = [...doc.scores].reverse().find((sc) =>
    sc.nodeId === node.id ||
    node.scoreInputs.some((si) => si.key === sc.key),
  );
  if (related && related.value / related.max < 0.6) {
    return `Your last ${related.label} was ${related.value}/${related.max} - work through the resources below before attempting the timed practice, and log a new score when you re-test.`;
  }
  if (related && related.value / related.max >= 0.85) {
    return `Your ${related.label} (${related.value}/${related.max}) is strong - move fast here and bank the extra time for your weaker branches.`;
  }
  if (node.status === "locked") {
    return `This unlocks after the earlier missions in its branch. Skim the resources now so you hit the ground running.`;
  }
  if (node.progress > 0 && node.progress < 100) {
    const left = node.tasks.filter((t) => !t.done).length;
    return `You're ${node.progress}% in with ${left} task${left === 1 ? "" : "s"} left. Finish "${node.tasks.find((t) => !t.done)?.text ?? "the next task"}" next - it's the shortest path to done.`;
  }
  if (node.priority === "high") {
    return `This is a high-priority mission for your ${doc.config.targetGoal} goal. Block ${node.estimatedHoursPerWeek}h this week before anything optional.`;
  }
  return `Start with the first checklist task and aim for: ${node.completionCriteria}`;
}

export type { RoadmapDoc, RoadmapNode, RoadmapBranch };
