/**
 * Client-side presentation for Strategist tool events.
 *
 * Both chat surfaces consume the same SSE stream, so the labels and the
 * post-mutation refresh live here rather than being duplicated in each.
 */

import { roadmapStore } from "@/lib/roadmap/store";
import type { RoadmapDoc } from "@/lib/roadmap/types";

/** Status line shown while a tool runs. Unlisted tools fall back to a generic line. */
const RUNNING_LABELS: Record<string, string> = {
  search_kb: "Searching the knowledge base…",
  read_milestone: "Reading a milestone…",
  compute_probability: "Running the admission model…",
  get_exam_performance: "Reviewing your exam results…",
  get_plan: "Reading your plan…",
  update_weekly_task: "Updating a weekly task…",
  update_roadmap_node: "Updating your roadmap…",
};

/** Status line shown once a tool returns. */
const DONE_LABELS: Record<string, string> = {
  search_kb: "Read the passages it found…",
  read_milestone: "Read the milestone…",
  compute_probability: "Model returned a probability…",
  get_exam_performance: "Read your exam results…",
  get_plan: "Read your plan…",
  update_weekly_task: "Weekly task updated…",
  update_roadmap_node: "Roadmap updated…",
};

/** Tools whose names the Strategist may call; used to label unknown events safely. */
export function toolRunningLabel(name: string): string {
  return RUNNING_LABELS[name] ?? "Working…";
}

export function toolDoneLabel(name: string): string {
  return DONE_LABELS[name] ?? "Done…";
}

/** True when this tool event changed stored plan state. */
export function isPlanMutation(name: string): boolean {
  return name === "update_weekly_task" || name === "update_roadmap_node";
}

/**
 * Pulls the roadmap back from the server after the Strategist changed it, so
 * the tree and the chat cannot disagree about what the plan now says.
 *
 * Failures are swallowed: a stale tree is recoverable by navigating, whereas a
 * thrown error mid-stream would break the reply the student is reading.
 */
export async function refreshRoadmapAfterMutation(reason: string): Promise<void> {
  try {
    const response = await fetch("/api/roadmap/v2", { cache: "no-store" });
    if (!response.ok) return;
    const body = (await response.json()) as { doc?: RoadmapDoc | null };
    if (body.doc) {
      roadmapStore.setDoc(body.doc);
      roadmapStore.emit("STRATEGIST_RECOMMENDATION_APPLIED", reason.slice(0, 120));
    }
  } catch {
    // Non-fatal - the next navigation reloads the roadmap anyway.
  }
}
