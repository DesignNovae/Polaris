import type { NextRequest } from "next/server";
import { withErrorHandling } from "@/lib/api/respond";
import { requireSession } from "@/lib/authz";
import { recordStreakActivity } from "@/lib/streak/service";
import { finalizeExamSession } from "@/lib/exams/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Context = { params: Promise<{ id: string }> };

export const POST = withErrorHandling(async (_req: NextRequest, { params }: Context) => {
  const user = await requireSession();
  const { id } = await params;
  const result = await finalizeExamSession(user.id, id);
  // Sitting the paper earns the day. The score never does - rewarding outcomes
  // would penalise exactly the students who most need to keep showing up.
  await recordStreakActivity(user.id, "Completed a practice exam");
  return Response.json(result);
});
