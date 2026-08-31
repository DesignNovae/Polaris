import crypto from "crypto";
import { ok, fail } from "@/lib/api/respond";
import { env } from "@/lib/env";
import { tierForVariant } from "@/lib/plans";
import {
  setUserPlan,
  getUserById,
  getUserBySubscriptionId,
  type Plan,
  type Subscription,
} from "@/lib/db/collections";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Statuses that should retain paid access (cancelled keeps access until expiry). */
const ACTIVE_STATUSES = new Set([
  "active",
  "on_trial",
  "past_due",
  "cancelled",
]);

function verifySignature(rawBody: string, signature: string | null): boolean {
  const secret = env.LEMONSQUEEZY_WEBHOOK_SECRET;
  if (!secret || !signature) return false;
  const digest = crypto
    .createHmac("sha256", secret)
    .update(rawBody)
    .digest("hex");
  try {
    return crypto.timingSafeEqual(
      Buffer.from(digest, "hex"),
      Buffer.from(signature, "hex"),
    );
  } catch {
    return false;
  }
}

export async function POST(req: Request) {
  const rawBody = await req.text();
  const signature = req.headers.get("x-signature");

  if (!verifySignature(rawBody, signature)) {
    return fail(401, "Invalid signature");
  }

  let payload: {
    meta?: { event_name?: string; custom_data?: { user_id?: string } };
    data?: {
      id?: string;
      attributes?: {
        status?: string;
        variant_id?: number | string;
        customer_id?: number | string;
        renews_at?: string;
      };
    };
  };
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return fail(400, "Invalid JSON");
  }

  const event = payload.meta?.event_name;
  const attrs = payload.data?.attributes;
  if (!event || !attrs) return ok({ received: true });

  // Resolve the user: prefer custom_data.user_id, fall back to subscription id.
  const userId = payload.meta?.custom_data?.user_id;
  const subscriptionId = payload.data?.id;

  let resolvedUserId: string | null = null;
  if (userId && (await getUserById(userId).catch(() => null))) {
    resolvedUserId = userId;
  } else if (subscriptionId) {
    const u = await getUserBySubscriptionId(subscriptionId).catch(() => null);
    resolvedUserId = u?._id?.toString() ?? null;
  }

  if (!resolvedUserId) {
    // Acknowledge so LS doesn't retry forever; nothing to attribute.
    return ok({ received: true, attributed: false });
  }

  const status = attrs.status ?? "";
  const variantId = attrs.variant_id != null ? String(attrs.variant_id) : "";

  let plan: Plan = "free";
  if (
    (event === "subscription_created" || event === "subscription_updated") &&
    ACTIVE_STATUSES.has(status)
  ) {
    plan = tierForVariant(variantId);
  }
  // subscription_expired / subscription_cancelled→expired / unpaid → free

  const subscription: Subscription = {
    lsSubscriptionId: subscriptionId,
    lsCustomerId: attrs.customer_id != null ? String(attrs.customer_id) : undefined,
    variantId,
    status,
    renewsAt: attrs.renews_at,
  };

  await setUserPlan(resolvedUserId, plan, subscription);

  return ok({ received: true, plan });
}

