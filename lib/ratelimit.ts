/**
 * Per-user rate limit. Backed by Upstash Redis if configured, else a
 * per-process LRU. Suitable for serverless because the in-memory fallback
 * is intentionally lossy - Upstash should be used in production.
 *
 * Limits are plan-aware: free / pro / elite map to different budgets.
 */

import type { Plan } from "@/lib/db/collections";

type Result = { allowed: boolean; remaining: number; resetAt: number };

const WINDOW_MS = 5 * 60_000; // 5 minutes
const BUDGETS: Record<Plan, number> = { free: 10, pro: 30, elite: 60 };

// ─── In-process fallback ────────────────────────────────────────────────────
const memory = new Map<string, { hits: number[]; resetAt: number }>();

function memoryCheck(key: string, budget: number): Result {
  const now = Date.now();
  const entry = memory.get(key) ?? { hits: [], resetAt: now + WINDOW_MS };
  entry.hits = entry.hits.filter(t => t > now - WINDOW_MS);
  const allowed = entry.hits.length < budget;
  if (allowed) entry.hits.push(now);
  entry.resetAt = (entry.hits[0] ?? now) + WINDOW_MS;
  memory.set(key, entry);
  // Bound the map to avoid unbounded growth.
  if (memory.size > 5000) {
    const oldest = [...memory.entries()].sort((a, b) => a[1].resetAt - b[1].resetAt)[0];
    if (oldest) memory.delete(oldest[0]);
  }
  return { allowed, remaining: Math.max(0, budget - entry.hits.length), resetAt: entry.resetAt };
}

// ─── Upstash (if configured) ────────────────────────────────────────────────
async function upstashCheck(key: string, budget: number): Promise<Result | null> {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  try {
    // Sliding window with a single INCR + EXPIRE on first hit.
    const res = await fetch(`${url}/pipeline`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify([
        ["INCR", `rl:${key}`],
        ["PTTL", `rl:${key}`],
      ]),
      cache: "no-store",
    });
    const data = (await res.json()) as Array<{ result: number }>;
    const count = data[0]?.result ?? 0;
    let pttl = data[1]?.result ?? -1;
    if (count === 1 || pttl < 0) {
      await fetch(`${url}/pexpire/rl:${key}/${WINDOW_MS}`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      pttl = WINDOW_MS;
    }
    return {
      allowed: count <= budget,
      remaining: Math.max(0, budget - count),
      resetAt: Date.now() + pttl,
    };
  } catch (err) {
    console.error("[ratelimit] upstash failed, falling back:", err);
    return null;
  }
}

/**
 * `budgetOverride` exists for scopes whose unit of work is much smaller than a
 * normal request - a full-length AI practice set is deliberately split into
 * many small batches, and charging each one against the plan budget would make
 * a valid set impossible to finish.
 */
export async function rateLimit(userId: string, plan: Plan, scope = "default", budgetOverride?: number): Promise<Result> {
  const budget = budgetOverride ?? BUDGETS[plan];
  const key = `${scope}:${userId}`;
  return (await upstashCheck(key, budget)) ?? memoryCheck(key, budget);
}

export function rateLimitHeaders(r: Result): Record<string, string> {
  return {
    "X-RateLimit-Remaining": String(r.remaining),
    "X-RateLimit-Reset": String(Math.floor(r.resetAt / 1000)),
  };
}
