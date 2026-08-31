/**
 * Request pacing for evaluation runs.
 *
 * An eval that silently drops 11 of 50 model calls to quota produces a number
 * that looks like a result and is actually an artefact. Worse, it fails in the
 * flattering direction: a reranker whose call 429s falls back to the fused
 * order, so quota loss reads as "the reranker did nothing".
 *
 * This paces calls to stay inside a requests-per-minute budget and retries the
 * ones that get refused anyway, so a run either produces complete numbers or
 * says plainly which ones are missing.
 *
 * Production request paths do not use this - a student waiting on an answer
 * should get an error or a fallback immediately, not sit in a queue. It exists
 * for the batch harnesses, where throughput does not matter and completeness
 * does.
 */

export type LimiterStats = {
  issued: number;
  retried: number;
  failed: number;
  /** Total time spent waiting on the budget, in ms. */
  throttledMs: number;
};

export type Limiter = {
  run<T>(fn: () => Promise<T>): Promise<T>;
  stats(): LimiterStats;
};

function isRateLimited(err: unknown): boolean {
  const e = err as { status?: number; message?: string };
  return (
    e?.status === 429 ||
    e?.status === 503 ||
    /quota|rate.?limit|too many requests|unavailable|overloaded|\b(429|503)\b/i.test(
      e?.message ?? "",
    )
  );
}

/** Reads the server's own "retry in 49.8s" hint when it offers one. */
function retryAfterMs(err: unknown, attempt: number): number {
  const message = (err as { message?: string })?.message ?? "";
  const seconds = message.match(/retry(?:Delay)?[":\s]+(\d+(?:\.\d+)?)s/i);
  if (seconds) return Math.ceil(Number(seconds[1]) * 1000) + 500;
  // Exponential backoff with jitter, capped so a run cannot hang for minutes.
  return Math.min(2 ** attempt * 1500, 45_000) + Math.random() * 500;
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Serialises calls, spaces them to fit `requestsPerMinute`, and retries the
 * refused ones up to `maxRetries`.
 */
export function createLimiter(options: {
  requestsPerMinute: number;
  maxRetries?: number;
}): Limiter {
  const spacingMs = Math.ceil(60_000 / Math.max(options.requestsPerMinute, 1));
  const maxRetries = options.maxRetries ?? 3;
  const stats: LimiterStats = { issued: 0, retried: 0, failed: 0, throttledMs: 0 };

  // One promise chain, so calls queue instead of racing the budget.
  let chain: Promise<unknown> = Promise.resolve();
  let lastStartedAt = 0;

  async function execute<T>(fn: () => Promise<T>): Promise<T> {
    const wait = Math.max(0, lastStartedAt + spacingMs - Date.now());
    if (wait > 0) {
      stats.throttledMs += wait;
      await sleep(wait);
    }
    lastStartedAt = Date.now();

    for (let attempt = 0; ; attempt++) {
      try {
        stats.issued++;
        return await fn();
      } catch (err) {
        if (attempt >= maxRetries || !isRateLimited(err)) {
          stats.failed++;
          throw err;
        }
        stats.retried++;
        const delay = retryAfterMs(err, attempt);
        stats.throttledMs += delay;
        await sleep(delay);
        lastStartedAt = Date.now();
      }
    }
  }

  return {
    run<T>(fn: () => Promise<T>): Promise<T> {
      const queued = chain.then(() => execute(fn));
      // Keep the chain alive regardless of this call's outcome.
      chain = queued.catch(() => undefined);
      return queued;
    },
    stats: () => ({ ...stats }),
  };
}

/**
 * Free-tier budgets, deliberately conservative. Google counts embedding
 * *inputs* rather than requests against the embed quota, so a batch of 32
 * spends 32 units - the eval embeds one query at a time and paces on that.
 */
export const FREE_TIER_GENERATE_RPM = Number(process.env.RAG_EVAL_RPM || 12);
