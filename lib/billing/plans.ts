/**
 * Polaris plan catalog - the single source of truth for pricing AND plan
 * promises. Used by the landing pricing section, /billing, the checkout
 * flow, and the feature-gating layer (lib/features.ts derives its limits
 * from here). Don't hardcode plan text anywhere else.
 *
 * Honesty rules:
 *   • `features` lists only what WORKS today for that plan (verified against
 *     the real gates: requirePlan pages, rate-limit budgets, connection
 *     caps - see docs/PLAN_VERIFICATION.md).
 *   • Unbuilt promises live in `comingSoon` and always render with a
 *     "Soon" tag - never as active benefits.
 *
 * Client-safe (no server imports). Amounts are minor units: USD cents and
 * BDT paisa. Yearly pricing = 10 months (two free).
 */

export type PlanId = "free" | "pro" | "elite";
export type BillingCycle = "monthly" | "yearly";

export type PlanLimits = {
  /** Strategist messages per 5-minute window (mirrors lib/ratelimit.ts). */
  strategistPer5Min: number;
  /** Max connected integrations (0 = Connections hub locked). */
  maxConnections: number;
  /** Active roadmaps (the v2 engine keeps one living doc per user). */
  activeRoadmaps: number;
};

export type PlanDef = {
  id: PlanId;
  name: string;
  tagline: string;
  audience: string;
  usd: { monthly: number; yearly: number };
  bdt: { monthly: number; yearly: number };
  /** Implemented, working features - verified against real gates. */
  features: string[];
  /** Bengali translations of `features` (same order). */
  featuresBn: string[];
  /** Promised but not yet built - always rendered with a "Soon" tag. */
  comingSoon?: string[];
  comingSoonBn?: string[];
  limits: PlanLimits;
  /** Shown next to the yearly price. */
  yearlyNote?: string;
  popular?: boolean;
  accent: "ink" | "polaris" | "aurora";
};

export const PLAN_CATALOG: PlanDef[] = [
  {
    id: "free",
    name: "Free",
    tagline: "Start your journey",
    audience: "For exploring what Polaris can do",
    usd: { monthly: 0, yearly: 0 },
    bdt: { monthly: 0, yearly: 0 },
    features: [
      "University & scholarship directory",
      "Acceptance-rate benchmarks",
      "Public requirement summaries",
      "Community resources & knowledge hub",
      "1 active roadmap with weekly tasks & replans",
      "Deadline tracking & family view",
      "AI Strategist chat",
    ],
    featuresBn: [
      "বিশ্ববিদ্যালয় ও স্কলারশিপ ডিরেক্টরি",
      "অ্যাকসেপ্টেন্স-রেট বেঞ্চমার্ক",
      "পাবলিক রিকোয়ারমেন্ট সারাংশ",
      "কমিউনিটি রিসোর্স ও নলেজ হাব",
      "১টি সক্রিয় রোডম্যাপ - সাপ্তাহিক টাস্ক ও রিপ্ল্যান",
      "ডেডলাইন ট্র্যাকিং ও ফ্যামিলি ভিউ",
      "এআই স্ট্র্যাটেজিস্ট চ্যাট",
    ],
    limits: { strategistPer5Min: 10, maxConnections: 0, activeRoadmaps: 1 },
    accent: "ink",
  },
  {
    id: "pro",
    name: "Pro",
    tagline: "The full intelligence layer",
    audience: "For students actively building their application",
    usd: { monthly: 500, yearly: 4900 },     // $5 / $49
    bdt: { monthly: 55000, yearly: 549000 }, // ৳550 / ৳5,490
    features: [
      "Everything in Free",
      "30 Strategist messages / 5 min",
      "Strategist-aware roadmap replans & guidance",
      "Integration hub - GitHub, Codeforces & more",
      "Partner marketplace - matched student offers",
      "Up to 6 connected tools feeding your roadmap",
    ],
    featuresBn: [
      "ফ্রি-র সবকিছু",
      "৫ মিনিটে ৩০টি স্ট্র্যাটেজিস্ট মেসেজ",
      "স্ট্র্যাটেজিস্ট-চালিত রোডম্যাপ রিপ্ল্যান ও গাইডেন্স",
      "ইন্টিগ্রেশন হাব - GitHub, Codeforces সহ",
      "পার্টনার মার্কেটপ্লেস - ম্যাচ করা অফার",
      "৬টি পর্যন্ত কানেক্টেড টুল",
    ],
    limits: { strategistPer5Min: 30, maxConnections: 6, activeRoadmaps: 1 },
    yearlyNote: "2 months free",
    popular: true,
    accent: "polaris",
  },
  {
    id: "elite",
    name: "Elite",
    tagline: "Every edge, prioritized",
    audience: "For applicants targeting the most selective schools",
    usd: { monthly: 1500, yearly: 14900 },     // $15 / $149
    bdt: { monthly: 169000, yearly: 1690000 }, // ৳1,690 / ৳16,900
    features: [
      "Everything in Pro",
      "2× Strategist budget - 60 messages / 5 min",
      "Unlimited tool connections",
    ],
    featuresBn: [
      "প্রো-র সবকিছু",
      "২× স্ট্র্যাটেজিস্ট বাজেট - ৫ মিনিটে ৬০ মেসেজ",
      "আনলিমিটেড টুল কানেকশন",
    ],
    comingSoon: [
      "Deep benchmarking vs admitted profiles",
      "Faculty & recommender lists",
      "Priority Bangla support",
    ],
    comingSoonBn: [
      "ভর্তি-প্রোফাইলের সাথে ডিপ বেঞ্চমার্কিং",
      "ফ্যাকাল্টি ও রেকমেন্ডার তালিকা",
      "প্রায়োরিটি বাংলা সাপোর্ট",
    ],
    limits: { strategistPer5Min: 60, maxConnections: 99, activeRoadmaps: 1 },
    yearlyNote: "2 months free",
    accent: "aurora",
  },
];

export function planDef(id: PlanId): PlanDef {
  return PLAN_CATALOG.find((p) => p.id === id) ?? PLAN_CATALOG[0];
}

export function planPrice(id: PlanId, cycle: BillingCycle): { usd: number; bdt: number } {
  const p = planDef(id);
  return { usd: p.usd[cycle], bdt: p.bdt[cycle] };
}

export function formatMinor(minor: number, currency: string): string {
  const v = minor / 100;
  if (currency === "BDT") return `৳${v.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;
  return `$${v.toLocaleString("en-US", { minimumFractionDigits: v % 1 ? 2 : 0, maximumFractionDigits: 2 })}`;
}

/** "Polaris Pro (yearly)" - parsed back by the confirm route. */
export function planDescription(id: Exclude<PlanId, "free">, cycle: BillingCycle): string {
  return `Polaris ${id === "pro" ? "Pro" : "Elite"} (${cycle})`;
}

export function parsePlanDescription(desc: string): { planId: Exclude<PlanId, "free">; cycle: BillingCycle } | null {
  const m = /^polaris (pro|elite) \((monthly|yearly|annual)\)/i.exec(desc.trim());
  if (!m) return null;
  return {
    planId: m[1].toLowerCase() as "pro" | "elite",
    cycle: m[2].toLowerCase() === "monthly" ? "monthly" : "yearly",
  };
}
