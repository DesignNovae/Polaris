import { ok, withErrorHandling, parseJson } from "@/lib/api/respond";
import { requireSession } from "@/lib/authz";
import { studentProfileSchema } from "@/lib/validation/schemas";
import { upsertProfile, getProfile, getRoadmapV2, saveRoadmapV2 } from "@/lib/db/collections";
import { refreshPlanningAfterStateChange } from "@/lib/roadmap/planning";

export const dynamic = "force-dynamic";

export const GET = withErrorHandling(async () => {
  const user = await requireSession();
  const profile = await getProfile(user.id);
  return ok({ profile });
});

export const POST = withErrorHandling(async (req) => {
  const user = await requireSession();
  const body = (await parseJson(req)) as { profile?: unknown };
  const profile = studentProfileSchema.parse(body.profile);
  await upsertProfile(user.id, profile);
  const roadmap = await getRoadmapV2(user.id);
  if (roadmap?.planning) {
    const refreshed = await refreshPlanningAfterStateChange(roadmap.planning, profile, roadmap.config, [], { userId: user.id });
    roadmap.planning = refreshed.state;
    roadmap.updatedAt = new Date();
    await saveRoadmapV2(user.id, roadmap);
  }
  return ok({ ok: true });
});
