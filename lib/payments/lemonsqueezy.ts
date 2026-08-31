import {
  lemonSqueezySetup,
  createCheckout,
  getSubscription,
} from "@lemonsqueezy/lemonsqueezy.js";
import { env, isPaymentsConfigured } from "@/lib/env";
import { HttpError } from "@/lib/api/respond";

let initialized = false;
function init() {
  if (initialized) return;
  if (!env.LEMONSQUEEZY_API_KEY) {
    throw new HttpError(503, "Payments are not configured");
  }
  lemonSqueezySetup({ apiKey: env.LEMONSQUEEZY_API_KEY });
  initialized = true;
}

function appUrl(path = ""): string {
  const base =
    env.NEXTAUTH_URL ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000");
  return `${base}${path}`;
}

/**
 * Create a hosted checkout for a variant. The user id is embedded in
 * custom data so the webhook can attribute the subscription back to the user.
 */
export async function createCheckoutUrl(
  userId: string,
  userEmail: string | null | undefined,
  variantId: string,
): Promise<string> {
  init();
  if (!isPaymentsConfigured()) {
    throw new HttpError(503, "Payments are not configured");
  }

  const { data, error } = await createCheckout(
    env.LEMONSQUEEZY_STORE_ID!,
    variantId,
    {
      checkoutData: {
        email: userEmail ?? undefined,
        custom: { user_id: userId },
      },
      productOptions: {
        redirectUrl: appUrl("/dashboard?upgraded=1"),
      },
      checkoutOptions: { embed: false },
    },
  );

  if (error || !data?.data?.attributes?.url) {
    throw new HttpError(502, "Failed to create checkout");
  }
  return data.data.attributes.url;
}

/** Get the LemonSqueezy-hosted customer portal URL for a subscription. */
export async function getCustomerPortalUrl(
  lsSubscriptionId: string,
): Promise<string> {
  init();
  const { data, error } = await getSubscription(lsSubscriptionId);
  const url = data?.data?.attributes?.urls?.customer_portal;
  if (error || !url) {
    throw new HttpError(502, "Failed to load customer portal");
  }
  return url;
}

