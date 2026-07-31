import type { Plan } from "@/lib/db/collections";

const PLAN_RANK: Record<Plan, number> = { free: 0, pro: 1, elite: 2 };

export function planMeets(plan: Plan, minPlan: Plan): boolean {
  return PLAN_RANK[plan] >= PLAN_RANK[minPlan];
}

export const PLAN_LABELS: Record<Plan, string> = {
  free: "Free",
  pro: "Pro",
  elite: "Elite",
};
