import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { appOrigin } from "@/lib/env";
import { validatePayment } from "@/lib/payments/sslcommerz";
import { settleValidatedPayment, markOrderTerminal } from "@/lib/payments/orders";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Where SSLCommerz sends the payer's browser back to.
 *
 * This runs the same validation as the IPN rather than trusting the `status`
 * query parameter, because this URL is reachable by anyone: hitting
 * /return?status=success by hand must not activate a plan. The two callbacks
 * race routinely, which is why settlement is idempotent - whichever arrives
 * first activates, the other reports "already-processed".
 *
 * SSLCommerz POSTs here, so the response is a 303 redirect: the browser must
 * follow it with GET rather than re-posting to the billing page.
 */
async function handle(req: NextRequest) {
  const url = new URL(req.url);
  const declared = url.searchParams.get("status") ?? "";
  const billing = new URL("/billing", appOrigin());

  const form = await req.formData().catch(() => null);
  const valId = String(form?.get("val_id") ?? "").trim();
  const tranId = String(form?.get("tran_id") ?? "").trim();

  if (declared === "cancel" || declared === "fail") {
    if (tranId) {
      await markOrderTerminal(
        tranId,
        declared === "cancel" ? "cancelled" : "failed",
        `return:${declared}`,
      ).catch(() => {});
    }
    billing.searchParams.set("payment", declared === "cancel" ? "cancelled" : "failed");
    return NextResponse.redirect(billing, 303);
  }

  if (!valId) {
    billing.searchParams.set("payment", "unverified");
    return NextResponse.redirect(billing, 303);
  }

  try {
    const validation = await validatePayment(valId);
    const result = await settleValidatedPayment(validation);

    if (result.outcome === "activated" || result.outcome === "already-processed") {
      billing.searchParams.set("payment", "success");
      if (tranId) billing.searchParams.set("tran", tranId);
    } else {
      console.error(`[sslcommerz-return] rejected ${tranId}: ${result.reason}`);
      billing.searchParams.set("payment", "failed");
    }
  } catch (err) {
    console.error("[sslcommerz-return] validation failed:", err);
    // The IPN is the authority and will settle this independently.
    billing.searchParams.set("payment", "pending");
  }

  return NextResponse.redirect(billing, 303);
}

export const POST = handle;
export const GET = handle;
