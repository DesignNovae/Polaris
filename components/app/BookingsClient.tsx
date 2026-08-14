"use client";

/**
 * Bookings - the student's consultation sessions. Upcoming sessions show a
 * countdown; pending-payment bookings can complete payment; cancellation
 * follows the 24-hour rule; completed sessions invite a real review (the
 * only source of consultant ratings).
 */

import { useMemo, useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/cn";
import { SERVICE_META, CONSULTATION_TYPE_META, type ServiceKey, type ConsultationType } from "@/lib/consultants/registry";
import { formatMinor } from "@/lib/billing/plans";

export type BookingView = {
  id: string;
  consultantId: string;
  consultantName: string;
  service: ServiceKey;
  type: ConsultationType;
  slotIso: string;
  sessionMinutes: number;
  status: "pending_payment" | "confirmed" | "cancelled" | "completed";
  priceMinor: number;
  currency: string;
  freeSession: boolean;
  platformFeeMinor: number;
  consultantPayoutMinor: number;
  transactionId: string | null;
  refundNote: string | null;
};

const STATUS_META: Record<BookingView["status"], { label: string; cls: string }> = {
  pending_payment: { label: "Payment pending", cls: "bg-nova-100 text-nova-600 ring-nova-400/40 dark:bg-nova-400/15 dark:text-nova-100" },
  confirmed:       { label: "Confirmed",       cls: "bg-aurora-100 text-aurora-700 ring-aurora-400/40 dark:bg-aurora-400/15 dark:text-aurora-100" },
  cancelled:       { label: "Cancelled",       cls: "bg-paper-soft text-ink-muted ring-ink/10" },
  completed:       { label: "Completed",       cls: "bg-polaris-100 text-polaris-700 ring-polaris-300 dark:bg-polaris-400/20 dark:text-polaris-100" },
};

export function BookingsClient({ initial, demo = false, basePath = "" }: { initial: BookingView[]; demo?: boolean; basePath?: string }) {
  const [bookings, setBookings] = useState(initial);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [review, setReview] = useState<BookingView | null>(null);

  const upcoming = useMemo(
    () => bookings.filter((b) => (b.status === "confirmed" || b.status === "pending_payment") && new Date(b.slotIso).getTime() > Date.now()),
    [bookings],
  );
  const past = useMemo(
    () => bookings.filter((b) => !upcoming.includes(b)),
    [bookings, upcoming],
  );

  async function cancel(b: BookingView) {
    setBusyId(b.id);
    try {
      if (demo) { setBookings((cur) => cur.map((x) => x.id === b.id ? { ...x, status: "cancelled" } : x)); setToast("Booking cancelled in demo mode."); return; }
      const r = await fetch(`/api/consultants/bookings/${b.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "cancel" }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) { setToast(d?.error ?? "Couldn't cancel."); return; }
      setBookings((cur) => cur.map((x) => (x.id === b.id ? { ...x, status: "cancelled" } : x)));
      setToast("Booking cancelled." + (b.priceMinor > 0 && !b.freeSession ? " Refund initiated." : ""));
    } finally {
      setBusyId(null);
      setTimeout(() => setToast(null), 5000);
    }
  }

  /** Resume payment for a pending booking using its stored transaction. */
  async function pay(b: BookingView, otp: string): Promise<string | null> {
    if (!b.transactionId) return "No payment attached - rebook from the marketplace.";
    setBusyId(b.id);
    try {
      const confirm = await fetch(`/api/transactions/${b.transactionId}/confirm`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(otp ? { otp } : {}),
      });
      const cd = await confirm.json().catch(() => ({}));
      if (!confirm.ok) return cd?.error ?? "Payment failed.";
      if (cd?.transaction?.status !== "succeeded") {
        return cd?.transaction?.failureReason ?? "Payment didn't go through - try again.";
      }
      const promote = await fetch(`/api/consultants/bookings/${b.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "confirm-payment" }),
      });
      if (!promote.ok) return "Payment received - refresh to see the confirmed session.";
      setBookings((cur) => cur.map((x) => (x.id === b.id ? { ...x, status: "confirmed" } : x)));
      setToast("Payment confirmed - session booked.");
      setTimeout(() => setToast(null), 5000);
      return null;
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="px-5 lg:px-10 py-7 max-w-[920px] mx-auto">
      <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <div className="text-[10.5px] uppercase tracking-[0.22em] text-ink-muted font-medium mb-1.5">Consultations</div>
            <h1 className="font-serif text-[30px] leading-[1.05] font-bold tracking-tight text-ink">
              Your <span className="grad-text">bookings</span>
            </h1>
          </div>
          <Link href={`${basePath}/consultants`} className="rounded-full bg-ink text-paper px-4 py-2 text-[12.5px] font-semibold hover:bg-polaris-700 transition-colors">
            Find a consultant →
          </Link>
        </div>
      </motion.div>

      {bookings.length === 0 && (
        <div className="mt-14 text-center">
          <div className="text-[15px] font-semibold text-ink">No sessions yet</div>
          <p className="mt-1 text-[13px] text-ink-dim">
            Browse verified consultants - several offer a free first session.
          </p>
        </div>
      )}

      {upcoming.length > 0 && (
        <Section title="Upcoming">
          {upcoming.map((b, i) => (
            <BookingCard key={b.id} b={b} i={i} busy={busyId === b.id} onCancel={() => cancel(b)} onReview={() => setReview(b)} onPay={(otp) => pay(b, otp)} />
          ))}
        </Section>
      )}
      {past.length > 0 && (
        <Section title="Past & cancelled">
          {past.map((b, i) => (
            <BookingCard key={b.id} b={b} i={i} busy={busyId === b.id} onCancel={() => cancel(b)} onReview={() => setReview(b)} onPay={(otp) => pay(b, otp)} />
          ))}
        </Section>
      )}

      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 10 }}
            className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 rounded-full bg-ink text-paper px-5 py-2.5 text-[12.5px] font-medium shadow-pop"
          >
            {toast}
          </motion.div>
        )}
        {review && <ReviewModal b={review} onClose={() => setReview(null)} onDone={() => { setReview(null); setToast("Review saved - thank you."); setTimeout(() => setToast(null), 4000); }} />}
      </AnimatePresence>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-8">
      <h2 className="text-[12px] font-bold text-ink-muted uppercase tracking-[0.16em]">{title}</h2>
      <div className="mt-3 space-y-3">{children}</div>
    </section>
  );
}

function BookingCard({
  b, i, busy, onCancel, onReview, onPay,
}: {
  b: BookingView; i: number; busy: boolean;
  onCancel: () => void; onReview: () => void;
  onPay: (otp: string) => Promise<string | null>;
}) {
  const [payOpen, setPayOpen] = useState(false);
  const [otp, setOtp] = useState("");
  const [payErr, setPayErr] = useState<string | null>(null);
  const when = new Date(b.slotIso);
  const hoursOut = (when.getTime() - Date.now()) / 3_600_000;
  const canCancel = (b.status === "confirmed" || b.status === "pending_payment") && hoursOut >= 24;
  const happened = when.getTime() < Date.now() && (b.status === "confirmed" || b.status === "completed");
  const meta = STATUS_META[b.status];

  async function handlePay() {
    setPayErr(null);
    const err = await onPay(otp);
    if (err) {
      // Wallet transactions need an OTP - reveal the field and let them retry.
      if (/otp/i.test(err)) setPayOpen(true);
      setPayErr(err);
    } else {
      setPayOpen(false);
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }}
      transition={{ delay: i * 0.05, duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
      className="rounded-2xl bg-paper-card ring-1 ring-inset ring-polaris-500/12 dark:ring-white/[0.12] p-4 sm:p-5"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <Link href={`/consultants/${b.consultantId}`} className="text-[14.5px] font-bold text-ink hover:text-polaris-600 transition-colors">
              {b.consultantName}
            </Link>
            <span className={cn("rounded-full px-2 py-0.5 text-[9.5px] font-bold uppercase tracking-wide ring-1 ring-inset", meta.cls)}>
              {meta.label}
            </span>
            {b.freeSession && (
              <span className="rounded-full bg-aurora-100 dark:bg-aurora-400/15 px-2 py-0.5 text-[9.5px] font-bold uppercase tracking-wide text-aurora-700 dark:text-aurora-100">
                Free session
              </span>
            )}
          </div>
          <div className="mt-1 text-[12px] text-ink-dim">
            {SERVICE_META[b.service]?.label ?? b.service} · {CONSULTATION_TYPE_META[b.type]?.label ?? b.type} · {b.sessionMinutes} min
          </div>
          <div className="mt-0.5 text-[12px] text-ink-muted">
            {when.toLocaleString("en-GB", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
            {hoursOut > 0 && b.status !== "cancelled" && (
              <span className="ml-2 text-polaris-500 font-semibold">
                in {hoursOut < 48 ? `${Math.max(1, Math.round(hoursOut))}h` : `${Math.round(hoursOut / 24)}d`}
              </span>
            )}
          </div>
          {b.refundNote && <div className="mt-1 text-[11.5px] text-aurora-600 dark:text-aurora-200">{b.refundNote}</div>}
        </div>

        <div className="text-right">
          <div className="text-[14px] font-bold text-ink tabular-nums">
            {b.priceMinor === 0 ? "$0" : formatMinor(b.priceMinor, b.currency)}
          </div>
          {b.priceMinor > 0 && (
            <div className="text-[10px] text-ink-muted">
              incl. {formatMinor(b.platformFeeMinor, b.currency)} platform fee
            </div>
          )}
        </div>
      </div>

      {(canCancel || happened || b.status === "pending_payment") && (
        <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-ink/[0.06] dark:border-white/[0.08] pt-3">
          {b.status === "pending_payment" && (
            <>
              {payOpen && (
                <input
                  value={otp}
                  onChange={(e) => setOtp(e.target.value)}
                  placeholder="Wallet OTP (sandbox: any 4+ digits)"
                  maxLength={8}
                  className="rounded-full border border-polaris-200 bg-paper-card px-3 py-1.5 text-[11.5px] text-ink placeholder:text-ink-muted/60 focus:border-polaris-400 focus:outline-none dark:border-white/[0.14] w-56"
                />
              )}
              <button
                onClick={() => void handlePay()}
                disabled={busy || (payOpen && otp.trim().length < 4)}
                className="rounded-full bg-ink text-paper px-3.5 py-1.5 text-[11.5px] font-semibold hover:bg-polaris-700 transition-colors disabled:opacity-50"
              >
                {busy ? "Processing…" : "Complete payment"}
              </button>
              {payErr && <span className="text-[11px] text-rose-600 dark:text-rose-300">{payErr}</span>}
            </>
          )}
          {happened && (
            <button onClick={onReview} className="rounded-full bg-polaris-100 text-polaris-700 dark:bg-polaris-400/20 dark:text-polaris-100 px-3.5 py-1.5 text-[11.5px] font-semibold hover:bg-polaris-200 transition-colors">
              Leave a review
            </button>
          )}
          {canCancel && (
            <button
              onClick={onCancel}
              disabled={busy}
              className="rounded-full bg-paper-soft text-ink-dim px-3.5 py-1.5 text-[11.5px] font-semibold hover:text-rose-600 transition-colors disabled:opacity-50"
            >
              {busy ? "Cancelling…" : "Cancel (free until 24h before)"}
            </button>
          )}
        </div>
      )}
    </motion.div>
  );
}

/* ─── Review modal - the only source of consultant ratings ─── */

function ReviewModal({ b, onClose, onDone }: { b: BookingView; onClose: () => void; onDone: () => void }) {
  const [rating, setRating] = useState(5);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      const r = await fetch("/api/consultants/reviews", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ bookingId: b.id, rating, text }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) { setError(d?.error ?? "Couldn't save review."); return; }
      onDone();
    } finally {
      setBusy(false);
    }
  }

  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink/45 backdrop-blur-sm"
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      onClick={onClose}
    >
      <motion.div
        onClick={(e) => e.stopPropagation()}
        initial={{ opacity: 0, y: 24, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 16 }}
        transition={{ type: "spring", stiffness: 380, damping: 30 }}
        className="w-full max-w-md rounded-3xl bg-paper-card ring-1 ring-inset ring-polaris-500/15 dark:ring-white/[0.12] p-6 shadow-pop"
      >
        <div className="font-serif text-[18px] font-bold text-ink">Review {b.consultantName}</div>
        <p className="mt-1 text-[12px] text-ink-muted">Real reviews are the only thing that builds a consultant&apos;s rating.</p>

        <div className="mt-4 flex gap-1.5">
          {[1, 2, 3, 4, 5].map((n) => (
            <button key={n} onClick={() => setRating(n)} className="p-1" aria-label={`${n} stars`}>
              <svg width="26" height="26" viewBox="0 0 24 24"
                fill={n <= rating ? "#C49A3B" : "none"}
                stroke={n <= rating ? "#C49A3B" : "currentColor"}
                strokeWidth="1.6" className={n <= rating ? "" : "text-ink-muted"}>
                <polygon points="12 2 14.4 8.26 21 9 16 13.74 17.2 20.5 12 17.27 6.82 20.5 8 13.74 3 9 9.6 8.26 12 2" />
              </svg>
            </button>
          ))}
        </div>

        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="What did the session actually help with?"
          rows={4}
          maxLength={1000}
          className="mt-3 w-full rounded-xl border border-polaris-200 bg-paper-card px-3 py-2.5 text-sm text-ink placeholder:text-ink-muted/60 focus:border-polaris-400 focus:outline-none resize-none dark:border-white/[0.14]"
        />
        {error && <div className="mt-2 text-[12px] text-rose-600 dark:text-rose-300">{error}</div>}

        <div className="mt-4 flex justify-end gap-2">
          <button onClick={onClose} className="rounded-full px-4 py-2 text-[12.5px] text-ink-dim hover:text-ink transition-colors">Cancel</button>
          <button
            onClick={submit}
            disabled={busy || text.trim().length < 3}
            className="rounded-full bg-ink text-paper px-5 py-2 text-[12.5px] font-semibold hover:bg-polaris-700 transition-colors disabled:opacity-50"
          >
            {busy ? "Saving…" : "Submit review"}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

