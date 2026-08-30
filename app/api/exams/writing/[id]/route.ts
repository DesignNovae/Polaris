import type { NextRequest } from "next/server";
import { z } from "zod";
import { parseJson, withErrorHandling } from "@/lib/api/respond";
import { requireSession } from "@/lib/authz";
import { getWritingPractice, saveWritingDraft, startWritingPractice, submitWritingPractice } from "@/lib/exams/writing-practice";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Context = { params: Promise<{ id: string }> };

const actionSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("start") }),
  z.object({ action: z.literal("save"), response: z.string().max(12000), revision: z.number().int().min(0) }),
  z.object({ action: z.literal("submit"), response: z.string().max(12000), revision: z.number().int().min(0) }),
]);

export const GET = withErrorHandling(async (_request: NextRequest, { params }: Context) => {
  const user = await requireSession();
  const { id } = await params;
  return Response.json(await getWritingPractice(user.id, id));
});

export const PATCH = withErrorHandling(async (request: NextRequest, { params }: Context) => {
  const user = await requireSession();
  const { id } = await params;
  const body = actionSchema.parse(await parseJson(request));
  if (body.action === "start") return Response.json(await startWritingPractice(user.id, id));
  if (body.action === "save") return Response.json(await saveWritingDraft(user.id, id, body.response, body.revision));
  return Response.json(await submitWritingPractice(user.id, id, body.response, body.revision));
});
