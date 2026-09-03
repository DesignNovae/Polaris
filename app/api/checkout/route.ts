import { ok, withErrorHandling, parseJson, HttpError } from "@/lib/api/respond";
import { checkoutSchema } from "@/lib/validation/schemas";
import { requireSession } from "@/lib/authz";
import { getUserById } from "@/lib/db/collections";
import { planPrice } from "@/lib/billing/plans";
import { initSession, newTransactionId } from "@/lib/payments/sslcommerz";
import { createOrder } from "@/lib/payments/orders";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Open an SSLCommerz checkout.
 *
 * The price is read from the server-side catalog and the order is persisted
 * before the payer is redirected, so the amount the gateway later reports can
 * be checked against something the client never had a chance to influence.
 */
export const POST = withErrorHandling(async (req) => {
  const user = await requireSession();
  const { tier, cycle } = checkoutSchema.parse(await parseJson(req));

  // Paisa in the catalog; SSLCommerz quotes in taka.
  const amountBdt = planPrice(tier, cycle).bdt / 100;
  if (!Number.isFinite(amountBdt) || amountBdt <= 0) {
    throw new HttpError(503, "This plan is not available for purchase yet");
  }

  const full = await getUserById(user.id);
  const tranId = newTransactionId();

  await createOrder({
    tranId,
    userId: user.id,
    planId: tier,
    cycle,
    amountBdt,
  });

  const { gatewayUrl } = await initSession({
    tranId,
    amountBdt,
    planId: tier,
    cycle,
    customer: {
      name: full?.name ?? user.name ?? "Polaris student",
      email: full?.email ?? user.email ?? "",
      phone: full?.phone,
    },
  });

  return ok({ url: gatewayUrl, tranId });
});
