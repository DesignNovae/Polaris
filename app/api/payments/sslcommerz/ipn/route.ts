import type { NextRequest } from "next/server";
import { ok } from "@/lib/api/respond";
import { validatePayment } from "@/lib/payments/sslcommerz";
import { settleValidatedPayment, markOrderTerminal } from "@/lib/payments/orders";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * SSLCommerz IPN - the authoritative payment notification.
 *
 * This endpoint is public and unauthenticated, because SSLCommerz posts to it
 * server-to-server with no credential. Nothing in the request body is trusted:
 * the only field used is `val_id`, and that is spent on a server-to-server
 * validation call whose answer decides everything. A forged POST therefore buys
 * nothing - an invented val_id fails validation, and a replayed real one hits
 * the idempotent settle path.
 *
 * Always 200. A non-2xx makes SSLCommerz retry, and a retry storm against a
 * request that was rejected on its merits helps nobody; genuine transient
 * failures are the one case that returns 500 so a retry can succeed.
 */
export async function POST(req: NextRequest) {
  const form = await req.formData().catch(() => null);
  if (!form) return ok({ received: true, handled: false });

  const valId = String(form.get("val_id") ?? "").trim();
  const tranId = String(form.get("tran_id") ?? "").trim();
  const status = String(form.get("status") ?? "").trim();

  // The gateway reports the payer walked away. Close the order out, but never
  // touch one that has already been paid.
  if (!valId) {
    if (tranId && (status === "FAILED" || status === "CANCELLED")) {
      await markOrderTerminal(
        tranId,
        status === "CANCELLED" ? "cancelled" : "failed",
        `ipn:${status}`,
      ).catch(() => {});
    }
    return ok({ received: true, handled: false });
  }

  try {
    const validation = await validatePayment(valId);
    const result = await settleValidatedPayment(validation);

    if (result.outcome === "rejected") {
      console.error(`[sslcommerz-ipn] rejected ${tranId}: ${result.reason}`);
    }
    return ok({ received: true, outcome: result.outcome });
  } catch (err) {
    console.error("[sslcommerz-ipn] processing failed:", err);
    // Transient - let SSLCommerz retry into the idempotent path.
    return new Response(JSON.stringify({ error: "retry" }), {
      status: 500,
      headers: { "content-type": "application/json" },
    });
  }
}
