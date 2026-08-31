/**
 * PATCH /api/roadmap/v2/node/[id]
 *
 * Mutate one node of the live roadmap:
 *   { toggleTask?: taskId }        - flip a checklist item (progress derives)
 *   { note?: string }              - append a note
 *   { markDone?: true }            - complete the node (unlocks the next)
 *   { score?: { key, value } }     - record a test score; rule-based
 *                                    adaptation runs immediately and is
 *                                    visible to the Strategist on its next
 *                                    message (shared doc).
 *
 * Returns the FULL updated doc - the tree and the Strategist read the same
 * state, so the client swaps it in wholesale.
 */

import { z } from "zod";
import { ok, fail, withErrorHandling, parseJson } from "@/lib/api/respond";
import { requireSession } from "@/lib/authz";
import { getProfile, getRoadmapV2, saveRoadmapV2 } from "@/lib/db/collections";
import { nodeProgressFromTasks, recomputeStatuses, shortId, type ScoreEntry } from "@/lib/roadmap/types";
import { applyScoreAdaptation } from "@/lib/roadmap/generate";
import { SCORE_DEFS } from "@/lib/roadmap/templates";
import type { MissionEvidence, StudentEvidence } from "@/lib/roadmap/planning-types";
import { refreshPlanningAfterStateChange } from "@/lib/roadmap/planning";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const patchSchema = z.object({
  toggleTask: z.string().max(20).optional(),
  note: z.string().min(1).max(2000).optional(),
  markDone: z.literal(true).optional(),
  score: z.object({
    key: z.string().max(40),
    value: z.number(),
  }).optional(),
  evidence: z.object({
    label: z.string().min(1).max(180),
    kind: z.enum(["academic", "test", "project", "research", "activity", "award", "document", "integration"]),
    ref: z.string().max(500).optional(),
    note: z.string().max(500).optional(),
    verified: z.boolean().optional(),
  }).optional(),
}).refine(
  (v) => v.toggleTask || v.note || v.markDone || v.score || v.evidence,
  { message: "At least one mutation must be provided" },
);

export const PATCH = withErrorHandling(async (req, ctx: { params: Promise<{ id: string }> }) => {
  const session = await requireSession();
  const { id } = await ctx.params;
  const body = patchSchema.parse(await parseJson(req));

  const doc = await getRoadmapV2(session.id);
  if (!doc) return fail(404, "No roadmap yet");

  const node = doc.branches.flatMap((b) => b.nodes).find((n) => n.id === id);
  if (!node) return fail(404, "Node not found");

  let adaptation: string | null = null;
  let planningAdditions: StudentEvidence[] = [];

  if (body.toggleTask) {
    const task = node.tasks.find((t) => t.id === body.toggleTask);
    if (!task) return fail(404, "Task not found");
    task.done = !task.done;
    node.progress = nodeProgressFromTasks(node.tasks);
    if (node.progress === 100) {
      node.status = "done";
      node.completedAt = node.completedAt ?? new Date();
    } else if (node.status === "done") {
      node.status = "current";
      node.completedAt = undefined;
    }
  }

  if (body.note) {
    node.notes.push({ id: shortId(), text: body.note, at: new Date() });
  }

  if (body.evidence) {
    const evidence: MissionEvidence = {
      id: shortId(),
      label: body.evidence.label,
      kind: body.evidence.kind,
      ...(body.evidence.ref ? { ref: body.evidence.ref } : {}),
      ...(body.evidence.note ? { note: body.evidence.note } : {}),
      verified: body.evidence.verified ?? false,
      at: new Date(),
    };
    node.evidence = [...(node.evidence ?? []), evidence];
  }

  if (body.markDone) {
    node.status = "done";
    node.progress = 100;
    node.completedAt = new Date();
    for (const t of node.tasks) t.done = true;
  }

  if (body.score) {
    const def = SCORE_DEFS[body.score.key];
    if (!def) return fail(400, "Unknown score key");
    const value = Math.max(def.min, Math.min(def.max, body.score.value));
    const entry: ScoreEntry = {
      key: body.score.key,
      label: def.label,
      value,
      max: def.max,
      nodeId: node.id,
      at: new Date(),
    };
    doc.scores.push(entry);
    adaptation = applyScoreAdaptation(doc, entry);
    planningAdditions.push({
      id: "score-evidence-" + shortId(),
      claim: `${def.label}: ${value}`,
      type: def.label.toLowerCase().includes("gpa") ? "academic" : "test",
      value,
      strength: 0.9,
      verified: true,
      source: "user",
      sourceRef: body.score.key,
    });
  }

  if (body.evidence) {
    planningAdditions.push({
      id: "mission-evidence-" + shortId(),
      claim: body.evidence.label,
      type: body.evidence.kind,
      value: body.evidence.ref,
      strength: body.evidence.verified ? 1 : 0.7,
      verified: body.evidence.verified ?? false,
      source: "user",
      sourceRef: body.evidence.ref,
    });
  }

  doc.updatedAt = new Date();
  if (doc.planning && planningAdditions.length) {
    const profile = await getProfile(session.id);
    if (profile) {
      const refreshed = await refreshPlanningAfterStateChange(doc.planning, profile, doc.config, planningAdditions, { userId: session.id });
      doc.planning = refreshed.state;
      if (refreshed.strategyChanged) adaptation = adaptation ?? "The planning strategy was refreshed from your new evidence.";
    }
  }
  recomputeStatuses(doc);
  await saveRoadmapV2(session.id, doc);
  return ok({ doc, adaptation, meaningfulEvent: Boolean(body.evidence || body.score || body.markDone) });
});
