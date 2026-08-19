"use client";

/**
 * Consultants marketplace - floating tilt cards, explainable "matched for
 * you" rail, profile modal with an interactive availability timeline and
 * the full booking flow (free verified first sessions, transparent fee
 * breakdown, sandbox payment via the existing transactions ledger).
 *
 * Plan-independent: no plan gates anywhere in this surface.
 */

import { useMemo, useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/cn";
import {
  SERVICE_META, CONSULTATION_TYPE_META, CONSULTANT_DISCLOSURE, PLATFORM_FEE_PCT,
  type ServiceKey, type ConsultationType, type VerificationStatus,
} from "@/lib/consultants/registry";
import type { ConsultantMatch } from "@/lib/consultants/matching";
import { formatMinor } from "@/lib/billing/plans";
import { PaymentLogo, type PayMethod } from "./PaymentLogos";

export type ConsultantView = {
  id: string;
  name: string;
  headline: string;
  bio: string;
  countries: string[];
  background: string;
  services: ServiceKey[];
  languages: string[];
  types: ConsultationType[];
  priceMinor: number;
  sessionMinutes: number;
  freeFirstSession: boolean;
  verification: VerificationStatus;
  responseHours: number;
  studentsGuided: number;
  avatarTone: "polaris" | "aurora" | "nova" | "sky" | "rose";
  rating: { average: number; count: number } | null;
  slots: string[];
  freeSessionEligible: boolean;
};

const TONE: Record<ConsultantView["avatarTone"], string> = {
  polaris: "from-polaris-300 to-polaris-500",
  aurora:  "from-aurora-400 to-aurora-600",
  nova:    "from-nova-400 to-nova-600",
  sky:     "from-[#5E8CA8] to-[#3E647D]",
  rose:    "from-[#C36F89] to-signal-rose",
};

type BookingState =
  | { step: "idle" }
  | { step: "configure" }
  | { step: "paying"; bookingId: string; transactionId: string }
  | { step: "done"; free: boolean };

export function ConsultantsClient({
  consultants, matches, initialOpenId, demo = false, basePath = "",
}: {
  consultants: ConsultantView[];
  matches: ConsultantMatch[];
  initialOpenId: string | null;
  demo?: boolean;
  basePath?: string;
}) {
  const [openId, setOpenId] = useState<string | null>(initialOpenId);
  const [serviceFilter, setServiceFilter] = useState<ServiceKey | "all">("all");
  const [freeOnly, setFreeOnly] = useState(false);

  const open = consultants.find((c) => c.id === openId) ?? null;
  const matchById = useMemo(() => new Map(matches.map((m) => [m.consultantId, m])), [matches]);

  const filtered = useMemo(
    () =>
      consultants.filter((c) => {
        if (serviceFilter !== "all" && !c.services.includes(serviceFilter)) return false;
        if (freeOnly && !(c.freeFirstSession && c.freeSessionEligible)) return false;
        return true;
      }),
    [consultants, serviceFilter, freeOnly],
  );

  const matched = matches
    .map((m) => consultants.find((c) => c.id === m.consultantId))
    .filter((c): c is ConsultantView => !!c);

  const usedServices = useMemo(() => {
    const s = new Set<ServiceKey>();
    for (const c of consultants) for (const k of c.services) s.add(k);
    return [...s];
  }, [consultants]);

  return (
    <div className="px-5 lg:px-10 py-7 max-w-[1160px] mx-auto">
      {/* ── Header ── */}
      <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <div className="text-[10.5px] uppercase tracking-[0.22em] text-ink-muted font-medium mb-1.5">
              Consultants &amp; community - open to every plan
            </div>
            <h1 className="font-serif text-[30px] leading-[1.05] font-bold tracking-tight text-ink">
              Verified people, <span className="grad-text">personal guidance</span>
            </h1>
            <p className="text-[13.5px] text-ink-dim mt-2 max-w-2xl leading-relaxed">
              Hire a verified consultant for visa prep, SOP review, scholarships,
              or country guidance - less hassle than an agency, transparent pricing,
              and no subscription required.
            </p>
          </div>
          <Link
            href={`${basePath}/bookings`}
            className="rounded-full bg-paper-card ring-1 ring-inset ring-polaris-500/15 dark:ring-white/[0.12] px-4 py-2 text-[12.5px] font-semibold text-ink hover:bg-paper-soft transition-colors"
          >
            My bookings →
          </Link>
        </div>

        {/* Free-resources-first + disclosure */}
        <div className="mt-4 rounded-2xl bg-aurora-50 dark:bg-aurora-400/10 ring-1 ring-inset ring-aurora-400/30 px-4 py-3 text-[12.5px] text-aurora-700 dark:text-aurora-100 leading-relaxed">
          <span className="font-semibold">Free first:</span> many questions are answered by the{" "}
          <Link href={`${basePath}/resources`} className="underline underline-offset-2 font-semibold">knowledge hub</Link>{" "}
          and the <Link href={`${basePath}/community`} className="underline underline-offset-2 font-semibold">community</Link> at no cost.
          Book a consultant when you want dedicated, personal time.
        </div>
      </motion.div>

      {/* ── Matched for you ── */}
      {matched.length > 0 && (
        <section className="mt-8">
          <h2 className="text-[13px] font-bold text-ink uppercase tracking-[0.14em]">Matched for you</h2>
          <p className="text-[12px] text-ink-muted mt-0.5">
            Based on your roadmap and deadlines - never random advertising.
          </p>
          <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4">
            {matched.map((c, i) => (
              <motion.button
                key={c.id}
                onClick={() => setOpenId(c.id)}
                className="text-left rounded-2xl bg-paper-card ring-1 ring-inset ring-polaris-400/40 p-4 hover:shadow-pop transition-shadow"
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 + i * 0.08, duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
                whileHover={{ y: -4 }}
              >
                <div className="flex items-center gap-3">
                  <AvatarOrb c={c} size={40} />
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[13.5px] font-bold text-ink truncate">{c.name}</span>
                      <VerifiedBadge status={c.verification} />
                    </div>
                    <div className="text-[11px] text-ink-muted truncate">{c.background}</div>
                  </div>
                </div>
                <div className="mt-2.5 space-y-1">
                  {(matchById.get(c.id)?.reasons ?? []).map((r) => (
                    <div key={r} className="flex items-start gap-1.5 text-[11.5px] text-ink-dim leading-snug">
                      <span className="mt-1 h-1 w-1 rounded-full bg-polaris-400 shrink-0" />
                      {r}
                    </div>
                  ))}
                </div>
              </motion.button>
            ))}
          </div>
        </section>
      )}

      {/* ── Filters ── */}
      <div className="mt-8 flex flex-wrap items-center gap-2">
        <FilterPill active={serviceFilter === "all"} onClick={() => setServiceFilter("all")}>
          All services
        </FilterPill>
        {usedServices.map((s) => (
          <FilterPill key={s} active={serviceFilter === s} onClick={() => setServiceFilter(s)}>
            {SERVICE_META[s].label}
          </FilterPill>
        ))}
        <span className="mx-1 h-4 w-px bg-ink/10" />
        <FilterPill active={freeOnly} onClick={() => setFreeOnly((v) => !v)}>
          Free first session
        </FilterPill>
      </div>

      {/* ── Grid ── */}
      <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <AnimatePresence mode="popLayout">
          {filtered.map((c, i) => (
            <motion.div
              key={c.id}
              layout
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96 }}
              transition={{ delay: i * 0.04, duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
            >
              <ConsultantCard c={c} onOpen={() => setOpenId(c.id)} />
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
      {filtered.length === 0 && (
        <div className="mt-10 text-center text-[13px] text-ink-muted">
          No consultants match those filters yet - the cohort is growing.
        </div>
      )}

      {/* ── Disclosure ── */}
      <p className="mt-10 text-[11.5px] text-ink-muted leading-relaxed max-w-3xl">
        {CONSULTANT_DISCLOSURE}
      </p>

      {/* ── Profile + booking modal ── */}
      <AnimatePresence>
        {open && <ProfileModal c={open} onClose={() => setOpenId(null)} demo={demo} basePath={basePath} />}
      </AnimatePresence>
    </div>
  );
}

/* ═══ Cards ═══ */

function ConsultantCard({ c, onOpen }: { c: ConsultantView; onOpen: () => void }) {
  const pending = c.verification === "pending";
  return (
    <motion.button
      onClick={onOpen}
      className={cn(
        "w-full text-left rounded-3xl bg-paper-card ring-1 ring-inset p-5 transition-shadow h-full flex flex-col",
        pending ? "ring-polaris-500/10 opacity-80" : "ring-polaris-500/15 dark:ring-white/[0.12] hover:shadow-pop",
      )}
      whileHover={{ y: -5, rotateX: 1.4, rotateY: -1.4 }}
      style={{ transformStyle: "preserve-3d", perspective: 900 }}
      transition={{ type: "spring", stiffness: 260, damping: 22 }}
    >
      <div className="flex items-start gap-3">
        <AvatarOrb c={c} size={48} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[14.5px] font-bold text-ink">{c.name}</span>
            <VerifiedBadge status={c.verification} />
          </div>
          <div className="text-[11px] text-ink-muted mt-0.5">{c.background}</div>
        </div>
      </div>

      <p className="mt-3 text-[12.5px] text-ink-dim leading-snug flex-1">{c.headline}</p>

      <div className="mt-3 flex flex-wrap gap-1.5">
        {c.services.slice(0, 3).map((s) => (
          <span key={s} className="rounded-full bg-paper-soft px-2 py-0.5 text-[10px] font-semibold text-ink-dim ring-1 ring-inset ring-ink/[0.06]">
            {SERVICE_META[s].label}
          </span>
        ))}
        {c.services.length > 3 && (
          <span className="text-[10px] text-ink-muted self-center">+{c.services.length - 3}</span>
        )}
      </div>

      <div className="mt-4 flex items-center justify-between border-t border-ink/[0.06] dark:border-white/[0.08] pt-3">
        <div>
          <div className="text-[14px] font-bold text-ink tabular-nums">
            {formatMinor(c.priceMinor, "USD")}
            <span className="text-[10.5px] font-normal text-ink-muted"> / {c.sessionMinutes} min</span>
          </div>
          <div className="text-[10px] text-ink-muted mt-0.5">
            {c.rating
              ? `★ ${c.rating.average.toFixed(1)} · ${c.rating.count} review${c.rating.count === 1 ? "" : "s"}`
              : "New on Polaris"}
            {" · "}~{c.responseHours}h response
          </div>
        </div>
        {pending ? (
          <span className="rounded-full bg-paper-soft px-3 py-1.5 text-[11px] font-semibold text-ink-muted">
            Verifying…
          </span>
        ) : c.freeFirstSession && c.freeSessionEligible ? (
          <span className="rounded-full bg-aurora-100 dark:bg-aurora-400/15 px-3 py-1.5 text-[11px] font-bold text-aurora-700 dark:text-aurora-100">
            First session free
          </span>
        ) : (
          <span className="rounded-full bg-ink text-paper px-3 py-1.5 text-[11px] font-semibold">
            Book now
          </span>
        )}
      </div>
    </motion.button>
  );
}

function AvatarOrb({ c, size }: { c: ConsultantView; size: number }) {
  const initials = c.name.split(/\s+/).slice(0, 2).map((s) => s[0]).join("");
  return (
    <span
      className={cn("inline-flex shrink-0 items-center justify-center rounded-full text-white font-bold bg-gradient-to-br shadow-md", TONE[c.avatarTone])}
      style={{ width: size, height: size, fontSize: size * 0.34 }}
    >
      {initials}
    </span>
  );
}

function VerifiedBadge({ status }: { status: VerificationStatus }) {
  if (status === "pending") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-paper-soft px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-ink-muted ring-1 ring-inset ring-ink/10">
        Pending
      </span>
    );
  }
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide ring-1 ring-inset",
        status === "featured"
          ? "bg-polaris-100 text-polaris-700 ring-polaris-300 dark:bg-polaris-400/20 dark:text-polaris-100 dark:ring-polaris-400/40"
          : "bg-aurora-100 text-aurora-700 ring-aurora-400/40 dark:bg-aurora-400/15 dark:text-aurora-100 dark:ring-aurora-400/30",
      )}
      title="Verified by Polaris"
    >
      <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5" /></svg>
      {status === "featured" ? "Featured" : "Verified"}
    </span>
  );
}

function FilterPill({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "rounded-full px-3 py-1.5 text-[12px] font-medium ring-1 ring-inset transition-colors",
        active
          ? "bg-ink text-paper ring-ink"
          : "bg-paper-card text-ink-dim ring-polaris-500/15 hover:ring-polaris-400/40 dark:ring-white/[0.12]",
      )}
    >
      {children}
    </button>
  );
}

/* ═══ Profile + booking modal ═══ */

function ProfileModal({ c, onClose, demo = false, basePath = "" }: { c: ConsultantView; onClose: () => void; demo?: boolean; basePath?: string }) {
  const [service, setService] = useState<ServiceKey>(c.services[0]);
  const [type, setType] = useState<ConsultationType>(c.types[0]);
  const [slot, setSlot] = useState<string | null>(null);
  const [method, setMethod] = useState<PayMethod>("bkash");
  const [state, setState] = useState<BookingState>({ step: "idle" });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [otp, setOtp] = useState("");

  const pending = c.verification === "pending";
  const free = c.freeFirstSession && c.freeSessionEligible;
  const fee = Math.round((c.priceMinor * PLATFORM_FEE_PCT) / 100);

  // Slots grouped by day for the timeline.
  const days = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const iso of c.slots) {
      const d = new Date(iso);
      const key = d.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });
      map.set(key, [...(map.get(key) ?? []), iso]);
    }
    return [...map.entries()].slice(0, 7);
  }, [c.slots]);

  async function book() {
    if (!slot) { setError("Pick a time slot first."); return; }
    setBusy(true);
    setError(null);
    try {
      if (demo) { setState({ step: "done", free: true }); return; }
      const r = await fetch("/api/consultants/bookings", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          consultantId: c.id, service, type, slotIso: slot,
          method: free ? undefined : method,
          useFreeSession: free,
        }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) { setError(d?.error ?? "Booking failed - try again."); return; }
      if (d.booking.freeSession) {
        setState({ step: "done", free: true });
      } else {
        setState({ step: "paying", bookingId: d.booking.id, transactionId: d.transaction.id });
      }
    } finally {
      setBusy(false);
    }
  }

  async function pay() {
    if (state.step !== "paying") return;
    setBusy(true);
    setError(null);
    try {
      const confirm = await fetch(`/api/transactions/${state.transactionId}/confirm`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(method === "card" ? {} : { otp }),
      });
      const cd = await confirm.json().catch(() => ({}));
      if (!confirm.ok) { setError(cd?.error ?? "Payment failed."); return; }
      if (cd?.transaction?.status !== "succeeded") {
        setError(cd?.transaction?.failureReason ?? "Payment didn't go through - try again.");
        return;
      }
      const promote = await fetch(`/api/consultants/bookings/${state.bookingId}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "confirm-payment" }),
      });
      if (!promote.ok) { setError("Payment received - refresh Bookings to see the session."); return; }
      setState({ step: "done", free: false });
    } finally {
      setBusy(false);
    }
  }

  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-6 bg-ink/45 backdrop-blur-sm"
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      onClick={onClose}
    >
      <motion.div
        onClick={(e) => e.stopPropagation()}
        initial={{ opacity: 0, y: 40, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 30, scale: 0.97 }}
        transition={{ type: "spring", stiffness: 360, damping: 30 }}
        className="w-full sm:max-w-2xl max-h-[92vh] overflow-y-auto scroll-y rounded-t-3xl sm:rounded-3xl bg-paper-card ring-1 ring-inset ring-polaris-500/15 dark:ring-white/[0.12] shadow-pop"
      >
        {/* Header */}
        <div className="p-6 pb-4 flex items-start gap-4">
          <AvatarOrb c={c} size={56} />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-serif text-[20px] font-bold text-ink">{c.name}</span>
              <VerifiedBadge status={c.verification} />
            </div>
            <div className="text-[12px] text-ink-muted mt-0.5">{c.background} · {c.countries.join(", ")}</div>
            <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-ink-dim">
              <span>{c.rating ? `★ ${c.rating.average.toFixed(1)} (${c.rating.count})` : "New on Polaris"}</span>
              <span>~{c.responseHours}h response</span>
              <span>{c.studentsGuided}+ students guided</span>
              <span>{c.languages.join(" · ")}</span>
            </div>
          </div>
          <button onClick={onClose} className="text-ink-muted hover:text-ink p-1.5 -m-1.5 transition-colors" aria-label="Close">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M18 6L6 18M6 6l12 12" /></svg>
          </button>
        </div>

        <div className="px-6 pb-6 space-y-5">
          <p className="text-[13px] text-ink-dim leading-relaxed">{c.bio}</p>

          {pending ? (
            <div className="rounded-2xl bg-paper-soft px-4 py-4 text-[12.5px] text-ink-dim">
              This consultant is completing Polaris verification. Booking opens once
              their identity, background, and free-session commitment are confirmed.
            </div>
          ) : state.step === "done" ? (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
              className="rounded-2xl bg-aurora-50 dark:bg-aurora-400/10 ring-1 ring-inset ring-aurora-400/40 px-5 py-6 text-center"
            >
              <div className="mx-auto h-11 w-11 rounded-full bg-aurora-500 text-white flex items-center justify-center">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5" /></svg>
              </div>
              <div className="mt-3 text-[15px] font-bold text-ink">
                {state.free ? "Free session booked" : "Session booked & paid"}
              </div>
              <p className="mt-1 text-[12.5px] text-ink-dim">
                {slot && new Date(slot).toLocaleString("en-GB", { weekday: "long", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                {" · "}{CONSULTATION_TYPE_META[type].label} with {c.name}
              </p>
              <Link href={`${basePath}/bookings`} className="mt-4 inline-flex rounded-full bg-ink text-paper px-5 py-2.5 text-[12.5px] font-semibold hover:bg-polaris-700 transition-colors">
                View my bookings →
              </Link>
            </motion.div>
          ) : (
            <>
              {/* Service + type */}
              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <Label>Service</Label>
                  <div className="flex flex-wrap gap-1.5">
                    {c.services.map((s) => (
                      <Chip key={s} active={service === s} onClick={() => setService(s)}>{SERVICE_META[s].label}</Chip>
                    ))}
                  </div>
                </div>
                <div>
                  <Label>Format</Label>
                  <div className="flex flex-wrap gap-1.5">
                    {c.types.map((t) => (
                      <Chip key={t} active={type === t} onClick={() => setType(t)}>{CONSULTATION_TYPE_META[t].label}</Chip>
                    ))}
                  </div>
                </div>
              </div>

              {/* Availability timeline */}
              <div>
                <Label>Availability - next two weeks (your local time)</Label>
                {days.length === 0 ? (
                  <div className="text-[12px] text-ink-muted">Fully booked right now - check back soon.</div>
                ) : (
                  <div className="space-y-2">
                    {days.map(([day, isos]) => (
                      <div key={day} className="flex items-center gap-2.5">
                        <span className="w-[88px] shrink-0 text-[11px] font-semibold text-ink-dim">{day}</span>
                        <div className="flex flex-wrap gap-1.5">
                          {isos.map((iso) => (
                            <Chip key={iso} active={slot === iso} onClick={() => setSlot(iso)}>
                              {new Date(iso).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}
                            </Chip>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Price breakdown - transparent fee */}
              <div className="rounded-2xl bg-paper-soft px-4 py-3.5">
                {free ? (
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-[13px] font-bold text-ink">First session - free</div>
                      <div className="text-[11px] text-ink-muted mt-0.5">
                        Verified consultant commitment · normally {formatMinor(c.priceMinor, "USD")}
                      </div>
                    </div>
                    <span className="rounded-full bg-aurora-100 dark:bg-aurora-400/15 px-3 py-1 text-[11px] font-bold text-aurora-700 dark:text-aurora-100">$0</span>
                  </div>
                ) : (
                  <div className="space-y-1 text-[12px]">
                    <Row k={`Session (${c.sessionMinutes} min)`} v={formatMinor(c.priceMinor - fee, "USD")} />
                    <Row k={`Polaris platform fee (${PLATFORM_FEE_PCT}%)`} v={formatMinor(fee, "USD")} />
                    <div className="h-px bg-ink/[0.07] my-1.5" />
                    <Row k="Total" v={formatMinor(c.priceMinor, "USD")} bold />
                    <div className="text-[10.5px] text-ink-muted pt-1">
                      The consultant receives {formatMinor(c.priceMinor - fee, "USD")}. No hidden charges.
                    </div>
                  </div>
                )}
              </div>

              {/* Payment method for paid sessions */}
              {!free && state.step !== "paying" && (
                <div>
                  <Label>Pay with</Label>
                  <div className="flex gap-2">
                    {(["bkash", "nagad", "rocket", "card"] as PayMethod[]).map((m) => (
                      <button
                        key={m}
                        onClick={() => setMethod(m)}
                        className={cn(
                          "rounded-xl p-1 ring-2 transition-all",
                          method === m ? "ring-polaris-400 scale-105" : "ring-transparent opacity-75 hover:opacity-100",
                        )}
                        aria-label={m}
                      >
                        <PaymentLogo method={m} size="md" />
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* OTP step for wallet payment */}
              {state.step === "paying" && (
                <div className="rounded-2xl ring-1 ring-inset ring-polaris-400/40 bg-polaris-50 dark:bg-polaris-400/10 px-4 py-4">
                  <div className="text-[12.5px] font-semibold text-ink">Confirm payment</div>
                  {method !== "card" && (
                    <input
                      value={otp}
                      onChange={(e) => setOtp(e.target.value)}
                      placeholder="Enter the OTP sent to your wallet (sandbox: any 4+ digits)"
                      className="mt-2 w-full rounded-xl border border-polaris-200 bg-paper-card px-3 py-2 text-sm text-ink placeholder:text-ink-muted/60 focus:border-polaris-400 focus:outline-none dark:border-white/[0.14]"
                      maxLength={8}
                    />
                  )}
                  <button
                    onClick={pay}
                    disabled={busy || (method !== "card" && otp.trim().length < 4)}
                    className="mt-3 w-full rounded-full bg-ink text-paper py-2.5 text-[13px] font-semibold hover:bg-polaris-700 transition-colors disabled:opacity-50"
                  >
                    {busy ? "Processing…" : `Pay ${formatMinor(c.priceMinor, "USD")}`}
                  </button>
                </div>
              )}

              {error && <div className="text-[12px] text-rose-600 dark:text-rose-300">{error}</div>}

              {state.step !== "paying" && (
                <button
                  onClick={book}
                  disabled={busy || !slot}
                  className="w-full rounded-full bg-ink text-paper py-3 text-[13.5px] font-semibold hover:bg-polaris-700 transition-colors disabled:opacity-50"
                >
                  {busy ? "Booking…" : free ? "Book free session" : "Reserve slot & continue to payment"}
                </button>
              )}
            </>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return <div className="text-[11px] uppercase tracking-[0.16em] font-semibold text-ink-muted mb-2">{children}</div>;
}
function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "rounded-full px-3 py-1.5 text-[12px] font-medium ring-1 ring-inset transition-colors",
        active
          ? "bg-polaris-100 text-polaris-700 ring-polaris-300 dark:bg-polaris-400/25 dark:text-polaris-100 dark:ring-polaris-400/50"
          : "bg-paper-card text-ink-dim ring-polaris-500/15 hover:ring-polaris-400/40 dark:ring-white/[0.12]",
      )}
    >
      {children}
    </button>
  );
}
function Row({ k, v, bold }: { k: string; v: string; bold?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <span className={cn(bold ? "font-bold text-ink" : "text-ink-dim")}>{k}</span>
      <span className={cn("tabular-nums", bold ? "font-bold text-ink" : "text-ink-dim")}>{v}</span>
    </div>
  );
}


