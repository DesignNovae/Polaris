import { NextResponse } from "next/server";
import { z } from "zod";
import { fail, ok, parseJson, withErrorHandling } from "@/lib/api/respond";
import { requireSession } from "@/lib/authz";
import { rateLimit, rateLimitHeaders } from "@/lib/ratelimit";
import { getProfile, getRoadmapV2, saveRoadmapV2 } from "@/lib/db/collections";
import { RoadmapTargetSchema } from "@/lib/roadmap/types";
import { buildPlanningContext } from "@/lib/roadmap/planning";
import { shortId } from "@/lib/roadmap/types";
import { requestLanguage } from "@/lib/i18n/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

const bodySchema = z.object({ targets: RoadmapTargetSchema.array().max(12) });

/**
 * Update only the target portfolio. The existing schedule/tree and completed
 * work remain in place; requirements, gaps, and priorities are recalculated
 * against the new target set.
 */
export const PATCH = withErrorHandling(async (req) => {
  const session = await requireSession();
  const language = requestLanguage(req);
  const rl = await rateLimit(session.id, session.plan, "planning");
  if (!rl.allowed) return NextResponse.json({ error: "Rate limit reached - try again in a few minutes." }, { status: 429, headers: rateLimitHeaders(rl) });

  const body = bodySchema.parse(await parseJson(req));
  const [profile, doc] = await Promise.all([getProfile(session.id), getRoadmapV2(session.id)]);
  if (!profile) return fail(400, "Complete your profile before updating targets.");
  if (!doc) return fail(404, "No roadmap yet");

  const config = { ...doc.config, targets: body.targets };
  const planning = await buildPlanningContext(profile, config, { userId: session.id, language, existingEvidence: doc.planning?.evidence ?? [] });
  const validGapIds = new Set(planning.state.gaps.map((gap) => gap.id));
  const validTargetIds = new Set(planning.state.targets.map((target) => target.id));

  // Keep old nodes and progress, but remove links that no longer resolve to
  // the new structured planning state. Never infer replacement links here.
  for (const node of doc.branches.flatMap((branch) => branch.nodes)) {
    node.gapIds = (node.gapIds ?? []).filter((id) => validGapIds.has(id));
    node.targetIds = (node.targetIds ?? []).filter((id) => validTargetIds.has(id));
    node.strategyDerived = node.gapIds.length > 0 || node.targetIds.length > 0;
  }

  doc.config = config;
  doc.planning = planning.state;
  doc.adaptations.push({ id: shortId(), reason: "Target portfolio changed; requirements, gaps, and priorities were recalculated without regenerating existing missions.", at: new Date() });
  doc.updatedAt = new Date();
  await saveRoadmapV2(session.id, doc);
  return ok({ doc });
});
