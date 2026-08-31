import type { NextRequest } from "next/server";
import { z } from "zod";
import { withErrorHandling } from "@/lib/api/respond";
import { requireSession } from "@/lib/authz";
import { getSpeakingRecording, saveSpeakingRecording } from "@/lib/exams/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Context = { params: Promise<{ id: string }> };

const metadataSchema = z.object({
  itemId: z.string().min(3).max(100).regex(/^[a-zA-Z0-9_-]+$/),
  transcript: z.string().max(30_000),
  revision: z.coerce.number().int().min(0),
});

export const POST = withErrorHandling(async (req: NextRequest, { params }: Context) => {
  const user = await requireSession();
  const { id } = await params;
  const form = await req.formData();
  const body = metadataSchema.parse({
    itemId: form.get("itemId"),
    transcript: form.get("transcript"),
    revision: form.get("revision"),
  });
  const audio = form.get("audio");
  if (!(audio instanceof Blob)) return Response.json({ error: "A recording is required" }, { status: 400 });
  return Response.json(await saveSpeakingRecording(user.id, id, { ...body, audio }));
});

export const GET = withErrorHandling(async (req: NextRequest, { params }: Context) => {
  const user = await requireSession();
  const { id } = await params;
  const itemId = z.string().min(3).max(100).parse(req.nextUrl.searchParams.get("itemId"));
  const recording = await getSpeakingRecording(user.id, id, itemId);
  const body = recording.data.buffer.slice(
    recording.data.byteOffset,
    recording.data.byteOffset + recording.data.byteLength,
  ) as ArrayBuffer;
  return new Response(body, {
    headers: {
      "Content-Type": recording.contentType,
      "Cache-Control": "private, no-store",
      "Content-Disposition": "inline",
    },
  });
});
