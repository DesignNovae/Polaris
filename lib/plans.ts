import { env } from "@/lib/env";
import type { Plan } from "@/lib/db/collections";

// Re-export client-safe feature helpers for server callers' convenience.
export {
  type Feature,
  FEATURE_MIN_PLAN,
  canUse,
  planMeets,
  PLAN_LABELS,
} from "@/lib/features";

/** Map a paid tier to its configured LemonSqueezy variant id. */
export function variantForTier(tier: "pro" | "elite"): string | undefined {
  return tier === "pro"
    ? env.LEMONSQUEEZY_VARIANT_PRO
    : env.LEMONSQUEEZY_VARIANT_ELITE;
}

/** Map a LemonSqueezy variant id back to a plan (for webhooks). */
export function tierForVariant(variantId: string): Plan {
  if (variantId === env.LEMONSQUEEZY_VARIANT_ELITE) return "elite";
  if (variantId === env.LEMONSQUEEZY_VARIANT_PRO) return "pro";
  return "free";
}

