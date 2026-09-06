import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { readFile, realpath, stat } from "node:fs/promises";
import path from "node:path";
import { Readable } from "node:stream";
import { HttpError } from "@/lib/api/respond";
import { parseVideoRange, signingManifestSchema, type SigningAsset } from "./manifest";

export function signingDirectory() {
  return path.resolve(process.env.POLARIS_SIGNING_ASSETS_DIR || path.join(process.cwd(), "assets", "signing"));
}

export async function findSigningAsset(mediaId: string, language: string): Promise<SigningAsset | null> {
  const file = process.env.POLARIS_SIGNING_MANIFEST || path.join(process.cwd(), "data", "interpreter", "signing-manifest.json");
  const manifest = signingManifestSchema.parse(JSON.parse(await readFile(file, "utf8")));
  const asset = manifest.tracks.find((entry) => entry.mediaId === mediaId && entry.language === language) ?? null;
  if (asset?.scope === "exam") {
    const part = asset.mediaId.split(":")[1];
    const source = await readFile(path.join(process.cwd(), "assets", "exams", "ielts-listening", `${part}.wav`));
    if (createHash("sha256").update(source).digest("hex") !== asset.sourceHash) {
      throw new HttpError(409, "The recording changed. Its signing track needs to be regenerated.");
    }
  }
  return asset;
}

export async function signingAssetPath(asset: SigningAsset): Promise<string> {
  try {
    const root = await realpath(signingDirectory());
    const target = await realpath(path.join(root, `${asset.id}.mp4`));
    const relative = path.relative(root, target);
    if (relative.startsWith("..") || path.isAbsolute(relative)) throw new HttpError(503, "The signing track is unavailable.");
    return target;
  } catch {
    throw new HttpError(503, "The signing track is unavailable. Prepare its animation before playback.");
  }
}

export async function signingVideoResponse(asset: SigningAsset, rangeHeader: string | null): Promise<Response> {
  const file = await signingAssetPath(asset);
  const { size } = await stat(file);
  const range = parseVideoRange(rangeHeader, size);
  const headers = new Headers({
    "Content-Type": "video/mp4", "Cache-Control": "private, no-store",
    "Accept-Ranges": "bytes", "X-Content-Type-Options": "nosniff",
  });
  if (range === "invalid") {
    headers.set("Content-Range", `bytes */${size}`);
    return new Response(null, { status: 416, headers });
  }
  if (range) headers.set("Content-Range", `bytes ${range.start}-${range.end}/${size}`);
  headers.set("Content-Length", String(range ? range.end - range.start + 1 : size));
  const stream = createReadStream(file, range || undefined);
  return new Response(Readable.toWeb(stream) as ReadableStream<Uint8Array>, { status: range ? 206 : 200, headers });
}
