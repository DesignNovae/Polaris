/**
 * Non-streaming completion helper on top of the smart router.
 *
 * Used by server-side jobs that need a full text response (roadmap
 * generation, weekly plans, replans, submission feedback) rather than an
 * SSE stream. Walks the router's fallback chain on failure.
 *
 * When `userId` is provided, the user's saved AI preference (model pick,
 * speed mode, paid/offline flags) steers routing - the same preference the
 * Strategist picker writes. Every attempt is recorded to the llm_usage
 * telemetry (provider, model, tokens, latency, outcome, fallback) tagged
 * with the calling feature.
 */

import { chooseModel, pickFallback, type RouteResult } from "./router";
import { getAiPref, prefToRoute } from "./prefs";
import { recordUsage } from "@/lib/db/collections";
import type { ChatMessage, TaskKind } from "./providers/types";

export type CompleteRequest = {
  task?: TaskKind;
  system: string;
  messages: ChatMessage[];
  temperature?: number;
  maxOutputTokens?: number;
  /** Internal reasoning budget. Structured JSON jobs should use "minimal". */
  thinkingLevel?: "minimal" | "high";
  abortSignal?: AbortSignal;
  /** Honor this user's saved model preference + attribute usage to them. */
  userId?: string;
  /** Telemetry tag, e.g. "roadmap-generate", "weekly-replan". */
  feature?: string;
};

export async function completeText(req: CompleteRequest): Promise<string | null> {
  const task = req.task ?? "general";

  // Saved preference (when we know the user) → explicit pick or auto+mode.
  const pref = req.userId ? await getAiPref(req.userId) : null;
  const routeArgs = pref ? prefToRoute(pref) : null;

  let route: RouteResult | null = await chooseModel({
    task,
    preferred: routeArgs?.preferred,
    autoSelect: routeArgs ? routeArgs.autoSelect : true,
    mode: routeArgs?.mode,
    offline: routeArgs?.offline,
    allowPaid: routeArgs?.allowPaid ?? false,
  });

  let fellBack = false;

  while (route) {
    const current: RouteResult = route;
    const startedAt = Date.now();
    let tokensIn = 0;
    let tokensOut = 0;
    try {
      let out = "";
      for await (const chunk of current.chosen.provider.streamChat({
        model: current.chosen.model.id,
        system: req.system,
        messages: req.messages,
        temperature: req.temperature ?? 0.4,
        maxOutputTokens: req.maxOutputTokens ?? 4096,
        thinkingLevel: req.thinkingLevel ?? "minimal",
        abortSignal: req.abortSignal,
      })) {
        if (chunk.kind === "text") out += chunk.delta;
        else if (chunk.kind === "done") {
          tokensIn = chunk.tokensIn ?? 0;
          tokensOut = chunk.tokensOut ?? 0;
        }
      }
      if (out.trim().length > 0) {
        track(req, current, task, tokensIn, tokensOut, Date.now() - startedAt, fellBack, "ok");
        return out;
      }
      track(req, current, task, tokensIn, tokensOut, Date.now() - startedAt, fellBack, "error", "EMPTY_RESPONSE");
      route = pickFallback(current);
      fellBack = true;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      // Provider failures are expected to be recoverable because callers may
      // have a deterministic fallback. Keep the terminal signal concise and
      // avoid printing a full SDK stack for a handled upstream 5xx.
      console.warn(`[completeText] ${current.chosen.provider.id}/${current.chosen.model.id} unavailable: ${message}`);
      track(req, current, task, tokensIn, tokensOut, Date.now() - startedAt, fellBack, "error", "PROVIDER_ERROR");
      route = pickFallback(current);
      fellBack = true;
    }
  }
  return null;
}

function track(
  req: CompleteRequest,
  route: RouteResult,
  task: TaskKind,
  tokensIn: number,
  tokensOut: number,
  latencyMs: number,
  fallback: boolean,
  outcome: "ok" | "error",
  errorCode?: string,
) {
  if (!req.userId) return; // telemetry is per-user; skip anonymous jobs
  void recordUsage({
    userId: req.userId,
    providerId: route.chosen.provider.id,
    modelId: route.chosen.model.id,
    tier: route.chosen.model.tier,
    mode: task,
    tokensIn,
    tokensOut,
    latencyMs,
    fallback,
    outcome,
    ...(errorCode ? { errorCode: `${req.feature ?? "complete"}:${errorCode}` } : {}),
  });
}

/**
 * Extract the first JSON object/array from an LLM response that may be
 * wrapped in markdown fences or prose.
 */
export function extractJson(text: string): unknown | null {
  // Prefer fenced blocks.
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const candidates = fence ? [fence[1], text] : [text];
  for (const c of candidates) {
    const start = c.search(/[[{]/);
    if (start === -1) continue;
    // Walk from the first bracket and find the matching close by depth.
    const open = c[start];
    const close = open === "[" ? "]" : "}";
    let depth = 0;
    for (let i = start; i < c.length; i++) {
      if (c[i] === open) depth++;
      else if (c[i] === close) {
        depth--;
        if (depth === 0) {
          try {
            return JSON.parse(c.slice(start, i + 1));
          } catch {
            break;
          }
        }
      }
    }
  }
  return null;
}
