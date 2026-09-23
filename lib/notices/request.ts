import { HttpError } from "@/lib/api/respond";

export function requireSameOrigin(req: Request) {
  const origin = req.headers.get("origin");
  if (
    (origin && origin !== new URL(req.url).origin) ||
    req.headers.get("sec-fetch-site") === "cross-site"
  )
    throw new HttpError(403, "Cross-site changes are not allowed");
}
export async function noticeJson(req: Request) {
  requireSameOrigin(req);
  const text = new TextDecoder().decode(await readLimitedBody(req, 64000));
  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new HttpError(400, "Invalid JSON body");
  }
}

export async function readLimitedBody(req: Request, limit: number) {
  if (Number(req.headers.get("content-length") || 0) > limit)
    throw new HttpError(413, "Upload is too large");
  const reader = req.body?.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  if (reader)
    try {
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        size += value.byteLength;
        if (size > limit) {
          await reader.cancel();
          throw new HttpError(413, "Upload is too large");
        }
        chunks.push(value);
      }
    } finally {
      reader.releaseLock();
    }
  return Buffer.concat(chunks);
}
