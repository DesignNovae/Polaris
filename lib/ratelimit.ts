/**
 * Rate limiting.
 *
 * Two things this file used to get wrong, both fixed here:
 *
 *   1. It claimed a sliding window but implemented INCR + PEXPIRE, which is a
 *      fixed window - two full budgets are spendable across one boundary. The
 *      Redis path is now a real sliding window over a sorted set.
 *
 *   2. Any Upstash error fell back to the per-process map, so a Redis outage
 *      silently removed the shared limit across every warm lambda at once.
 *      Scopes that guard a metered upstream (anything that calls a model) are
 *      now `failClosed`: if Redis is configured but unreachable, the request is
 *      denied rather than waved through. A 503 is cheaper than an unbounded
 *      model bill. Scopes that guard nothing expensive still degrade to memory.
 *
 * The in-process fallback remains for local development, where Upstash is
 * simply not configured. On serverless it is per-instance and must not be
 * relied on - set UPSTASH_REDIS_REST_URL / _TOKEN in production.
 */

import type { Plan } from "@/lib/db/collections";

export type Result = {
  allowed: boolean;
  remaining: number;
  /** Epoch ms at which the oldest hit leaves the window. */
  resetAt: number;
  /** True when the limiter denied because its backing store was unreachable. */
  degraded?: boolean;
};

type ScopeConfig = {
  windowMs: number;
  /** Per-plan budget. `free` also applies to anonymous callers. */
  budget: Record<Plan, number>;
  /**
   * Deny when Redis is configured but failing. Set on every scope that fronts
   * a paid upstream; left off for scopes where the only cost is a database row.
   */
  failClosed: boolean;
};

const MIN = 60_000;

/**
 * One entry per metered action. Splitting these is the point: `chat` and
 * `planning` used to share a single "strategist" budget, so generating a
 * roadmap, adjusting targets and rescheduling could exhaust a free user's
 * allowance before they asked a single question.
 */
export const SCOPES = {
  /** Strategist conversation turns. */
  chat: {
    windowMs: 5 * MIN,
    budget: { free: 10, pro: 30, elite: 60 },
    failClosed: true,
  },
  /** Roadmap generate / adapt / schedule / targets / replan. Rarer, heavier. */
  planning: {
    windowMs: 30 * MIN,
    budget: { free: 8, pro: 40, elite: 100 },
    failClosed: true,
  },
  /** Action Lab tools (decision, evidence, routine, exam review). */
  "action-lab": {
    windowMs: 10 * MIN,
    budget: { free: 8, pro: 40, elite: 90 },
    failClosed: true,
  },
  /** Exam generation, grading and coaching. */
  "exam-ai": {
    windowMs: 10 * MIN,
    budget: { free: 10, pro: 45, elite: 100 },
    failClosed: true,
  },
  /**
   * Sub-requests of one AI practice set. A 40-question set is deliberately
   * split into small batches; charging each against the plan budget would make
   * a valid set impossible to finish, so this gets its own generous window.
   */
  "exam-ai-batch": {
    windowMs: 15 * MIN,
    budget: { free: 60, pro: 200, elite: 400 },
    failClosed: true,
  },
  /** Handwriting OCR and essay coaching. Multimodal - the priciest call. */
  essay: {
    windowMs: 15 * MIN,
    budget: { free: 5, pro: 25, elite: 60 },
    failClosed: true,
  },
  /** Sign-language gloss + lesson outlines. */
  interpreter: {
    windowMs: 10 * MIN,
    budget: { free: 12, pro: 40, elite: 80 },
    failClosed: true,
  },
  /** Partner-offer refresh (model + web search). */
  "partner-refresh": {
    windowMs: 15 * MIN,
    budget: { free: 4, pro: 15, elite: 30 },
    failClosed: true,
  },
  /** Anonymous /demo surfaces. IP-keyed, so kept deliberately tight. */
  "public-demo": {
    windowMs: 10 * MIN,
    budget: { free: 8, pro: 8, elite: 8 },
    failClosed: true,
  },
  /** Community posts. Abuse control, not cost control. */
  community: {
    windowMs: 5 * MIN,
    budget: { free: 20, pro: 40, elite: 60 },
    failClosed: false,
  },
  /** Account creation, keyed by IP. Stops budget farming via fresh accounts. */
  register: {
    windowMs: 60 * MIN,
    budget: { free: 5, pro: 5, elite: 5 },
    failClosed: false,
  },
} as const satisfies Record<string, ScopeConfig>;

export type LimitScope = keyof typeof SCOPES;

// ─── In-process fallback (development only) ─────────────────────────────────
const memory = new Map<string, number[]>();

function memoryCheck(key: string, budget: number, windowMs: number): Result {
  const now = Date.now();
  const hits = (memory.get(key) ?? []).filter((t) => t > now - windowMs);
  const allowed = hits.length < budget;
  if (allowed) hits.push(now);
  memory.set(key, hits);

  if (memory.size > 5000) {
    // Drop the least recently touched key rather than scanning every entry.
    const oldestKey = memory.keys().next().value;
    if (oldestKey !== undefined && oldestKey !== key) memory.delete(oldestKey);
  }

  return {
    allowed,
    remaining: Math.max(0, budget - hits.length),
    resetAt: (hits[0] ?? now) + windowMs,
  };
}

// ─── Upstash sliding window ─────────────────────────────────────────────────

function redisConfig(): { url: string; token: string } | null {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  return url && token ? { url, token } : null;
}

async function pipeline(
  cfg: { url: string; token: string },
  commands: (string | number)[][],
): Promise<unknown[]> {
  const res = await fetch(`${cfg.url}/pipeline`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${cfg.token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(commands),
    cache: "no-store",
    signal: AbortSignal.timeout(2500),
  });
  if (!res.ok) throw new Error(`upstash ${res.status}`);
  const data = (await res.json()) as Array<{ result?: unknown; error?: string }>;
  const failed = data.find((d) => d.error);
  if (failed) throw new Error(`upstash: ${failed.error}`);
  return data.map((d) => d.result);
}

/**
 * Sorted-set sliding window: drop everything older than the window, record this
 * hit, count what remains. A denied request removes the member it just added,
 * so hammering a closed window can't hold it closed forever.
 */
async function redisCheck(
  cfg: { url: string; token: string },
  key: string,
  budget: number,
  windowMs: number,
): Promise<Result> {
  const now = Date.now();
  const rk = `rl:${key}`;
  // Unique member per hit; two requests in the same millisecond must both count.
  const member = `${now}-${Math.random().toString(36).slice(2, 10)}`;

  const [, , countRaw, oldestRaw] = await pipeline(cfg, [
    ["ZREMRANGEBYSCORE", rk, 0, now - windowMs],
    ["ZADD", rk, now, member],
    ["ZCARD", rk],
    ["ZRANGE", rk, 0, 0, "WITHSCORES"],
    ["PEXPIRE", rk, windowMs],
  ]);

  const count = Number(countRaw ?? 0);
  const allowed = count <= budget;

  if (!allowed) {
    // Roll back this hit so a rejected request doesn't extend the window.
    await pipeline(cfg, [["ZREM", rk, member]]).catch(() => {});
  }

  const oldest = Array.isArray(oldestRaw) ? Number(oldestRaw[1]) : now;
  return {
    allowed,
    remaining: Math.max(0, budget - count),
    resetAt: (Number.isFinite(oldest) ? oldest : now) + windowMs,
  };
}

/**
 * Check and consume one unit of `scope` for `key`.
 *
 * @param key   Stable caller identity - a user id wherever there is a session,
 *              and only otherwise a client address (see `clientKey`).
 * @param plan  Selects the budget. Anonymous callers pass "free".
 */
export async function rateLimit(
  key: string,
  plan: Plan,
  scope: LimitScope,
): Promise<Result> {
  const cfg = SCOPES[scope];
  const budget = cfg.budget[plan] ?? cfg.budget.free;
  const namespaced = `${scope}:${key}`;
  const redis = redisConfig();

  if (!redis) {
    // Not configured: local development. Memory is the intended path here.
    return memoryCheck(namespaced, budget, cfg.windowMs);
  }

  try {
    return await redisCheck(redis, namespaced, budget, cfg.windowMs);
  } catch (err) {
    console.error(`[ratelimit] upstash failed for ${scope}:`, err);
    if (cfg.failClosed) {
      // Configured but unreachable, and this scope fronts a metered upstream.
      return {
        allowed: false,
        remaining: 0,
        resetAt: Date.now() + 30_000,
        degraded: true,
      };
    }
    return memoryCheck(namespaced, budget, cfg.windowMs);
  }
}

export function rateLimitHeaders(r: Result): Record<string, string> {
  const headers: Record<string, string> = {
    "X-RateLimit-Remaining": String(r.remaining),
    "X-RateLimit-Reset": String(Math.floor(r.resetAt / 1000)),
  };
  if (!r.allowed) {
    headers["Retry-After"] = String(
      Math.max(1, Math.ceil((r.resetAt - Date.now()) / 1000)),
    );
  }
  return headers;
}

/** The message a denied request should carry, in the requested language. */
export function rateLimitMessage(r: Result, lang: "en" | "bn"): string {
  if (r.degraded) {
    return lang === "bn"
      ? "সেবাটি সাময়িকভাবে ব্যস্ত। কিছুক্ষণ পর আবার চেষ্টা করুন।"
      : "The service is temporarily busy. Please try again shortly.";
  }
  const mins = Math.max(1, Math.ceil((r.resetAt - Date.now()) / 60_000));
  return lang === "bn"
    ? `অনুরোধের সীমা শেষ হয়েছে। ${mins} মিনিট পর আবার চেষ্টা করুন।`
    : `Request limit reached. Try again in ${mins} minute${mins === 1 ? "" : "s"}.`;
}

/**
 * Client address for the few routes with no session to key on.
 *
 * `x-forwarded-for` is attacker-controlled on a host that doesn't normalise it,
 * so platform-set headers are preferred and the XFF chain is only a last
 * resort. Prefer keying on a user id wherever a session exists - see P-03.
 */
export function clientKey(req: Request): string {
  const h = req.headers;
  const platform =
    h.get("x-vercel-forwarded-for") || // set by Vercel, not forwardable
    h.get("cf-connecting-ip") || // set by Cloudflare
    h.get("x-real-ip");
  if (platform) return platform.trim();

  const xff = h.get("x-forwarded-for");
  if (xff) {
    // Right-most entry is the one appended by the closest trusted proxy.
    const parts = xff.split(",").map((p) => p.trim()).filter(Boolean);
    const last = parts[parts.length - 1];
    if (last) return last;
  }
  return "anonymous";
}
