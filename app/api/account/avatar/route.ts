/**
 * /api/account/avatar
 *   POST   - { dataUrl } image/jpeg|png|webp data URL, ≤ ~400KB after the
 *            client's 256px canvas downscale. Stored on the user record.
 *   DELETE - remove the avatar.
 */

import { z } from "zod";
import { ok, withErrorHandling, parseJson, HttpError } from "@/lib/api/respond";
import { requireSession } from "@/lib/authz";
import { updateUser } from "@/lib/db/collections";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_DATA_URL_CHARS = 600_000; // ~440KB binary - far above a 256px webp

const schema = z.object({
  dataUrl: z.string()
    .regex(/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/, "Unsupported image format")
    .max(MAX_DATA_URL_CHARS, "Image too large after processing"),
});

export const POST = withErrorHandling(async (req) => {
  const session = await requireSession();
  const { dataUrl } = schema.parse(await parseJson(req));

  // Sanity-check the decoded payload size as well.
  const b64 = dataUrl.slice(dataUrl.indexOf(",") + 1);
  const bytes = Math.floor((b64.length * 3) / 4);
  if (bytes > 450_000) throw new HttpError(413, "Image too large after processing");

  await updateUser(session.id, { avatarUrl: dataUrl });
  return ok({ avatarUrl: dataUrl });
});

export const DELETE = withErrorHandling(async () => {
  const session = await requireSession();
  await updateUser(session.id, { avatarUrl: "" });
  return ok({ removed: true });
});
