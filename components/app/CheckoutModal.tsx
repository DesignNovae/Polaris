"use client";

/**
 * CheckoutModal - fake-money payment UI with bKash + Card + Nagad + Rocket.
 *
 * Real-looking flows backed by /api/transactions:
 *   1. Open modal with plan + price.
 *   2. User picks method tab.
 *   3. Fills card (Luhn-validated, brand auto-detected) OR wallet phone.
 *   4. POST /api/transactions → returns pending tx.id.
 *   5. Card: confirm immediately; Wallet: 6-digit OTP screen first.
 *   6. POST /api/transactions/[id]/confirm → returns succeeded|failed.
 *   7. Receipt screen with reference id + next steps.
 *
 * No real money moves. All flows simulate ~1s of processing.
 */

import { useEffect, useMemo, useState } from "react";
import { PaymentLogo, PaymentMark, CardBrandMark, PAYMENT_BRAND } from "./PaymentLogos";
import { cn } from "@/lib/cn";

type Method = "card" | "bkash" | "nagad" | "rocket";

type PlanChoice = {
  id: "pro" | "elite";
  /** Display name, e.g. "Polaris Pro (annual)" - matches transactions.description prefix. */
  name: string;
  /** Amount in minor units (cents for USD, paisa for BDT). */
  amountUSDcents: number;
  amountBDTpaisa: number;
};

type Props = {
  open: boolean;
  onClose: () => void;
  plan: PlanChoice;
  onSuccess?: () => void;
};

type Stage =
  | { kind: "method" }
  | { kind: "details" }
  | { kind: "otp"; txId: string }
  | { kind: "processing" }
  | { kind: "receipt"; status: "succeeded" | "failed"; reference: string; reason?: string };

export function CheckoutModal({ open, onClose, plan, onSuccess }: Props) {
  const [method, setMethod] = useState<Method>("card");
  const [stage, setStage] = useState<Stage>({ kind: "method" });

  // Card fields
  const [cardNumber, setCardNumber] = useState("");
  const [cardExp, setCardExp] = useState("");
  const [cardCvv, setCardCvv] = useState("");
  const [cardName, setCardName] = useState("");

  // Wallet fields
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");

  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [saveMethod, setSaveMethod] = useState(true);

  // Reset state on close + open.
  useEffect(() => {
    if (!open) return;
    setStage({ kind: "method" });
    setMethod("card");
    setCardNumber(""); setCardExp(""); setCardCvv(""); setCardName("");
    setPhone(""); setOtp("");
    setErr(null); setBusy(false); setSaveMethod(true);
  }, [open]);

  // Lock body scroll while open.
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, [open]);

  const brand = useMemo(() => detectCardBrand(cardNumber), [cardNumber]);
  const isBdMethod = method !== "card";
  const displayAmount = isBdMethod
    ? formatMoney(plan.amountBDTpaisa, "BDT")
    : formatMoney(plan.amountUSDcents, "USD");

  if (!open) return null;

  async function startPayment() {
    setErr(null);

    // Validate.
    if (method === "card") {
      if (!isLuhnValid(cardNumber.replace(/\s+/g, ""))) {
        setErr("That card number doesn't look right. Try 4242 4242 4242 4242 for a test pass.");
        return;
      }
      if (!/^\d{2}\/\d{2}$/.test(cardExp.trim())) {
        setErr("Expiry must be MM/YY.");
        return;
      }
      if (!/^\d{3,4}$/.test(cardCvv.trim())) {
        setErr("CVV must be 3 or 4 digits.");
        return;
      }
      if (cardName.trim().length < 2) {
        setErr("Cardholder name is required.");
        return;
      }
    } else {
      if (!/^01[3-9]\d{8}$/.test(phone.replace(/\s+/g, ""))) {
        setErr("Enter a valid Bangladeshi mobile number (01XXXXXXXXX).");
        return;
      }
    }

    setBusy(true);
    try {
      // 1. Create the pending transaction.
      const masked =
        method === "card"
          ? `•••• ${cardNumber.replace(/\s+/g, "").slice(-4)}`
          : `•••• ${phone.slice(-4)}`;
      const createRes = await fetch("/api/transactions", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          method,
          amount: isBdMethod ? plan.amountBDTpaisa : plan.amountUSDcents,
          currency: isBdMethod ? "BDT" : "USD",
          description: `${plan.name}`,
          maskedAccount: masked,
          cardBrand: method === "card" ? brand : undefined,
        }),
      });
      if (!createRes.ok) {
        const d = await createRes.json().catch(() => ({}));
        throw new Error(d.error ?? "Failed to start payment");
      }
      const { transaction: tx } = (await createRes.json()) as { transaction: { id: string } };

      if (method === "card") {
        // 2a. Card → confirm immediately.
        setStage({ kind: "processing" });
        await confirm(tx.id);
      } else {
        // 2b. Wallet → OTP screen.
        setStage({ kind: "otp", txId: tx.id });
        setBusy(false);
      }
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Something went wrong.");
      setBusy(false);
    }
  }

  async function confirm(txId: string, otpVal?: string) {
    setStage({ kind: "processing" });
    setBusy(true);
    try {
      const res = await fetch(`/api/transactions/${txId}/confirm`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(otpVal ? { otp: otpVal } : {}),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error ?? "Confirmation failed");
      }
      const { transaction: tx } = (await res.json()) as {
        transaction: { reference: string; status: "succeeded" | "failed"; failureReason?: string };
      };
      setStage({
        kind: "receipt",
        status: tx.status,
        reference: tx.reference,
        reason: tx.failureReason,
      });
      if (tx.status === "succeeded") {
        // Persist the (display-safe) payment method if asked - fire & forget.
        if (saveMethod) {
          const last4 = method === "card"
            ? cardNumber.replace(/\s+/g, "").slice(-4)
            : phone.slice(-4);
          if (/^\d{4}$/.test(last4)) {
            void fetch("/api/billing/methods", {
              method: "POST",
              headers: { "content-type": "application/json" },
              body: JSON.stringify({ type: method, last4, brand: method === "card" ? brand ?? undefined : undefined }),
            }).catch(() => {});
          }
        }
        onSuccess?.();
      }
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Confirmation failed.");
      setStage({ kind: "details" });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/60 backdrop-blur-sm px-4 animate-fadeUp" role="dialog" aria-modal="true">
      <div className="relative w-full max-w-[460px] bg-paper-card rounded-3xl shadow-pop ring-1 ring-inset ring-polaris-500/10 overflow-hidden">
        {/* Header */}
        <div
          className="px-6 pt-6 pb-5 text-white relative overflow-hidden"
          style={{
            background: "linear-gradient(135deg, #5C3D26 0%, #8B5E3C 60%, #C47D4E 130%)",
          }}
        >
          <button
            onClick={onClose}
            aria-label="Close"
            className="absolute top-3 right-3 h-8 w-8 inline-flex items-center justify-center rounded-full bg-white/15 hover:bg-white/25 text-white transition-colors"
          >
            ✕
          </button>
          <div className="text-[10.5px] uppercase tracking-[0.22em] text-white/75 font-medium mb-1">Checkout</div>
          <div className="font-serif text-[22px] font-bold tracking-tight leading-tight">{plan.name}</div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="font-serif text-[28px] font-bold tabular-nums leading-none">{displayAmount}</span>
            <span className="text-[11px] text-white/75 font-mono">one-time · sandbox</span>
          </div>
        </div>

        {/* Stage body */}
        <div className="p-6">
          {(stage.kind === "method" || stage.kind === "details") && (
            <>
              <MethodTabs method={method} onChange={(m) => { setMethod(m); setStage({ kind: "details" }); setErr(null); }} />
              <div className="mt-5">
                {method === "card" ? (
                  <CardFields
                    number={cardNumber}
                    setNumber={(v) => setCardNumber(formatCardNumber(v))}
                    exp={cardExp}
                    setExp={(v) => setCardExp(formatExpiry(v))}
                    cvv={cardCvv}
                    setCvv={(v) => setCardCvv(v.replace(/\D/g, "").slice(0, 4))}
                    name={cardName}
                    setName={setCardName}
                    brand={brand}
                  />
                ) : (
                  <WalletFields method={method} phone={phone} setPhone={(v) => setPhone(v.replace(/[^\d]/g, "").slice(0, 11))} />
                )}
              </div>
              {err && <div className="mt-3 text-[12.5px] text-rose-600">{err}</div>}
              <label className="mt-4 flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={saveMethod}
                  onChange={(e) => setSaveMethod(e.target.checked)}
                  className="h-3.5 w-3.5 rounded accent-[var(--c-polaris-500,#8B5E3C)]"
                />
                <span className="text-[11.5px] text-ink-dim">Save this payment method for faster checkout</span>
              </label>
              <button
                onClick={() => void startPayment()}
                disabled={busy}
                className="mt-5 w-full h-11 rounded-full bg-ink text-paper text-[13.5px] font-semibold inline-flex items-center justify-center gap-2 hover:bg-polaris-700 transition-colors disabled:opacity-50"
              >
                {busy ? "Working…" : `Pay ${displayAmount}`}
                {!busy && <span>→</span>}
              </button>
              <div className="mt-3 text-[10.5px] text-ink-muted text-center leading-relaxed">
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden className="inline -mt-0.5 mr-1"><rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></svg>
                Sandbox checkout - no real money moves. Use card <span className="font-mono">4242 4242 4242 4242</span> for a guaranteed pass.
              </div>
            </>
          )}

          {stage.kind === "otp" && (
            <OtpStage
              method={method}
              phone={phone}
              otp={otp}
              setOtp={(v) => setOtp(v.replace(/\D/g, "").slice(0, 6))}
              err={err}
              busy={busy}
              onConfirm={() => void confirm(stage.txId, otp)}
              onBack={() => setStage({ kind: "details" })}
            />
          )}

          {stage.kind === "processing" && <ProcessingStage method={method} />}

          {stage.kind === "receipt" && (
            <ReceiptStage
              status={stage.status}
              reference={stage.reference}
              reason={stage.reason}
              amount={displayAmount}
              description={plan.name}
              onClose={onClose}
              onRetry={() => setStage({ kind: "details" })}
            />
          )}
        </div>
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════════════
   STAGE COMPONENTS
   ════════════════════════════════════════════════════════════════════════ */

function MethodTabs({ method, onChange }: { method: Method; onChange: (m: Method) => void }) {
  return (
    <div className="grid grid-cols-4 gap-1.5">
      {(["card", "bkash", "nagad", "rocket"] as Method[]).map((id) => (
        <button
          key={id}
          onClick={() => onChange(id)}
          className={cn(
            "flex flex-col items-center gap-1.5 py-2.5 rounded-xl text-[11px] font-medium transition-all",
            method === id
              ? "bg-polaris-50 text-polaris-700 ring-2 ring-inset ring-polaris-400 shadow-sm dark:bg-polaris-400/15 dark:text-polaris-100"
              : "bg-paper-soft text-ink-dim hover:text-ink hover:bg-paper-card hairline hover:-translate-y-px",
          )}
        >
          <PaymentLogo method={id} size="sm" className={cn("transition-transform", method === id && "scale-110")} />
          {PAYMENT_BRAND[id].name}
        </button>
      ))}
    </div>
  );
}

function CardFields({
  number, setNumber, exp, setExp, cvv, setCvv, name, setName, brand,
}: {
  number: string; setNumber: (v: string) => void;
  exp: string; setExp: (v: string) => void;
  cvv: string; setCvv: (v: string) => void;
  name: string; setName: (v: string) => void;
  brand: string | null;
}) {
  return (
    <div className="space-y-3">
      {/* Faux card preview */}
      <div className="relative h-[140px] rounded-2xl p-4 text-white overflow-hidden shadow-md"
        style={{ background: "linear-gradient(135deg, #1F2937 0%, #374151 60%, #4B5563 130%)" }}>
        <div className="absolute -top-10 -right-10 h-32 w-32 rounded-full bg-white/5"/>
        <div className="flex items-start justify-between">
          <span className="text-[10px] uppercase tracking-wider text-white/70 font-medium">Card</span>
          <BrandBadge brand={brand}/>
        </div>
        <div className="mt-5 font-mono text-[16px] tracking-[0.18em] tabular-nums">
          {number || "•••• •••• •••• ••••"}
        </div>
        <div className="mt-3 flex items-end justify-between text-[10px] uppercase tracking-wider">
          <div>
            <div className="text-white/55 mb-0.5">Cardholder</div>
            <div className="text-white text-[11px] font-medium truncate max-w-[180px]">{name || "Your name"}</div>
          </div>
          <div>
            <div className="text-white/55 mb-0.5">Expires</div>
            <div className="text-white text-[11px] font-mono">{exp || "MM/YY"}</div>
          </div>
        </div>
      </div>

      <div>
        <Label>Card number</Label>
        <input
          value={number}
          onChange={(e) => setNumber(e.target.value)}
          placeholder="1234 5678 9012 3456"
          inputMode="numeric"
          className={inputCls}
          autoComplete="cc-number"
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label>Expiry</Label>
          <input
            value={exp}
            onChange={(e) => setExp(e.target.value)}
            placeholder="MM/YY"
            inputMode="numeric"
            className={inputCls}
            autoComplete="cc-exp"
          />
        </div>
        <div>
          <Label>CVV</Label>
          <input
            value={cvv}
            onChange={(e) => setCvv(e.target.value)}
            placeholder="123"
            inputMode="numeric"
            className={inputCls}
            autoComplete="cc-csc"
          />
        </div>
      </div>
      <div>
        <Label>Cardholder name</Label>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="As printed on card"
          className={inputCls}
          autoComplete="cc-name"
        />
      </div>
    </div>
  );
}

function WalletFields({ method, phone, setPhone }: { method: Method; phone: string; setPhone: (v: string) => void }) {
  return (
    <div className="space-y-3">
      <div className="relative rounded-2xl p-4 text-white shadow-md overflow-hidden" style={{ background: PAYMENT_BRAND[method].bg }}>
        {/* oversized watermark mark */}
        <span className="absolute -right-3 -bottom-4 opacity-[0.16]" aria-hidden>
          <PaymentMark method={method} size={96} />
        </span>
        <div className="relative flex items-start justify-between">
          <div className="text-[10px] uppercase tracking-wider text-white/75 font-medium">Wallet</div>
          <PaymentMark method={method} size={22} />
        </div>
        <div className="relative font-serif text-[20px] font-bold mt-1">{PAYMENT_BRAND[method].name}</div>
        <div className="relative mt-3 font-mono text-[15px] tracking-[0.12em]">
          {phone ? formatBdPhone(phone) : "01••• •••• ••"}
        </div>
      </div>
      <div>
        <Label>Mobile number</Label>
        <input
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="01XXXXXXXXX"
          inputMode="numeric"
          className={inputCls}
        />
        <div className="mt-1.5 text-[10.5px] text-ink-muted">Use any valid-looking BD mobile (01[3-9]XXXXXXXX) - sandbox.</div>
      </div>
    </div>
  );
}

function OtpStage({
  method, phone, otp, setOtp, err, busy, onConfirm, onBack,
}: {
  method: Method;
  phone: string;
  otp: string;
  setOtp: (v: string) => void;
  err: string | null;
  busy: boolean;
  onConfirm: () => void;
  onBack: () => void;
}) {
  const brand = method.charAt(0).toUpperCase() + method.slice(1);
  return (
    <div className="space-y-4">
      <div>
        <div className="text-[10.5px] uppercase tracking-[0.22em] text-ink-muted font-medium mb-1">Verify</div>
        <div className="font-serif text-[20px] font-bold text-ink">Enter the {brand} OTP</div>
        <div className="text-[12.5px] text-ink-dim mt-1">We sent a 6-digit code to {formatBdPhone(phone)}. <span className="text-polaris-600">(any 6 digits work in sandbox)</span></div>
      </div>
      <div className="flex justify-center">
        <input
          autoFocus
          value={otp}
          onChange={(e) => setOtp(e.target.value)}
          maxLength={6}
          inputMode="numeric"
          placeholder="000000"
          className="w-[220px] text-center font-mono text-[26px] tracking-[0.5em] tabular-nums py-3 rounded-xl bg-paper-soft hairline focus:outline-none focus:ring-2 focus:ring-polaris-400"
        />
      </div>
      {err && <div className="text-[12.5px] text-rose-600 text-center">{err}</div>}
      <div className="flex items-center gap-2">
        <button onClick={onBack} className="flex-1 h-10 rounded-full bg-paper-soft text-ink-dim text-[12.5px] font-medium hover:bg-paper-card hairline transition-colors">Back</button>
        <button
          onClick={onConfirm}
          disabled={busy || otp.length < 4}
          className="flex-1 h-10 rounded-full bg-ink text-paper text-[13px] font-semibold hover:bg-polaris-700 transition-colors disabled:opacity-50"
        >
          {busy ? "Verifying…" : "Verify & pay"}
        </button>
      </div>
    </div>
  );
}

function ProcessingStage({ method }: { method: Method }) {
  return (
    <div className="py-12 flex flex-col items-center gap-4">
      <div className="relative h-14 w-14">
        <div className="absolute inset-0 rounded-full border-4 border-polaris-100"/>
        <div className="absolute inset-0 rounded-full border-4 border-polaris-500 border-t-transparent animate-spin"/>
      </div>
      <div className="text-center">
        <div className="font-serif text-[18px] font-bold text-ink">Processing payment…</div>
        <div className="text-[12.5px] text-ink-dim mt-1">
          {method === "card" ? "Authorizing with the issuing bank." : "Checking with the wallet network."}
        </div>
      </div>
    </div>
  );
}

function ReceiptStage({
  status, reference, reason, amount, description, onClose, onRetry,
}: {
  status: "succeeded" | "failed";
  reference: string;
  reason?: string;
  amount: string;
  description: string;
  onClose: () => void;
  onRetry: () => void;
}) {
  const isOk = status === "succeeded";
  return (
    <div className="space-y-4">
      <div className="flex flex-col items-center text-center gap-3 py-2">
        <div className={cn(
          "h-14 w-14 rounded-full flex items-center justify-center shadow-md",
          isOk ? "bg-aurora-500 text-white" : "bg-rose-500 text-white",
        )}>
          {isOk ? <CheckBig /> : <XBig />}
        </div>
        <div>
          <div className="font-serif text-[20px] font-bold text-ink">
            {isOk ? "Payment successful" : "Payment failed"}
          </div>
          <div className="text-[12.5px] text-ink-dim mt-1">
            {isOk
              ? `${description} is now active on your account.`
              : reason ?? "The bank declined the transaction."}
          </div>
        </div>
      </div>
      <div className="rounded-2xl bg-paper-soft hairline p-3 space-y-1.5 text-[12.5px]">
        <Row k="Amount" v={amount} mono />
        <Row k="For" v={description} />
        <Row k="Reference" v={reference} mono />
        <Row k="Status" v={status} mono />
      </div>
      {isOk ? (
        <div className="flex items-center gap-2">
          <a
            href="/transactions"
            className="flex-1 h-10 rounded-full bg-paper-soft text-ink text-[12.5px] font-medium inline-flex items-center justify-center hairline hover:bg-paper-card transition-colors"
          >
            View history
          </a>
          <button
            onClick={onClose}
            className="flex-1 h-10 rounded-full bg-ink text-paper text-[13px] font-semibold hover:bg-polaris-700 transition-colors"
          >
            Continue
          </button>
        </div>
      ) : (
        <div className="flex items-center gap-2">
          <button
            onClick={onClose}
            className="flex-1 h-10 rounded-full bg-paper-soft text-ink-dim text-[12.5px] font-medium hairline hover:bg-paper-card transition-colors"
          >
            Close
          </button>
          <button
            onClick={onRetry}
            className="flex-1 h-10 rounded-full bg-ink text-paper text-[13px] font-semibold hover:bg-polaris-700 transition-colors"
          >
            Try again
          </button>
        </div>
      )}
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════════════
   SMALL UI
   ════════════════════════════════════════════════════════════════════════ */

function Label({ children }: { children: React.ReactNode }) {
  return <div className="text-[11px] font-medium text-ink-dim mb-1">{children}</div>;
}
function Row({ k, v, mono }: { k: string; v: string; mono?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-ink-muted">{k}</span>
      <span className={cn("text-ink text-right truncate", mono && "font-mono")}>{v}</span>
    </div>
  );
}
const inputCls =
  "w-full h-10 px-3 rounded-xl bg-paper-soft hairline text-[13.5px] text-ink placeholder-ink-muted focus:outline-none focus:ring-2 focus:ring-polaris-400";

function BrandBadge({ brand }: { brand: string | null }) {
  return <CardBrandMark brand={brand} height={brand === "mastercard" ? 18 : 14} />;
}

/* ════════════════════════════════════════════════════════════════════════
   FORMATTING + VALIDATION HELPERS
   ════════════════════════════════════════════════════════════════════════ */

function formatCardNumber(v: string): string {
  const digits = v.replace(/\D/g, "").slice(0, 19);
  return digits.replace(/(\d{4})(?=\d)/g, "$1 ").trim();
}
function formatExpiry(v: string): string {
  const digits = v.replace(/\D/g, "").slice(0, 4);
  if (digits.length < 3) return digits;
  return `${digits.slice(0, 2)}/${digits.slice(2)}`;
}
function formatBdPhone(p: string): string {
  if (p.length < 5) return p;
  return `${p.slice(0, 5)} ${p.slice(5, 8)} ${p.slice(8, 11)}`.trim();
}
function formatMoney(minor: number, ccy: string): string {
  const value = minor / 100;
  if (ccy === "BDT") return `৳${value.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;
  return `$${value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
function detectCardBrand(n: string): string | null {
  const d = n.replace(/\D/g, "");
  if (!d) return null;
  if (/^4/.test(d)) return "visa";
  if (/^(5[1-5]|2[2-7])/.test(d)) return "mastercard";
  if (/^3[47]/.test(d)) return "amex";
  if (/^6(?:011|5)/.test(d)) return "discover";
  return null;
}
function isLuhnValid(n: string): boolean {
  if (n.length < 12) return false;
  let sum = 0;
  let alt = false;
  for (let i = n.length - 1; i >= 0; i--) {
    let v = parseInt(n.charAt(i), 10);
    if (Number.isNaN(v)) return false;
    if (alt) { v *= 2; if (v > 9) v -= 9; }
    sum += v;
    alt = !alt;
  }
  return sum % 10 === 0;
}

/* ════════════════════════════════════════════════════════════════════════
   GLYPHS
   ════════════════════════════════════════════════════════════════════════ */

function CheckBig() {
  return <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5"/></svg>;
}
function XBig() {
  return <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6L6 18M6 6l12 12"/></svg>;
}

/* Plan presets - used by /billing. */
export const PLAN_CHOICES: Record<"pro" | "elite", PlanChoice> = {
  pro: {
    id: "pro",
    name: "Polaris Pro (annual)",
    amountUSDcents: 4900,    // $49
    amountBDTpaisa: 549000,  // ৳5,490
  },
  elite: {
    id: "elite",
    name: "Polaris Elite (annual)",
    amountUSDcents: 14900,
    amountBDTpaisa: 1690000,
  },
};
