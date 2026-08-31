import type { NextRequest } from "next/server";
import { z } from "zod";
import { parseJson, withErrorHandling } from "@/lib/api/respond";
import { requireSession } from "@/lib/authz";
import { abandonExamSession, getPublicExamSession } from "@/lib/exams/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Context = { params: Promise<{ id: string }> };

export const GET = withErrorHandling(async (_req: NextRequest, { params }: Context) => {
  const user = await requireSession();
  const { id } = await params;
  return Response.json(await getPublicExamSession(user.id, id));
});

const patchSchema = z.object({ action: z.literal("abandon") });

export const PATCH = withErrorHandling(async (req: NextRequest, { params }: Context) => {
  const user = await requireSession();
  const { id } = await params;
  patchSchema.parse(await parseJson(req));
  return Response.json(await abandonExamSession(user.id, id));
});
