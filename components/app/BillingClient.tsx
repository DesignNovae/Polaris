"use client";

/**
 * BillingClient - the full subscription console.
 *
 *   Current-plan hero    - status, price, cycle, renewal date, cancel/resume
 *   Cycle toggle         - monthly / yearly (two months free on yearly)
 *   3D pricing cards     - animated price swap, popular glow, real plan gates
 *   Billing summary      - next invoice, default method, lifetime spend
 *   Payment methods      - saved instruments, add (display-safe), default, remove
 *
 * All money movement is the sandbox checkout (CheckoutModal → /api/transactions).
 * A successful payment writes real subscription state server-side; this screen
 * re-reads it on refresh. Swapping in Stripe/SSLCommerz later only replaces
 * the modal's confirm step.
 */

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { CheckoutModal } from "./CheckoutModal";
import { PaymentLogo, CardBrandMark } from "./PaymentLogos";
import { PLAN_CATALOG, formatMinor, planDescription, type BillingCycle, type PlanId } from "@/lib/billing/plans";
import { Icon } from "./ui";
import { cn } from "@/lib/cn";

export type SubscriptionDto = {
  status?: string;
  planId?: string;
  billingCycle?: "monthly" | "yearly";
  startedAt?: string;
  renewsAt?: string;
  canceledAt?: string;
  priceMinor?: number;
  currency?: string;
} | null;

export type MethodDto = {
  id: string;
  type: "card" | "bkash" | "nagad" | "rocket";
  label: string;
  last4: string;
  brand?: string;
  isDefault: boolean;
};

export function BillingClient({
  plan, subscription, methods: initialMethods, lifetimeSpend, succeededCount,
}: {
  plan: PlanId;
  subscription: SubscriptionDto;
  methods: MethodDto[];
  lifetimeSpend: Array<{ currency: string; minor: number }>;
  succeededCount: number;
}) {
  const router = useRouter();
  const [cycle, setCycle] = useState<BillingCycle>(subscription?.billingCycle ?? "yearly");
  const [checkout, setCheckout] = useState<null | { id: "pro" | "elite" }>(null);
  const [methods, setMethods] = useState<MethodDto[]>(initialMethods);
  const [addOpen, setAddOpen] = useState(false);
  const [subBusy, setSubBusy] = useState(false);

  const choice = useMemo(() => {
    if (!checkout) return null;
    const def = PLAN_CATALOG.find((p) => p.id === checkout.id)!;
    return {
      id: checkout.id,
      name: planDescription(checkout.id, cycle),
      amountUSDcents: def.usd[cycle],
      amountBDTpaisa: def.bdt[cycle],
    };
  }, [checkout, cycle]);

  const canceled = subscription?.status === "canceled";
  const isPaid = plan !== "free";

  async function subscriptionAction(action: "cancel" | "resume") {
    setSubBusy(true);
    try {
      const r = await fetch("/api/billing/subscription", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action }),
      });
      if (r.ok) router.refresh();
    } finally {
      setSubBusy(false);
    }
  }

  async function refreshMethods() {
    const r = await fetch("/api/billing/methods", { cache: "no-store" });
    if (r.ok) setMethods(((await r.json()) as { methods: MethodDto[] }).methods);
  }

  return (
    <div className="space-y-6">
      {/* ─── Current plan hero ─── */}
      <motion.div
        initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
        className="relative overflow-hidden rounded-3xl p-6 text-white shadow-pop"
        style={{ background: "linear-gradient(135deg, #3D2A1A 0%, #5C3D26 45%, #8B5E3C 110%)" }}
      >
        <div className="absolute -top-16 -right-16 h-56 w-56 rounded-full bg-white/[0.06] blur-2xl" aria-hidden />
        <div className="absolute bottom-0 right-8 opacity-[0.08]" aria-hidden>
          <svg width="160" height="160" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l2.1 7.9L22 12l-7.9 2.1L12 22l-2.1-7.9L2 12l7.9-2.1z"/></svg>
        </div>
        <div className="relative flex flex-wrap items-start gap-x-8 gap-y-4">
          <div className="min-w-0">
            <div className="text-[10px] uppercase tracking-[0.25em] text-white/60 font-bold mb-1">Current plan</div>
            <div className="flex items-center gap-2.5 flex-wrap">
              <span className="font-serif text-[30px] font-bold tracking-tight leading-none">
                Polaris {plan[0].toUpperCase() + plan.slice(1)}
              </span>
              <StatusChip status={isPaid ? (subscription?.status ?? "active") : "free"} />
            </div>
            {isPaid && subscription?.priceMinor != null && subscription.currency && (
              <div className="mt-2 text-[12.5px] text-white/75">
                {formatMinor(subscription.priceMinor, subscription.currency)} / {subscription.billingCycle === "monthly" ? "month" : "year"}
                {subscription.renewsAt && (
                  <> · {canceled ? "access until" : "renews"} <span className="font-mono">{fmtDate(subscription.renewsAt)}</span></>
                )}
              </div>
            )}
            {!isPaid && <div className="mt-2 text-[12.5px] text-white/75">Forever free - upgrade when the roadmap outgrows it.</div>}
          </div>
          <div className="ml-auto flex items-center gap-2 flex-wrap">
            {isPaid && (canceled ? (
              <button onClick={() => void subscriptionAction("resume")} disabled={subBusy}
                className="h-9 px-4 rounded-full bg-white text-ink text-[12.5px] font-semibold hover:bg-white/90 transition-colors disabled:opacity-50">
                {subBusy ? "…" : "Resume subscription"}
              </button>
            ) : (
              <button onClick={() => void subscriptionAction("cancel")} disabled={subBusy}
                className="h-9 px-4 rounded-full bg-white/10 ring-1 ring-inset ring-white/25 text-white text-[12.5px] font-medium hover:bg-white/20 transition-colors disabled:opacity-50">
                {subBusy ? "…" : "Cancel renewal"}
              </button>
            ))}
            <a href="/transactions" className="h-9 px-4 rounded-full bg-white/10 ring-1 ring-inset ring-white/25 text-white text-[12.5px] font-medium hover:bg-white/20 transition-colors inline-flex items-center">
              Transactions →
            </a>
          </div>
        </div>
        {canceled && (
          <div className="relative mt-4 rounded-xl bg-white/10 px-4 py-2.5 text-[12px] text-white/85">
            Renewal is canceled - you keep every {plan} feature until {subscription?.renewsAt ? fmtDate(subscription.renewsAt) : "the period ends"}, then drop to Free. Resume anytime before that.
          </div>
        )}
      </motion.div>

      {/* ─── Cycle toggle ─── */}
      <div className="flex items-center justify-center gap-3">
        <div className="relative inline-flex rounded-full bg-paper-card hairline p-1">
          {(["monthly", "yearly"] as BillingCycle[]).map((c) => (
            <button
              key={c}
              onClick={() => setCycle(c)}
              className={cn(
                "relative z-10 h-8 px-5 rounded-full text-[12.5px] font-semibold transition-colors",
                cycle === c ? "text-paper" : "text-ink-dim hover:text-ink",
              )}
            >
              {cycle === c && (
                <motion.span layoutId="cycle-pill" className="absolute inset-0 rounded-full bg-ink" transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }} />
              )}
              <span className="relative capitalize">{c}</span>
            </button>
          ))}
        </div>
        <span className={cn(
          "text-[10.5px] font-bold uppercase tracking-wider rounded-full px-2.5 py-1 ring-1 ring-inset transition-opacity",
          "bg-aurora-100 text-aurora-700 ring-aurora-400/40 dark:bg-aurora-400/15 dark:text-aurora-100 dark:ring-aurora-400/30",
          cycle === "yearly" ? "opacity-100" : "opacity-40",
        )}>
          2 months free
        </span>
      </div>

      {/* ─── Pricing cards ─── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-stretch">
        {PLAN_CATALOG.map((def, i) => (
          <PricingCard
            key={def.id}
            def={def}
            cycle={cycle}
            currentPlan={plan}
            delay={i * 0.07}
            onSelect={def.id !== "free" && def.id !== plan ? () => setCheckout({ id: def.id as "pro" | "elite" }) : undefined}
          />
        ))}
      </div>

      {/* ─── Summary + payment methods ─── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <SummaryCard
          subscription={subscription}
          plan={plan}
          lifetimeSpend={lifetimeSpend}
          succeededCount={succeededCount}
          defaultMethod={methods.find((m) => m.isDefault) ?? null}
        />
        <MethodsPanel
          methods={methods}
          onAdd={() => setAddOpen(true)}
          onChanged={refreshMethods}
        />
      </div>

      {/* ─── Sandbox note ─── */}
      <div className="app-glass rounded-2xl px-4 py-3 flex items-start gap-3">
        <span className="text-polaris-500 mt-0.5 shrink-0">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></svg>
        </span>
        <p className="text-[11.5px] text-ink-dim leading-relaxed">
          <span className="font-semibold text-ink">Sandbox billing.</span> Card, bKash, Nagad, and Rocket run in demo mode - no real money moves, but every flow is end-to-end: plans activate, transactions ledger, receipts generate, and subscription state updates. The gateway layer is abstracted so production processors drop in without UI changes.
        </p>
      </div>

      {choice && (
        <CheckoutModal
          open
          onClose={() => setCheckout(null)}
          plan={choice}
          onSuccess={() => {
            void refreshMethods();
            setTimeout(() => router.refresh(), 600);
          }}
        />
      )}
      <AnimatePresence>
        {addOpen && <AddMethodModal onClose={() => setAddOpen(false)} onAdded={async () => { await refreshMethods(); setAddOpen(false); }} />}
      </AnimatePresence>
    </div>
  );
}

/* ─── status chip ─── */

function StatusChip({ status }: { status: string }) {
  const meta: Record<string, { label: string; cls: string }> = {
    active:   { label: "Active",   cls: "bg-aurora-400/25 text-aurora-100 ring-aurora-300/40" },
    free:     { label: "Free",     cls: "bg-white/15 text-white/85 ring-white/25" },
    canceled: { label: "Canceled - ends at period", cls: "bg-nova-400/25 text-nova-100 ring-nova-300/40" },
    past_due: { label: "Past due", cls: "bg-rose-400/25 text-rose-100 ring-rose-300/40" },
    trial:    { label: "Trial",    cls: "bg-polaris-400/25 text-polaris-100 ring-polaris-300/40" },
  };
  const m = meta[status] ?? meta.active;
  return (
    <span className={cn("text-[9.5px] uppercase tracking-wider font-bold rounded-full px-2 py-[3px] ring-1 ring-inset", m.cls)}>
      {m.label}
    </span>
  );
}

/* ─── pricing card ─── */

function PricingCard({
  def, cycle, currentPlan, delay, onSelect,
}: {
  def: (typeof PLAN_CATALOG)[number];
  cycle: BillingCycle;
  currentPlan: PlanId;
  delay: number;
  onSelect?: () => void;
}) {
  const active = def.id === currentPlan;
  const usd = def.usd[cycle];
  const bdt = def.bdt[cycle];
  const order: PlanId[] = ["free", "pro", "elite"];
  const isUpgrade = order.indexOf(def.id) > order.indexOf(currentPlan);

  return (
    <motion.div
      initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, delay, ease: [0.16, 1, 0.3, 1] }}
      whileHover={{ y: -6, rotateX: 1.2, rotateY: -1.2, transition: { duration: 0.25 } }}
      style={{ transformStyle: "preserve-3d", perspective: 900 }}
      className={cn(
        "relative rounded-3xl p-5 flex flex-col bg-paper-card ring-1 ring-inset transition-shadow",
        def.popular && !active
          ? "ring-polaris-400/60 shadow-[0_18px_40px_-18px_rgba(139,94,60,0.45)] dark:ring-polaris-400/40"
          : "ring-polaris-500/12 dark:ring-white/[0.12]",
        active && "ring-2 ring-aurora-400/70",
      )}
    >
      {def.popular && !active && (
        <span className="absolute -top-3 left-1/2 -translate-x-1/2 text-[9.5px] uppercase tracking-wider font-bold rounded-full px-3 py-1 bg-ink text-paper shadow-md">
          Most popular
        </span>
      )}
      {active && (
        <span className="absolute -top-3 left-1/2 -translate-x-1/2 text-[9.5px] uppercase tracking-wider font-bold rounded-full px-3 py-1 bg-aurora-500 text-white shadow-md">
          Your plan
        </span>
      )}

      <div className="font-serif text-[19px] font-bold text-ink">{def.name}</div>
      <div className="text-[11px] text-ink-muted mt-0.5">{def.audience}</div>

      <div className="mt-4 h-[58px]">
        <AnimatePresence mode="wait">
          <motion.div
            key={cycle}
            initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2 }}
          >
            <div className="flex items-baseline gap-1.5">
              <span className="font-serif text-[32px] font-bold text-ink tabular-nums leading-none">
                {usd === 0 ? "$0" : formatMinor(usd, "USD")}
              </span>
              <span className="text-[11.5px] text-ink-dim">{usd === 0 ? "forever" : cycle === "monthly" ? "/ month" : "/ year"}</span>
            </div>
            {bdt > 0 && <div className="text-[11px] font-mono text-ink-muted mt-1">{formatMinor(bdt, "BDT")} {cycle === "monthly" ? "/ mo" : "/ yr"} with bKash</div>}
          </motion.div>
        </AnimatePresence>
      </div>

      <ul className="mt-3 space-y-2 flex-1">
        {def.features.map((f) => (
          <li key={f} className="flex items-start gap-2 text-[12px] text-ink-dim leading-snug">
            <span className={cn("mt-0.5 shrink-0", def.accent === "aurora" ? "text-aurora-600 dark:text-aurora-300" : "text-polaris-500 dark:text-polaris-300")}>
              <Icon.check size={11} />
            </span>
            {f}
          </li>
        ))}
        {def.comingSoon?.map((f) => (
          <li key={f} className="flex items-start gap-2 text-[12px] text-ink-muted leading-snug">
            <span className="mt-0.5 shrink-0 text-ink-faint" aria-hidden>
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" />
              </svg>
            </span>
            <span>
              {f}
              <span className="ml-1.5 align-middle rounded-full bg-paper-soft px-1.5 py-0.5 text-[8.5px] uppercase tracking-[0.12em] font-bold text-ink-muted ring-1 ring-inset ring-ink/10 dark:ring-white/[0.12]">
                Soon
              </span>
            </span>
          </li>
        ))}
      </ul>

      {onSelect ? (
        <button
          onClick={onSelect}
          className={cn(
            "mt-5 w-full h-10 rounded-full text-[13px] font-semibold transition-all",
            def.popular || isUpgrade
              ? "bg-ink text-paper hover:bg-polaris-700 hover:shadow-md"
              : "bg-paper-soft text-ink hairline hover:bg-paper-deep",
          )}
        >
          {isUpgrade ? `Upgrade to ${def.name}` : `Switch to ${def.name}`}
        </button>
      ) : (
        <div className={cn(
          "mt-5 w-full h-10 rounded-full text-[12.5px] font-semibold inline-flex items-center justify-center gap-1.5",
          active ? "bg-aurora-100 text-aurora-700 dark:bg-aurora-400/15 dark:text-aurora-100" : "bg-paper-soft text-ink-muted",
        )}>
          {active && <Icon.check size={11} />} {active ? "Active" : "Included"}
        </div>
      )}
    </motion.div>
  );
}

/* ─── billing summary ─── */

function SummaryCard({
  subscription, plan, lifetimeSpend, succeededCount, defaultMethod,
}: {
  subscription: SubscriptionDto;
  plan: PlanId;
  lifetimeSpend: Array<{ currency: string; minor: number }>;
  succeededCount: number;
  defaultMethod: MethodDto | null;
}) {
  const renewing = plan !== "free" && subscription?.status === "active";
  return (
    <div className="app-glass rounded-2xl p-5">
      <div className="text-[10.5px] uppercase tracking-[0.22em] text-ink-muted font-medium mb-3.5">Billing summary</div>
      <dl className="space-y-2.5 text-[12.5px]">
        <SummaryRow k="Next invoice" v={
          renewing && subscription?.renewsAt && subscription.priceMinor != null && subscription.currency
            ? `${formatMinor(subscription.priceMinor, subscription.currency)} on ${fmtDate(subscription.renewsAt)}`
            : subscription?.status === "canceled" ? "None - renewal canceled" : "None"
        } />
        <SummaryRow k="Billing cycle" v={subscription?.billingCycle ? subscription.billingCycle[0].toUpperCase() + subscription.billingCycle.slice(1) : "-"} />
        <SummaryRow k="Member since" v={subscription?.startedAt ? fmtDate(subscription.startedAt) : "-"} />
        <SummaryRow k="Default method" v={defaultMethod?.label ?? "None saved"} />
        <SummaryRow k="Successful payments" v={String(succeededCount)} />
        <SummaryRow k="Lifetime spend" v={
          lifetimeSpend.length === 0 ? "-" : lifetimeSpend.map((s) => formatMinor(s.minor, s.currency)).join(" + ")
        } />
      </dl>
    </div>
  );
}

function SummaryRow({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <dt className="text-ink-muted">{k}</dt>
      <dd className="text-ink font-medium text-right">{v}</dd>
    </div>
  );
}

/* ─── payment methods ─── */

function MethodsPanel({
  methods, onAdd, onChanged,
}: {
  methods: MethodDto[];
  onAdd: () => void;
  onChanged: () => Promise<void>;
}) {
  const [busyId, setBusyId] = useState<string | null>(null);

  async function act(id: string, verb: "default" | "remove") {
    setBusyId(id);
    try {
      await fetch(`/api/billing/methods/${id}`, { method: verb === "default" ? "PUT" : "DELETE" });
      await onChanged();
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="app-glass rounded-2xl p-5">
      <div className="flex items-center mb-3.5">
        <div className="text-[10.5px] uppercase tracking-[0.22em] text-ink-muted font-medium">Payment methods</div>
        <button onClick={onAdd} className="ml-auto text-[11.5px] font-semibold text-polaris-600 dark:text-polaris-300 hover:underline">
          + Add method
        </button>
      </div>
      {methods.length === 0 ? (
        <div className="rounded-xl bg-paper-soft px-4 py-6 text-center">
          <div className="text-[12.5px] text-ink-dim">No saved methods yet.</div>
          <div className="text-[11px] text-ink-muted mt-1">Save one at checkout, or add one here - only the last 4 digits are ever stored.</div>
        </div>
      ) : (
        <ul className="space-y-2">
          {methods.map((m) => (
            <li key={m.id} className="flex items-center gap-3 rounded-xl bg-paper-soft px-3.5 py-2.5">
              {m.type === "card" && m.brand ? (
                <span className="h-7 w-10 rounded-lg inline-flex items-center justify-center shrink-0 shadow-sm"
                  style={{ background: "linear-gradient(135deg, #1F2937 0%, #4B5563 120%)" }}>
                  <CardBrandMark brand={m.brand} height={m.brand === "mastercard" ? 14 : 9} />
                </span>
              ) : (
                <PaymentLogo method={m.type} size="sm" />
              )}
              <div className="min-w-0 flex-1">
                <div className="text-[12.5px] font-semibold text-ink truncate">{m.label}</div>
                {m.isDefault && <div className="text-[10px] uppercase tracking-wider font-bold text-aurora-700 dark:text-aurora-200">Default</div>}
              </div>
              {!m.isDefault && (
                <button onClick={() => void act(m.id, "default")} disabled={busyId === m.id}
                  className="text-[11px] font-medium text-ink-dim hover:text-ink disabled:opacity-50">
                  Make default
                </button>
              )}
              <button onClick={() => void act(m.id, "remove")} disabled={busyId === m.id}
                className="text-[11px] font-medium text-rose-600 dark:text-rose-300 hover:underline disabled:opacity-50">
                Remove
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/* ─── add-method modal ─── */

function AddMethodModal({ onClose, onAdded }: { onClose: () => void; onAdded: () => Promise<void> }) {
  const [type, setType] = useState<MethodDto["type"]>("card");
  const [value, setValue] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const isCard = type === "card";

  async function save() {
    setErr(null);
    const digits = value.replace(/\D/g, "");
    if (isCard && digits.length < 12) { setErr("Enter the full card number - we keep only the last 4 digits."); return; }
    if (!isCard && !/^01[3-9]\d{8}$/.test(digits)) { setErr("Enter a valid BD mobile number (01XXXXXXXXX)."); return; }
    setBusy(true);
    try {
      const brand = isCard
        ? /^4/.test(digits) ? "visa" : /^(5[1-5]|2[2-7])/.test(digits) ? "mastercard" : /^3[47]/.test(digits) ? "amex" : undefined
        : undefined;
      const r = await fetch("/api/billing/methods", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ type, last4: digits.slice(-4), brand }),
      });
      if (!r.ok) { setErr("Couldn't save the method."); return; }
      await onAdded();
    } finally {
      setBusy(false);
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.18 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/45 backdrop-blur-sm p-4"
      role="dialog" aria-modal="true" onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.95, y: 12, opacity: 0 }} animate={{ scale: 1, y: 0, opacity: 1 }} exit={{ scale: 0.95, y: 12, opacity: 0 }}
        transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-[400px] rounded-3xl bg-paper-card shadow-pop ring-1 ring-inset ring-polaris-500/10 dark:ring-white/[0.12] p-6"
      >
        <div className="flex items-start justify-between mb-4">
          <h2 className="font-serif text-[18px] font-bold text-ink">Add payment method</h2>
          <button onClick={onClose} className="text-ink-muted hover:text-ink p-1" aria-label="Close"><Icon.close /></button>
        </div>
        <div className="grid grid-cols-4 gap-1.5 mb-4">
          {(["card", "bkash", "nagad", "rocket"] as const).map((t) => (
            <button key={t} onClick={() => { setType(t); setValue(""); setErr(null); }}
              className={cn(
                "flex flex-col items-center gap-1 py-2 rounded-xl text-[10.5px] font-semibold ring-1 ring-inset transition-all",
                type === t
                  ? "bg-polaris-50 text-polaris-700 ring-2 ring-polaris-400 dark:bg-polaris-400/15 dark:text-polaris-100"
                  : "bg-paper-soft text-ink-dim ring-polaris-500/15 hover:text-ink hover:-translate-y-px dark:ring-white/[0.12]",
              )}>
              <PaymentLogo method={t} size="sm" />
              {t === "bkash" ? "bKash" : t[0].toUpperCase() + t.slice(1)}
            </button>
          ))}
        </div>
        <input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          inputMode="numeric"
          placeholder={isCard ? "Card number" : "01XXXXXXXXX"}
          className="w-full h-10 px-3 rounded-xl bg-paper-soft hairline text-[13.5px] text-ink placeholder-ink-muted focus:outline-none focus:ring-2 focus:ring-polaris-400"
        />
        <p className="text-[10.5px] text-ink-muted mt-2 leading-relaxed">
          Display-safe storage: only the type, brand, and last 4 digits are saved - never the full number.
        </p>
        {err && <div className="mt-2 text-[12px] text-rose-600 dark:text-rose-300">{err}</div>}
        <button onClick={() => void save()} disabled={busy}
          className="mt-4 w-full h-10 rounded-full bg-ink text-paper text-[13px] font-semibold hover:bg-polaris-700 transition-colors disabled:opacity-50">
          {busy ? "Saving…" : "Save method"}
        </button>
      </motion.div>
    </motion.div>
  );
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
}
