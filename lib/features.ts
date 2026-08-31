import type { Plan } from "@/lib/db/collections";
import { PLAN_CATALOG, type PlanLimits } from "@/lib/billing/plans";

/**
 * Client-safe plan/feature logic. No server-only imports (no env, no db),
 * so this can be used in both client components and server code.
 *
 * FEATURE_ACCESS is the central feature-access map: every gated surface
 * declares its required plan, whether it's actually implemented, where it
 * lives, and what the upgrade prompt should say. The billing catalog
 * (lib/billing/plans.ts) is the matching source of truth for what each
 * plan ADVERTISES - the two are audited together (docs/PLAN_VERIFICATION.md).
 */

export type Feature =
  | "roadmap"
  | "milestones"
  | "benchmark"
  | "caseStudyDetail"
  | "adaptiveReplanning"
  | "strategistChat"
  | "integrations"
  | "partners"
  | "consultantMarketplace"
  | "communityChat"
  | "professorLists"
  | "analytics"
  | "strategyReport"
  | "scenarioSim";

export type FeatureAccess = {
  name: string;
  minPlan: Plan;
  /** False = promised but not built; must never render as an active benefit. */
  implemented: boolean;
  comingSoon?: boolean;
  /** Primary route / API the feature depends on. */
  route?: string;
  upgradeMessage: string;
};

export const FEATURE_ACCESS: Record<Feature, FeatureAccess> = {
  roadmap: {
    name: "AI roadmap generation",
    minPlan: "free",
    implemented: true,
    route: "/roadmap + /api/roadmap/v2",
    upgradeMessage: "Sign in to build your roadmap.",
  },
  milestones: {
    name: "Milestone & weekly task tracking",
    minPlan: "free",
    implemented: true,
    route: "/roadmap + /api/tasks/weekly",
    upgradeMessage: "Sign in to track milestones.",
  },
  benchmark: {
    name: "Acceptance-rate benchmarks",
    minPlan: "free",
    implemented: true,
    route: "/universities + /api/benchmark",
    upgradeMessage: "Sign in to compare acceptance benchmarks.",
  },
  caseStudyDetail: {
    name: "Accepted-student case study detail",
    minPlan: "pro",
    implemented: true,
    route: "/case-studies",
    upgradeMessage: "Upgrade to Pro to read full accepted-student case studies.",
  },
  adaptiveReplanning: {
    name: "Adaptive roadmap replanning",
    minPlan: "free",
    implemented: true,
    route: "/api/roadmap/v2/adapt",
    upgradeMessage: "Sign in to replan your roadmap.",
  },
  strategistChat: {
    name: "AI Strategist",
    minPlan: "pro",
    implemented: true,
    route: "/strategist + /api/strategist",
    upgradeMessage: "The AI Strategist is available on Pro and Elite. Upgrade to chat about your roadmap, scores, and next steps.",
  },
  integrations: {
    name: "Integration hub (GitHub, Codeforces, Google)",
    minPlan: "pro",
    implemented: true,
    route: "/connections",
    upgradeMessage: "Upgrade to Pro to connect the tools that show your progress.",
  },
  partners: {
    name: "Partner marketplace",
    minPlan: "pro",
    implemented: true,
    route: "/partners",
    upgradeMessage: "Upgrade to Pro to unlock matched student offers.",
  },
  // Marketplace surfaces are deliberately plan-free: consultant bookings and
  // community access generate separate marketplace revenue and must never be
  // locked behind a subscription.
  consultantMarketplace: {
    name: "Consultant marketplace & bookings",
    minPlan: "free",
    implemented: true,
    route: "/consultants + /bookings",
    upgradeMessage: "Sign in to hire a verified consultant.",
  },
  communityChat: {
    name: "Community channels",
    minPlan: "free",
    implemented: true,
    route: "/community",
    upgradeMessage: "Sign in to join the community.",
  },
  professorLists: {
    name: "Faculty & recommender lists",
    minPlan: "elite",
    implemented: false,
    comingSoon: true,
    upgradeMessage: "Coming soon for Elite members.",
  },
  analytics: {
    name: "Advanced analytics",
    minPlan: "elite",
    implemented: false,
    comingSoon: true,
    upgradeMessage: "Coming soon for Elite members.",
  },
  strategyReport: {
    name: "AI strategy reports",
    minPlan: "elite",
    implemented: false,
    comingSoon: true,
    upgradeMessage: "Coming soon for Elite members.",
  },
  scenarioSim: {
    name: "Probability scenario simulator",
    minPlan: "elite",
    implemented: true,
    route: "/dashboard",
    upgradeMessage: "Upgrade to Elite to simulate what-if scenarios.",
  },
};

/** Derived: feature → minimum plan (kept for existing callers). */
export const FEATURE_MIN_PLAN: Record<Feature, Plan> = Object.fromEntries(
  (Object.entries(FEATURE_ACCESS) as Array<[Feature, FeatureAccess]>).map(
    ([k, v]) => [k, v.minPlan],
  ),
) as Record<Feature, Plan>;

const PLAN_RANK: Record<Plan, number> = { free: 0, pro: 1, elite: 2 };

export function planMeets(plan: Plan, minPlan: Plan): boolean {
  return PLAN_RANK[plan] >= PLAN_RANK[minPlan];
}

/** Plan allows it AND it actually exists - never unlocks vaporware. */
export function canUse(plan: Plan, feature: Feature): boolean {
  const f = FEATURE_ACCESS[feature];
  return f.implemented && planMeets(plan, f.minPlan);
}

export function upgradeMessage(feature: Feature): string {
  return FEATURE_ACCESS[feature].upgradeMessage;
}

export const PLAN_LABELS: Record<Plan, string> = {
  free: "Free",
  pro: "Pro",
  elite: "Elite",
};

/**
 * Per-plan quotas, derived from the billing catalog so the numbers shown on
 * pricing cards and the numbers enforced in code can never drift apart.
 * (Strategist budget mirrors lib/ratelimit.ts BUDGETS.)
 */
export const PLAN_FEATURES: Record<
  Plan,
  {
    strategistBudget: number;
    maxConnections: number;
    universities: boolean;
    familyMonitoring: boolean;
  }
> = Object.fromEntries(
  PLAN_CATALOG.map((p) => [
    p.id,
    {
      strategistBudget: p.limits.strategistPer5Min,
      maxConnections: p.limits.maxConnections,
      universities: true, // directory + benchmarks are Free for everyone
      familyMonitoring: true,
    },
  ]),
) as Record<Plan, { strategistBudget: number; maxConnections: number; universities: boolean; familyMonitoring: boolean }>;

/** Re-export for callers that want plan limits without importing billing. */
export type { PlanLimits };
