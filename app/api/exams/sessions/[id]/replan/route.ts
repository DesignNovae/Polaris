import type { NextRequest } from "next/server";
import { z } from "zod";
import { ok, withErrorHandling, parseJson } from "@/lib/api/respond";
import { requireSession } from "@/lib/authz";
import { buildReplanProposal, applyReplanProposal } from "@/lib/exams/replan-bridge";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Context = { params: Promise<{ id: string }> };

/**
 * GET  - what this attempt says the plan should change to.
 * POST - apply the subset the student accepted.
 *
 * Deterministic, so no rate limit is needed: it reads a stored result and does
 * arithmetic. Ownership is enforced by `getPublicExamResult`, which scopes on
 * userId inside the bridge.
 */
export const GET = withErrorHandling(async (_req: NextRequest, { params }: Context) => {
  const user = await requireSession();
  const { id } = await params;
  return ok({ proposal: await buildReplanProposal(user.id, id) });
});

const bodySchema = z.object({
  accept: z.array(z.string().min(1).max(64)).max(20),
});

export const POST = withErrorHandling(async (req: NextRequest, { params }: Context) => {
  const user = await requireSession();
  const { id } = await params;
  const { accept } = bodySchema.parse(await parseJson(req));

  const applied = await applyReplanProposal(user.id, id, accept);
  return ok({ applied, proposal: await buildReplanProposal(user.id, id) });
});
