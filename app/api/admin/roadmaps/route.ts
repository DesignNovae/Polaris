import { ok, withErrorHandling, parseJson, HttpError } from "@/lib/api/respond";
import { requireRole } from "@/lib/authz";
import { listRoadmaps, deleteRoadmap } from "@/lib/db/collections";

export const dynamic = "force-dynamic";

export const GET = withErrorHandling(async () => {
  await requireRole("admin");
  const roadmaps = await listRoadmaps();
  return ok({ roadmaps });
});

export const DELETE = withErrorHandling(async (req) => {
  await requireRole("admin");
  const { roadmapId } = (await parseJson(req)) as { roadmapId?: string };
  if (!roadmapId) throw new HttpError(400, "Missing roadmapId");
  await deleteRoadmap(roadmapId);
  return ok({ ok: true });
});

