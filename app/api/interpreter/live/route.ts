import type { NextRequest } from "next/server";
import { z } from "zod";
import { requireSession } from "@/lib/authz";
import { HttpError, parseJson, withErrorHandling } from "@/lib/api/respond";
import { signingWorker, authorizeSigningExam } from "@/lib/interpreter/model/worker";
import { liveJobSchema } from "@/lib/interpreter/model/live";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;
const headers = { "Cache-Control": "private, no-store" };
const createSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("youtube"), videoId: z.string().regex(/^[\w-]{11}$/), language: z.literal("ase") }).strict(),
  z.object({ kind: z.literal("exam"), sessionId: z.string().regex(/^[a-f\d]{24}$/i), part: z.string().regex(/^part-[1-4]$/), language: z.literal("ase") }).strict(),
]);

export const GET = withErrorHandling(async () => {
  const user = await requireSession();
  const result = await signingWorker(user.id, "/health");
  return Response.json(await result.json(), { headers });
});

export const POST = withErrorHandling(async (req: NextRequest) => {
  const user = await requireSession();
  if (req.nextUrl.searchParams.get("upload") === "1") {
    const maximum = 100 * 1024 * 1024;
    const length = Number(req.headers.get("content-length"));
    if (length > maximum) throw new HttpError(413, "Choose a file smaller than 100 MB.");
    if (!req.body) throw new HttpError(400, "Choose a video or audio file.");
    let received = 0;
    const limited = req.body.pipeThrough(new TransformStream<Uint8Array, Uint8Array>({
      transform(chunk, controller) {
        received += chunk.byteLength;
        if (received > maximum) { controller.error(new HttpError(413, "Choose a file smaller than 100 MB.")); return; }
        controller.enqueue(chunk);
      },
    }));
    const result = await signingWorker(user.id, "/jobs/upload", { method: "POST", body: limited,
      duplex: "half", headers: { "Content-Type": "application/octet-stream" }, signal: req.signal });
    return Response.json(liveJobSchema.parse(await result.json()), { status: 202, headers });
  }
  const body = createSchema.parse(await parseJson(req));
  if (body.kind === "exam") await authorizeSigningExam(user.id, body.sessionId, body.part, false);
  const result = await signingWorker(user.id, "/jobs", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  return Response.json(liveJobSchema.parse(await result.json()), { status: 202, headers });
});
