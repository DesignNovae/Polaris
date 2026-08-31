import type { NextRequest } from "next/server";
import { withErrorHandling } from "@/lib/api/respond";
import { requireSession } from "@/lib/authz";
import { getPracticeGeneration } from "@/lib/exams/practice-generation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Context = { params: Promise<{ id: string }> };

export const GET = withErrorHandling(async (_request: NextRequest, { params }: Context) => {
  const user = await requireSession();
  const { id } = await params;
  return Response.json(await getPracticeGeneration(user.id, id));
});
