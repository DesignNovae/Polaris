import { Binary, ObjectId } from "mongodb";
import { ok, HttpError, withErrorHandling } from "@/lib/api/respond";
import { requireRole } from "@/lib/authz";
import { getDb } from "@/lib/db/mongodb";
import {
  normaliseNoticeImage,
  MAX_NOTICE_IMAGE_BYTES,
} from "@/lib/notices/media";
import { readLimitedBody, requireSameOrigin } from "@/lib/notices/request";

export const runtime = "nodejs";
export const POST = withErrorHandling(async (req) => {
  const user = await requireRole("admin");
  requireSameOrigin(req);
  const bytes = await readLimitedBody(req, MAX_NOTICE_IMAGE_BYTES + 65536);
  let form: FormData;
  try {
    form = await new Response(new Uint8Array(bytes), {
      headers: { "content-type": req.headers.get("content-type") ?? "" },
    }).formData();
  } catch {
    throw new HttpError(400, "Choose an image to upload");
  }
  const file = form.get("file");
  if (!(file instanceof File))
    throw new HttpError(400, "Choose an image to upload");
  const image = await normaliseNoticeImage(
    Buffer.from(await file.arrayBuffer()),
  );
  const db = await getDb();
  const _id = new ObjectId();
  await db
    .collection("notice_media")
    .insertOne({
      _id,
      ownerId: user.id,
      data: new Binary(image),
      contentType: "image/webp",
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + 86400000),
    });
  return ok({ url: `/api/notices/media/${_id.toHexString()}` }, 201);
});
