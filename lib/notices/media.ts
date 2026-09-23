import sharp from "sharp";
import { HttpError } from "@/lib/api/respond";

export const MAX_NOTICE_IMAGE_BYTES = 2 * 1024 * 1024;
export async function normaliseNoticeImage(bytes: Buffer) {
  if (!bytes.length || bytes.length > MAX_NOTICE_IMAGE_BYTES)
    throw new HttpError(413, "Choose an image smaller than 2 MB");
  try {
    const image = sharp(bytes, { limitInputPixels: 16000000, animated: false });
    const meta = await image.metadata();
    if (
      !["jpeg", "png", "webp"].includes(meta.format ?? "") ||
      (meta.pages ?? 1) > 1
    )
      throw new Error("format");
    // Re-encode, auto-orient and strip EXIF/GPS metadata before storing.
    const result = await image
      .rotate()
      .resize({
        width: 1600,
        height: 1600,
        fit: "inside",
        withoutEnlargement: true,
      })
      .webp({ quality: 85 })
      .toBuffer();
    if (result.length > MAX_NOTICE_IMAGE_BYTES) throw new Error("size");
    return result;
  } catch {
    throw new HttpError(
      400,
      "Choose a valid, still PNG, JPEG or WebP image up to 16 megapixels",
    );
  }
}
