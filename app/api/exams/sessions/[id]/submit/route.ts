import type { NextRequest } from "next/server";
import { withErrorHandling } from "@/lib/api/respond";
import { requireSession } from "@/lib/authz";
import { recordProgress } from "@/lib/progress/record";
import { finalizeExamSession } from "@/lib/exams/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Context = { params: Promise<{ id: string }> };

export const POST = withErrorHandling(async (_req: NextRequest, { params }: Context) => {
  const user = await requireSession();
  const { id } = await params;
  const result = await finalizeExamSession(user.id, id);

  // Sitting the paper earns; the mark on it never does - rewarding outcomes
  // would take points from exactly the students who most need a reason to keep
  // showing up. Every submission is a timed section; a submission that ends
  // the exam is also a completed paper, and is worth both.
  await recordProgress(user.id, "exam-section");
  const finished = result.completed
    ? await recordProgress(user.id, "exam-complete")
    : null;

  return Response.json({
    ...result,
    // Surfaced so the results screen can celebrate what this attempt earned
    // rather than making the student go and find it.
    earnedBadges: (finished?.newBadges ?? []).map((b) => ({
      id: b.id,
      title: b.title,
      claim: b.claim,
      tier: b.tier,
    })),
  });
});
