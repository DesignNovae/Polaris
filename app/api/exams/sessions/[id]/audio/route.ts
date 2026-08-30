import type { NextRequest } from "next/server";
import { z } from "zod";
import { parseJson, withErrorHandling } from "@/lib/api/respond";
import { requireSession } from "@/lib/authz";
import { claimListeningAudio } from "@/lib/exams/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Context = { params: Promise<{ id: string }> };
const bodySchema = z.object({ part: z.enum(["part-1", "part-2", "part-3", "part-4"]) });

export const POST = withErrorHandling(async (req: NextRequest, { params }: Context) => {
  const user = await requireSession();
  const { id } = await params;
  const { part } = bodySchema.parse(await parseJson(req));
  const audio = await claimListeningAudio(user.id, id, part);
  const body = audio.buffer.slice(audio.byteOffset, audio.byteOffset + audio.byteLength) as ArrayBuffer;
  return new Response(body, {
    headers: {
      "Content-Type": "audio/wav",
      "Cache-Control": "private, no-store",
      "Content-Disposition": "inline",
    },
  });
});
