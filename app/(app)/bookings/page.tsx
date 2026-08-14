/**
 * /bookings - the student's consultation sessions: upcoming, pending
 * payment, past, cancelled. Plan-independent like the rest of the
 * consultants feature.
 */

import { requireSession } from "@/lib/authz";
import { listBookings } from "@/lib/consultants/service";
import { BookingsClient, type BookingView } from "@/components/app/BookingsClient";

export const dynamic = "force-dynamic";

export default async function BookingsPage() {
  const user = await requireSession();
  const rows = await listBookings(user.id);

  const bookings: BookingView[] = rows.map((b) => ({
    id: b._id?.toString() ?? "",
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
    transactionId: b.transactionId ?? null,
    refundNote: b.refundNote ?? null,
  }));

  return <BookingsClient initial={bookings} />;
}


