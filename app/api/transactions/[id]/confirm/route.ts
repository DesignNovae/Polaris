/**
 * POST /api/transactions/[id]/confirm
 *
 * Simulates payment confirmation. Body: { otp? }  - only required for
 * mobile-wallet flows. Card flows confirm without an OTP.
 *
 * Outcomes:
 *   • 90% succeed
 *   • 8% fail with "Insufficient funds"
 *   • 2% fail with "Bank declined"
 *
 * On success we also bump the user's plan if the description starts with
 * "Polaris Pro" or "Polaris Elite".
 */

import { z } from "zod";
import { ok, withErrorHandling, parseJson, HttpError } from "@/lib/api/respond";
import { requireSession } from "@/lib/authz";
import {
  getTransaction,
  setTransactionStatus,
  setUserPlan,
} from "@/lib/db/collections";
import { parsePlanDescription } from "@/lib/billing/plans";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const bodySchema = z.object({
  otp: z.string().min(4).max(8).optional(),
});

export const POST = withErrorHandling(async (req, ctx: { params: Promise<{ id: string }> }) => {
  const session = await requireSession();
  const { id } = await ctx.params;
  const body = bodySchema.parse(await parseJson(req).catch(() => ({})));

  const tx = await getTransaction(session.id, id);
  if (!tx) throw new HttpError(404, "Transaction not found");
  if (tx.status !== "pending" && tx.status !== "processing") {
    throw new HttpError(409, `Transaction already ${tx.status}`);
  }

  const isWallet = tx.method !== "card";
  if (isWallet && (!body.otp || body.otp.trim().length < 4)) {
    throw new HttpError(400, "OTP required");
  }

  // Move to processing (mostly for the UX of the modal).
  await setTransactionStatus(session.id, id, "processing");

  // Simulated processing delay.
  await new Promise((r) => setTimeout(r, 900));

  // Outcome distribution.
  const dice = Math.random();
  if (dice < 0.90) {
    const finalized = await setTransactionStatus(session.id, id, "succeeded");
    // Bump plan + write full subscription state if this was a plan purchase.
    const parsed = parsePlanDescription(tx.description);
    if (parsed) {
      const now = new Date();
      const renews = new Date(now);
      if (parsed.cycle === "monthly") renews.setMonth(renews.getMonth() + 1);
      else renews.setFullYear(renews.getFullYear() + 1);
      await setUserPlan(session.id, parsed.planId, {
        status: "active",
        planId: parsed.planId,
        billingCycle: parsed.cycle,
        startedAt: now.toISOString(),
        renewsAt: renews.toISOString(),
        priceMinor: tx.amount,
        currency: tx.currency,
      });
    }
    return ok({
      transaction: {
        id: finalized?._id?.toString(),
        reference: finalized?.reference,
        status: finalized?.status,
        updatedAt: finalized?.updatedAt,
      },
    });
  }

  const reason = dice < 0.98 ? "Insufficient funds" : "Bank declined";
  const finalized = await setTransactionStatus(session.id, id, "failed", reason);
  return ok({
    transaction: {
      id: finalized?._id?.toString(),
      reference: finalized?.reference,
      status: finalized?.status,
      failureReason: finalized?.failureReason,
      updatedAt: finalized?.updatedAt,
    },
  });
});
