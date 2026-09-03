
// Re-export client-safe feature helpers for server callers' convenience.
export {
  type Feature,
  FEATURE_MIN_PLAN,
  canUse,
  planMeets,
  PLAN_LABELS,
} from "@/lib/features";

/**
 * SSLCommerz has no per-plan product ids: the plan and billing cycle come from
 * the order row we wrote before redirecting, and the price from the catalog in
 * lib/billing/plans.ts. The variant-id mapping the LemonSqueezy integration
 * needed is gone with it.
 */

