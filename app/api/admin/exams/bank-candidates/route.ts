import type { NextRequest } from "next/server";
import { z } from "zod";
import { parseJson, withErrorHandling } from "@/lib/api/respond";
import { requireRole } from "@/lib/authz";
import { listBankCandidates, reviewBankCandidate } from "@/lib/exams/bank-candidates";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = withErrorHandling(async (req: NextRequest) => {
  await requireRole("admin");
  const status = z.enum(["review", "approved", "rejected"]).catch("review").parse(req.nextUrl.searchParams.get("status"));
  return Response.json({ candidates: await listBankCandidates(status) });
});

const reviewSchema = z.object({ candidateId: z.string().length(24), decision: z.enum(["approve", "reject"]) });

export const PATCH = withErrorHandling(async (req: NextRequest) => {
  const user = await requireRole("admin");
  const body = reviewSchema.parse(await parseJson(req));
  return Response.json(await reviewBankCandidate(user.id, body.candidateId, body.decision));
});
