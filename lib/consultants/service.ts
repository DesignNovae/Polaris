/**
 * Consultants - DB layer: seeded profiles, real availability (template slots
 * minus existing bookings), bookings with transparent fee math, free-session
 * eligibility, reviews aggregated from real submissions only.
 *
 * Plan-independent by design: every function gates on session, never plan.
 */

import { ObjectId } from "mongodb";
import { getDb } from "@/lib/db/mongodb";
import { createTransaction, type DbTransaction } from "@/lib/db/collections";
import {
  CONSULTANT_SEED, PLATFORM_FEE_PCT,
  type ConsultantSeed, type ConsultationType, type ServiceKey,
} from "./registry";

/* ─── Types ────────────────────────────────────────────────────────────── */

export type DbConsultant = ConsultantSeed & {
  _id?: ObjectId;
  updatedAt: Date;
};

export type BookingStatus =
  | "pending_payment"
  | "confirmed"
  | "cancelled"
  | "completed";

export type DbBooking = {
  _id?: ObjectId;
  userId: string;
  consultantId: string;
  consultantName: string;
  service: ServiceKey;
  type: ConsultationType;
  /** ISO start time of the slot. */
  slotIso: string;
  sessionMinutes: number;
  status: BookingStatus;
  /** Total charged (USD cents). 0 for free sessions. */
  priceMinor: number;
  currency: string;
  freeSession: boolean;
  /** Transparent split of priceMinor. */
  platformFeeMinor: number;
  consultantPayoutMinor: number;
  transactionId?: string;
  refundNote?: string;
  createdAt: Date;
  updatedAt: Date;
};

export type DbConsultantReview = {
  _id?: ObjectId;
  consultantId: string;
  bookingId: string;
  userId: string;
  userName: string;
  rating: number; // 1..5
  text: string;
  createdAt: Date;
};

export type RatingSummary = { average: number; count: number };

/* ─── Seeding ──────────────────────────────────────────────────────────── */

/** Upsert the founding cohort so registry edits propagate (idempotent). */
export async function ensureConsultantsSeeded(): Promise<void> {
  const db = await getDb();
  const col = db.collection<DbConsultant>("consultants");
  await Promise.all(
    CONSULTANT_SEED.map((c) =>
      col.updateOne(
        { id: c.id },
        { $set: { ...c, updatedAt: new Date() } },
        { upsert: true },
      ),
    ),
  );
}

/* ─── Reads ────────────────────────────────────────────────────────────── */

export async function listConsultants(): Promise<DbConsultant[]> {
  const db = await getDb();
  return db
    .collection<DbConsultant>("consultants")
    .find({ verification: { $ne: "suspended" } })
    .sort({ verification: 1, name: 1 })
    .toArray();
}

export async function getConsultant(id: string): Promise<DbConsultant | null> {
  const db = await getDb();
  return db.collection<DbConsultant>("consultants").findOne({ id });
}

/** Real ratings only - aggregated from the reviews collection. */
export async function ratingSummaries(): Promise<Record<string, RatingSummary>> {
  const db = await getDb();
  const rows = await db
    .collection<DbConsultantReview>("consultant_reviews")
    .aggregate<{ _id: string; average: number; count: number }>([
      { $group: { _id: "$consultantId", average: { $avg: "$rating" }, count: { $sum: 1 } } },
    ])
    .toArray();
  return Object.fromEntries(rows.map((r) => [r._id, { average: r.average, count: r.count }]));
}

/* ─── Availability ─────────────────────────────────────────────────────── */

/**
 * Next-14-days concrete slots from the consultant's weekly template, minus
 * already-booked (non-cancelled) slots. Returned as ISO strings (UTC).
 */
export async function availableSlots(consultant: DbConsultant): Promise<string[]> {
  const db = await getDb();
  const taken = new Set(
    (
      await db
        .collection<DbBooking>("consultant_bookings")
        .find(
          { consultantId: consultant.id, status: { $in: ["pending_payment", "confirmed"] } },
          { projection: { slotIso: 1 } },
        )
        .toArray()
    ).map((b) => b.slotIso),
  );

  const out: string[] = [];
  const now = new Date();
  for (let d = 0; d < 14; d++) {
    const day = new Date(now);
    day.setUTCDate(day.getUTCDate() + d);
    for (const t of consultant.weeklySlots) {
      if (day.getUTCDay() !== t.day) continue;
      const slot = new Date(Date.UTC(
        day.getUTCFullYear(), day.getUTCMonth(), day.getUTCDate(), t.hour - 6, 0, 0, // Dhaka = UTC+6
      ));
      if (slot.getTime() < now.getTime() + 3 * 60 * 60 * 1000) continue; // 3h lead time
      const iso = slot.toISOString();
      if (!taken.has(iso)) out.push(iso);
    }
  }
  return out.sort();
}

/* ─── Bookings ─────────────────────────────────────────────────────────── */

/** A free first session applies once per consultant per user - verified flag required. */
export async function freeSessionEligible(userId: string, consultant: DbConsultant): Promise<boolean> {
  if (!consultant.freeFirstSession) return false;
  if (consultant.verification !== "verified" && consultant.verification !== "featured") return false;
  const db = await getDb();
  const prior = await db.collection<DbBooking>("consultant_bookings").countDocuments({
    userId,
    consultantId: consultant.id,
    status: { $ne: "cancelled" },
  });
  return prior === 0;
}

export type CreateBookingInput = {
  userId: string;
  consultant: DbConsultant;
  service: ServiceKey;
  type: ConsultationType;
  slotIso: string;
  /** Payment method for paid sessions (sandbox ledger). */
  method?: "card" | "bkash" | "nagad" | "rocket";
  useFreeSession: boolean;
};

export type CreateBookingResult =
  | { ok: true; booking: DbBooking; transaction?: DbTransaction }
  | { ok: false; error: string };

export async function createBooking(input: CreateBookingInput): Promise<CreateBookingResult> {
  const { consultant } = input;

  if (consultant.verification !== "verified" && consultant.verification !== "featured") {
    return { ok: false, error: "This consultant is still being verified and can't be booked yet." };
  }
  if (!consultant.services.includes(input.service)) {
    return { ok: false, error: "This consultant doesn't offer that service." };
  }
  if (!consultant.types.includes(input.type)) {
    return { ok: false, error: "This consultant doesn't offer that consultation type." };
  }

  const slots = await availableSlots(consultant);
  if (!slots.includes(input.slotIso)) {
    return { ok: false, error: "That slot was just taken - pick another time." };
  }

  const free = input.useFreeSession && (await freeSessionEligible(input.userId, consultant));
  if (input.useFreeSession && !free) {
    return { ok: false, error: "You've already used the free first session with this consultant." };
  }

  const priceMinor = free ? 0 : consultant.priceMinor;
  const platformFeeMinor = free ? 0 : Math.round((priceMinor * PLATFORM_FEE_PCT) / 100);

  const db = await getDb();
  const now = new Date();
  const booking: DbBooking = {
    userId: input.userId,
    consultantId: consultant.id,
    consultantName: consultant.name,
    service: input.service,
    type: input.type,
    slotIso: input.slotIso,
    sessionMinutes: consultant.sessionMinutes,
    status: free ? "confirmed" : "pending_payment",
    priceMinor,
    currency: "USD",
    freeSession: free,
    platformFeeMinor,
    consultantPayoutMinor: priceMinor - platformFeeMinor,
    createdAt: now,
    updatedAt: now,
  };

  let transaction: DbTransaction | undefined;
  if (!free) {
    transaction = await createTransaction({
      userId: input.userId,
      method: input.method ?? "card",
      amount: priceMinor,
      currency: "USD",
      description: `Consultation - ${consultant.name} (${input.service})`,
    });
    booking.transactionId = transaction._id?.toString();
  }

  const res = await db.collection<DbBooking>("consultant_bookings").insertOne(booking);
  booking._id = res.insertedId;
  return { ok: true, booking, transaction };
}

export async function listBookings(userId: string): Promise<DbBooking[]> {
  const db = await getDb();
  return db
    .collection<DbBooking>("consultant_bookings")
    .find({ userId })
    .sort({ slotIso: 1 })
    .toArray();
}

export async function getBooking(userId: string, id: string): Promise<DbBooking | null> {
  if (!ObjectId.isValid(id)) return null;
  const db = await getDb();
  return db.collection<DbBooking>("consultant_bookings").findOne({ _id: new ObjectId(id), userId });
}

/** Confirm a paid booking once its linked transaction has succeeded. */
export async function confirmBookingPayment(userId: string, id: string): Promise<DbBooking | null> {
  const booking = await getBooking(userId, id);
  if (!booking || booking.status !== "pending_payment" || !booking.transactionId) return null;

  const db = await getDb();
  const tx = await db
    .collection<DbTransaction>("transactions")
    .findOne({ _id: new ObjectId(booking.transactionId), userId });
  if (tx?.status !== "succeeded") return null;

  await db.collection<DbBooking>("consultant_bookings").updateOne(
    { _id: booking._id },
    { $set: { status: "confirmed", updatedAt: new Date() } },
  );
  return { ...booking, status: "confirmed" };
}

/** Cancellation rule: allowed until 24h before the slot. Paid → refund noted. */
export async function cancelBooking(userId: string, id: string): Promise<{ ok: boolean; error?: string }> {
  const booking = await getBooking(userId, id);
  if (!booking) return { ok: false, error: "Booking not found." };
  if (booking.status === "cancelled" || booking.status === "completed") {
    return { ok: false, error: `Booking is already ${booking.status}.` };
  }
  const hoursOut = (new Date(booking.slotIso).getTime() - Date.now()) / 3_600_000;
  if (hoursOut < 24) {
    return { ok: false, error: "Cancellations close 24 hours before the session." };
  }

  const db = await getDb();
  const refundNote =
    booking.status === "confirmed" && !booking.freeSession
      ? "Refund initiated to your original payment method."
      : undefined;

  await db.collection<DbBooking>("consultant_bookings").updateOne(
    { _id: booking._id },
    { $set: { status: "cancelled", updatedAt: new Date(), ...(refundNote ? { refundNote } : {}) } },
  );
  if (booking.transactionId && ObjectId.isValid(booking.transactionId)) {
    await db.collection<DbTransaction>("transactions").updateOne(
      { _id: new ObjectId(booking.transactionId), userId, status: "succeeded" },
      { $set: { status: "refunded", updatedAt: new Date() } },
    );
  }
  return { ok: true };
}

/* ─── Reviews (real submissions only) ──────────────────────────────────── */

export async function addReview(input: {
  userId: string;
  userName: string;
  bookingId: string;
  rating: number;
  text: string;
}): Promise<{ ok: boolean; error?: string }> {
  const booking = await getBooking(input.userId, input.bookingId);
  if (!booking) return { ok: false, error: "Booking not found." };
  if (booking.status !== "confirmed" && booking.status !== "completed") {
    return { ok: false, error: "Only a confirmed session can be reviewed." };
  }
  if (new Date(booking.slotIso).getTime() > Date.now()) {
    return { ok: false, error: "You can review after the session happens." };
  }
  const db = await getDb();
  const existing = await db
    .collection<DbConsultantReview>("consultant_reviews")
    .findOne({ bookingId: input.bookingId });
  if (existing) return { ok: false, error: "You already reviewed this session." };

  await db.collection<DbConsultantReview>("consultant_reviews").insertOne({
    consultantId: booking.consultantId,
    bookingId: input.bookingId,
    userId: input.userId,
    userName: input.userName,
    rating: Math.max(1, Math.min(5, Math.round(input.rating))),
    text: input.text.slice(0, 1000),
    createdAt: new Date(),
  });
  return { ok: true };
}

export async function listReviews(consultantId: string, limit = 20): Promise<DbConsultantReview[]> {
  const db = await getDb();
  return db
    .collection<DbConsultantReview>("consultant_reviews")
    .find({ consultantId })
    .sort({ createdAt: -1 })
    .limit(limit)
    .toArray();
}

