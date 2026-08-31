import type { NextRequest } from "next/server";
import { withErrorHandling } from "@/lib/api/respond";
import { requireSession } from "@/lib/authz";
import { finalizeExamSession } from "@/lib/exams/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Context = { params: Promise<{ id: string }> };

export const POST = withErrorHandling(async (_req: NextRequest, { params }: Context) => {
  const user = await requireSession();
  const { id } = await params;
  return Response.json(await finalizeExamSession(user.id, id));
});
