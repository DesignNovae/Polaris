import { randomBytes } from "crypto";
import { HttpError } from "@/lib/api/respond";
import { env, isPaymentsConfigured, appOrigin } from "@/lib/env";
import type { BillingCycle, PlanId } from "@/lib/billing/plans";

/**
 * SSLCommerz gateway.
 *
 * Replaces LemonSqueezy, whose webhook handler defaulted `plan` to "free" and
 * only reassigned it for two event names - so every other event, including the
 * `subscription_payment_success` that fires on each renewal, downgraded a
 * paying customer. Two rules follow from that failure and shape this module:
 *
 *   1. Nothing downgrades a user as a side effect. Access ends because the paid
 *      term ran out (`subscription.expiresAt`, checked in `effectivePlan`), not
 *      because an unrecognised callback arrived.
 *
 *   2. A callback is never trusted for its contents. SSLCommerz POSTs to the
 *      success and IPN URLs unauthenticated, and those endpoints are public, so
 *      the only thing that grants a plan is a server-to-server validation call
 *      against SSLCommerz plus an amount/currency match with the order we
 *      stored before redirecting.
 *
 * SSLCommerz does not bill recurrently on the standard product, so a payment
 * buys a fixed term: 30 days monthly, 365 days yearly.
 */

const SANDBOX_BASE = "https://sandbox.sslcommerz.com";
const LIVE_BASE = "https://securepay.sslcommerz.com";

export function gatewayBase(): string {
  return env.SSLCOMMERZ_SANDBOX === "false" ? LIVE_BASE : SANDBOX_BASE;
}

export function isSandbox(): boolean {
  return env.SSLCOMMERZ_SANDBOX !== "false";
}

/** Days of access a cycle buys. */
export const TERM_DAYS: Record<BillingCycle, number> = {
  monthly: 30,
  yearly: 365,
};

export function termEnd(cycle: BillingCycle, from = new Date()): Date {
  const end = new Date(from);
  end.setUTCDate(end.getUTCDate() + TERM_DAYS[cycle]);
  return end;
}

/**
 * Transaction id. Unpredictable on purpose: it is the idempotency key for the
 * IPN and appears in a URL the payer can see, so it must not be guessable or
 * enumerable.
 */
export function newTransactionId(): string {
  return `PLRS-${Date.now().toString(36).toUpperCase()}-${randomBytes(6).toString("hex").toUpperCase()}`;
}

export type InitInput = {
  tranId: string;
  /** Major units, BDT. SSLCommerz rejects sub-taka precision on some methods. */
  amountBdt: number;
  planId: PlanId;
  cycle: BillingCycle;
  customer: { name: string; email: string; phone?: string };
};

export type InitResult = { gatewayUrl: string; sessionKey: string };

function requireConfig(): { storeId: string; storePass: string } {
  if (!isPaymentsConfigured()) {
    throw new HttpError(503, "Payments are not configured");
  }
  return {
    storeId: env.SSLCOMMERZ_STORE_ID!,
    storePass: env.SSLCOMMERZ_STORE_PASSWORD!,
  };
}

/**
 * Open a hosted checkout session and return the URL to redirect the payer to.
 */
export async function initSession(input: InitInput): Promise<InitResult> {
  const { storeId, storePass } = requireConfig();
  const origin = appOrigin();

  const form = new URLSearchParams({
    store_id: storeId,
    store_passwd: storePass,
    total_amount: input.amountBdt.toFixed(2),
    currency: "BDT",
    tran_id: input.tranId,

    // SSLCommerz posts the payer back to these. They are public and untrusted;
    // each one re-validates server-side before doing anything.
    success_url: `${origin}/api/payments/sslcommerz/return?status=success`,
    fail_url: `${origin}/api/payments/sslcommerz/return?status=fail`,
    cancel_url: `${origin}/api/payments/sslcommerz/return?status=cancel`,
    ipn_url: `${origin}/api/payments/sslcommerz/ipn`,

    shipping_method: "NO",
    product_name: `Polaris ${input.planId} (${input.cycle})`,
    product_category: "subscription",
    product_profile: "non-physical-goods",

    cus_name: input.customer.name || "Polaris student",
    cus_email: input.customer.email,
    cus_phone: input.customer.phone || "01700000000",
    cus_add1: "N/A",
    cus_city: "Dhaka",
    cus_country: "Bangladesh",

    // Echoed back on every callback - used only as a hint, never as authority.
    value_a: input.planId,
    value_b: input.cycle,
  });

  let payload: {
    status?: string;
    failedreason?: string;
    GatewayPageURL?: string;
    sessionkey?: string;
  };
  try {
    const res = await fetch(`${gatewayBase()}/gwprocess/v4/api.php`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: form.toString(),
      cache: "no-store",
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) throw new Error(`gateway ${res.status}`);
    payload = await res.json();
  } catch (err) {
    console.error("[sslcommerz] session init failed:", err);
    throw new HttpError(502, "Could not reach the payment gateway");
  }

  if (payload.status !== "SUCCESS" || !payload.GatewayPageURL) {
    console.error("[sslcommerz] session rejected:", payload.failedreason ?? payload.status);
    throw new HttpError(502, "The payment gateway rejected this checkout");
  }

  return {
    gatewayUrl: payload.GatewayPageURL,
    sessionKey: payload.sessionkey ?? "",
  };
}

export type ValidationResult = {
  valid: boolean;
  status: string;
  tranId: string;
  valId: string;
  bankTranId?: string;
  cardType?: string;
  amount: number;
  currency: string;
  raw: Record<string, unknown>;
};

/**
 * Server-to-server validation. This - not the browser callback - is what makes
 * a payment real.
 *
 * SSLCommerz returns VALID for a live payment and VALIDATED for one that has
 * already been validated once (a retry, or the IPN racing the return URL).
 * Both are success; the caller's own idempotency check decides whether to act.
 */
export async function validatePayment(valId: string): Promise<ValidationResult> {
  const { storeId, storePass } = requireConfig();

  const url = new URL(`${gatewayBase()}/validator/api/validationserverAPI.php`);
  url.searchParams.set("val_id", valId);
  url.searchParams.set("store_id", storeId);
  url.searchParams.set("store_passwd", storePass);
  url.searchParams.set("format", "json");

  let data: Record<string, unknown>;
  try {
    const res = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(15_000) });
    if (!res.ok) throw new Error(`validator ${res.status}`);
    data = await res.json();
  } catch (err) {
    console.error("[sslcommerz] validation call failed:", err);
    throw new HttpError(502, "Could not verify the payment");
  }

  const status = String(data.status ?? "");
  return {
    valid: status === "VALID" || status === "VALIDATED",
    status,
    tranId: String(data.tran_id ?? ""),
    valId: String(data.val_id ?? valId),
    bankTranId: data.bank_tran_id ? String(data.bank_tran_id) : undefined,
    cardType: data.card_type ? String(data.card_type) : undefined,
    amount: Number(data.amount ?? 0),
    currency: String(data.currency ?? ""),
    raw: data,
  };
}

/**
 * Amounts must match what we quoted, not what the callback claims.
 *
 * A payer who tampers with the hosted form, or a replayed callback carrying a
 * cheaper transaction, fails here. One paisa of tolerance absorbs the gateway's
 * decimal formatting without allowing a meaningful underpayment.
 */
export function amountMatches(expectedBdt: number, paidBdt: number): boolean {
  return Math.abs(expectedBdt - paidBdt) < 0.01;
}
