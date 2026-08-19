/**
 * /api/consultants/bookings
 *
 * GET  - the signed-in user's bookings (any plan - never plan-gated).
 * POST - create a booking. Free first sessions confirm immediately when the
 *        consultant's verified free-session flag + first-time eligibility
 *        hold; paid sessions create a pending sandbox transaction whose
 *        price transparently includes the 10% platform fee.
 */

import { z } from "zod";
import { ok, withErrorHandling, parseJson, HttpError } from "@/lib/api/respond";
import { requireSession } from "@/lib/authz";
import {
  ensureConsultantsSeeded, getConsultant, createBooking, listBookings,
} from "@/lib/consultants/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const createSchema = z.object({
  consultantId: z.string().min(1).max(60),
  service: z.string().min(1).max(40),
  type: z.enum(["video", "voice", "chat", "document"]),
  slotIso: z.string().datetime(),
  method: z.enum(["card", "bkash", "nagad", "rocket"]).optional(),
  useFreeSession: z.boolean().default(false),
});

export const GET = withErrorHandling(async () => {
  const session = await requireSession();
  const rows = await listBookings(session.id);
  return ok({
    bookings: rows.map((b) => ({
      id: b._id?.toString(),
      consultantId: b.consultantId,
      consultantName: b.consultantName,
      service: b.service,
      type: b.type,
      slotIso: b.slotIso,
      sessionMinutes: b.sessionMinutes,
      status: b.status,
      priceMinor: b.priceMinor,
      currency: b.currency,
      freeSession: b.freeSession,
      platformFeeMinor: b.platformFeeMinor,
      consultantPayoutMinor: b.consultantPayoutMinor,
      transactionId: b.transactionId,
      refundNote: b.refundNote,
      createdAt: b.createdAt,
    })),
  });
});

export const POST = withErrorHandling(async (req) => {
  const session = await requireSession();
  const body = createSchema.parse(await parseJson(req));

  await ensureConsultantsSeeded();
  const consultant = await getConsultant(body.consultantId);
  if (!consultant) throw new HttpError(404, "Consultant not found");
  if (!consultant.services.includes(body.service as (typeof consultant.services)[number])) {
    throw new HttpError(400, "This consultant doesn't offer that service");
  }

  const result = await createBooking({
    userId: session.id,
    consultant,
    service: body.service as (typeof consultant.services)[number],
    type: body.type,
    slotIso: body.slotIso,
    method: body.method,
    useFreeSession: body.useFreeSession,
  });
  if (!result.ok) throw new HttpError(409, result.error);

  return ok({
    booking: {
      id: result.booking._id?.toString(),
      status: result.booking.status,
      slotIso: result.booking.slotIso,
      priceMinor: result.booking.priceMinor,
      freeSession: result.booking.freeSession,
      platformFeeMinor: result.booking.platformFeeMinor,
      consultantPayoutMinor: result.booking.consultantPayoutMinor,
      transactionId: result.booking.transactionId,
    },
    transaction: result.transaction
      ? { id: result.transaction._id?.toString(), reference: result.transaction.reference, status: result.transaction.status }
      : null,
  });
});


