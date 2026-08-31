import type { NextRequest } from "next/server";
import { z } from "zod";
import { parseJson, withErrorHandling } from "@/lib/api/respond";
import { requireSession } from "@/lib/authz";
import { createExamSession } from "@/lib/exams/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const createSchema = z.object({
  mode: z.enum([
    "sat-math-module",
    "sat-full",
    "ielts-reading",
    "ielts-writing",
    "ielts-listening",
    "ielts-speaking",
  ]),
  policy: z.enum(["fresh", "resume", "same-form"]).optional(),
  sourceSessionId: z.string().optional(),
});

export const POST = withErrorHandling(async (req: NextRequest) => {
  const user = await requireSession();
  const body = createSchema.parse(await parseJson(req));
  return Response.json(await createExamSession(user.id, body.mode, {
    policy: body.policy,
    sourceSessionId: body.sourceSessionId,
  }), { status: 201 });
});
