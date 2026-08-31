import type { NextRequest } from "next/server";
import { withErrorHandling } from "@/lib/api/respond";
import { requireSession } from "@/lib/authz";
import { getExamCatalog } from "@/lib/exams/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = withErrorHandling(async (_req: NextRequest) => {
  const user = await requireSession();
  return Response.json(await getExamCatalog(user.id));
});

