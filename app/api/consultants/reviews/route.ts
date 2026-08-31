/**
 * POST /api/consultants/reviews
 *
 * Submit a review for a session you actually booked (one per booking,
 * only after the slot time has passed). Ratings shown on consultant cards
 * aggregate exclusively from these rows - never seeded.
 */

import { z } from "zod";
import { ok, withErrorHandling, parseJson, HttpError } from "@/lib/api/respond";
import { requireSession } from "@/lib/authz";
import { addReview } from "@/lib/consultants/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const schema = z.object({
  bookingId: z.string().min(1).max(40),
  rating: z.number().int().min(1).max(5),
  text: z.string().min(3).max(1000),
});

export const POST = withErrorHandling(async (req) => {
  const session = await requireSession();
  const body = schema.parse(await parseJson(req));
  const res = await addReview({
    userId: session.id,
    userName: session.name ?? "Student",
    bookingId: body.bookingId,
    rating: body.rating,
    text: body.text,
  });
  if (!res.ok) throw new HttpError(409, res.error ?? "Couldn't save review");
  return ok({ saved: true });
});


