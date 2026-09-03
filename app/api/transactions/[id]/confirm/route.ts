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
 * Scope: consultant bookings ONLY.
 *
 * This endpoint used to also grant a subscription when the transaction
 * description parsed as a plan name. That made a paid plan self-serve and
 * free: POST /api/transactions with description "Polaris Elite (yearly)" and
 * amount 1, POST here, and the dice roll handed out Elite for one paisa - no
 * gateway, no money, retryable on failure. Verified reproducible before it was
 * removed.
 *
 * A plan is now granted in exactly one place: settleValidatedPayment(), which
 * runs only after SSLCommerz validates a real transaction server-to-server.
 * Keep it that way - nothing that a client can drive should call setUserPlan.
 */

import { z } from "zod";
import { ok, withErrorHandling, parseJson, HttpError } from "@/lib/api/respond";
import { requireSession } from "@/lib/authz";
import {
  getTransaction,
  setTransactionStatus,
} from "@/lib/db/collections";

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
  // A failed sandbox attempt can be retried from the same booking. Succeeded
  // and refunded transactions remain terminal.
  if (tx.status !== "pending" && tx.status !== "processing" && tx.status !== "failed") {
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
