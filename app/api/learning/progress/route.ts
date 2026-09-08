import { requireSession } from "@/lib/authz";
import { recordProgress } from "@/lib/progress/record";
import { getDb } from "@/lib/db/mongodb";
import { HttpError, parseJson, withErrorHandling } from "@/lib/api/respond";
import { LEARNING_LIBRARY } from "@/lib/learning/catalog";
import { progressPatchSchema, type VideoProgress } from "@/lib/learning/library";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "private, no-store" };
type Record = VideoProgress & { _id: string; userId: string; videoId: string };
export const GET = withErrorHandling(async () => {
  const user = await requireSession();
  const db = await getDb();
  const rows = await db.collection<Record>("learning_progress").find({ userId: user.id }).limit(500).toArray();
  return Response.json({ progress: Object.fromEntries(rows.map(({ videoId, saved, completed, position, duration, updatedAt }) =>
    [videoId, { saved, completed, position, duration, updatedAt }])) }, { headers });
});
export const PATCH = withErrorHandling(async (request) => {
  const user = await requireSession();
  const { videoId, ...patch } = progressPatchSchema.parse(await parseJson(request));
  if (!LEARNING_LIBRARY.some((v) => v.id === videoId)) throw new HttpError(404, "This lesson is not in the library.");
  const db = await getDb();
  // The account-scoped primary key prevents duplicate records and cross-account writes.
  const updatedAt = new Date().toISOString();
  await db.collection<Record>("learning_progress").updateOne({ _id: `${user.id}:${videoId}`, userId: user.id },
    { $set: { ...patch, updatedAt }, $setOnInsert: { userId: user.id, videoId } }, { upsert: true });
  // Watching earns; finishing earns more. Saving a lesson for later is not
  // work, so it is not counted.
  if (patch.completed === true) await recordProgress(user.id, "lesson-complete");
  else if (typeof patch.position === "number") await recordProgress(user.id, "lesson-progress");
  return Response.json({ ok: true, updatedAt }, { headers });
});
