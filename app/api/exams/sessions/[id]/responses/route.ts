import type { NextRequest } from "next/server";
import { z } from "zod";
import { parseJson, withErrorHandling } from "@/lib/api/respond";
import { requireSession } from "@/lib/authz";
import { saveExamResponse } from "@/lib/exams/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Context = { params: Promise<{ id: string }> };
const responseSchema = z.object({
  itemId: z.string().min(3).max(100).regex(/^[a-zA-Z0-9_-]+$/),
  answer: z.string().max(30_000).nullable(),
  flagged: z.boolean(),
  revision: z.number().int().min(0),
});

export const PATCH = withErrorHandling(async (req: NextRequest, { params }: Context) => {
  const user = await requireSession();
  const { id } = await params;
  const body = responseSchema.parse(await parseJson(req));
  return Response.json(await saveExamResponse(user.id, id, body));
});
