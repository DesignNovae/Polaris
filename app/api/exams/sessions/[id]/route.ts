import type { NextRequest } from "next/server";
import { z } from "zod";
import { parseJson, withErrorHandling } from "@/lib/api/respond";
import { requireSession } from "@/lib/authz";
import {
  abandonExamSession,
  getPublicExamSession,
  setExamReviewLater,
} from "@/lib/exams/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Context = { params: Promise<{ id: string }> };

export const GET = withErrorHandling(async (_req: NextRequest, { params }: Context) => {
  const user = await requireSession();
  const { id } = await params;
  return Response.json(await getPublicExamSession(user.id, id));
});

const patchSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("abandon") }),
  z.object({ action: z.literal("review-later"), flagged: z.boolean() }),
]);

export const PATCH = withErrorHandling(async (req: NextRequest, { params }: Context) => {
  const user = await requireSession();
  const { id } = await params;
  const body = patchSchema.parse(await parseJson(req));
  if (body.action === "review-later") {
    return Response.json(await setExamReviewLater(user.id, id, body.flagged));
  }
  return Response.json(await abandonExamSession(user.id, id));
});
