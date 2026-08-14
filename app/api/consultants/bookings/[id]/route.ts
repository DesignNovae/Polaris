/**
 * /api/consultants/bookings/[id]
 *
 * PATCH - { action: "cancel" | "confirm-payment" }
 *   cancel          - allowed until 24h before the slot; paid bookings get a
 *                     refund note + the linked transaction flips to refunded.
 *   confirm-payment - after the client confirms the sandbox transaction
 *                     (/api/transactions/[id]/confirm), promotes the booking
 *                     from pending_payment → confirmed.
 */

import { z } from "zod";
import { ok, withErrorHandling, parseJson, HttpError } from "@/lib/api/respond";
import { requireSession } from "@/lib/authz";
import { cancelBooking, confirmBookingPayment } from "@/lib/consultants/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const schema = z.object({ action: z.enum(["cancel", "confirm-payment"]) });

export const PATCH = withErrorHandling(async (req, ctx: { params: Promise<{ id: string }> }) => {
  const session = await requireSession();
  const { id } = await ctx.params;
  const { action } = schema.parse(await parseJson(req));

  if (action === "cancel") {
    const res = await cancelBooking(session.id, id);
    if (!res.ok) throw new HttpError(409, res.error ?? "Couldn't cancel");
    return ok({ status: "cancelled" });
  }

  const booking = await confirmBookingPayment(session.id, id);
  if (!booking) {
    throw new HttpError(409, "Payment not confirmed yet - complete the transaction first.");
  }
  return ok({ status: booking.status });
});


