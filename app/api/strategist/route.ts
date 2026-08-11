import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { requireSession } from "@/lib/authz";
import { HttpError, parseJson } from "@/lib/api/respond";
import { getProfile } from "@/lib/db/collections";
import { StrategistRequestSchema } from "@/lib/strategist/schemas";
import { sseHeaders, strategistStream } from "@/lib/strategist/stream";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const user = await requireSession();
    const body = StrategistRequestSchema.parse(await parseJson(req));
    const profile = await getProfile(user.id);
    const stream = strategistStream({
      message: body.message,
      mode: body.mode,
      profile,
      roadmapContext: body.roadmapContext,
      abortSignal: req.signal,
    });
    return new Response(stream, { headers: sseHeaders() });
  } catch (err) {
    if (err instanceof ZodError) {
      return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
    }
    if (err instanceof HttpError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error("[strategist] route error:", err);
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}
