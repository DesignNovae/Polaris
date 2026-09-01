/**
 * Gemma 4 research orchestrator. Retrieval and deterministic fallbacks are
 * supporting algorithms; all generated language comes from Gemma 4.
 */

import { searchKb, searchUserDocs, type KbHit, type UserHit } from "@/lib/rag/search";
import { planQueries, type TurnHistory } from "@/lib/rag/rewrite";
import { dropIfIrrelevant, mergeHits, planSecondPass } from "@/lib/rag/iterate";
import { figureWarning, findUnsupportedFigures } from "@/lib/rag/figures";
import { isRerankEnabled, rerank } from "@/lib/rag/rerank";
import { shortDomain, tavilySearch } from "@/lib/llm/web-search";
import {
  selectRelevantFacts,
  renderMemoryBlock,
} from "./memory";
import {
  buildResearchSystemPrompt,
  refusalFallback,
} from "./prompt";
import {
  modeInstructions,
  modeWantsWebSearch,
  type StrategistMode,
} from "./profiles";
import { chooseModel, pickFallback, type RouteResult } from "@/lib/llm/router";
import {
  MUTATING_TOOLS,
  STRATEGIST_TOOLS,
  isToolName,
  runTool,
} from "./tools";
import type {
  ChatMessage,
  RouteMode,
  ToolCall,
  ToolResult,
} from "@/lib/llm/providers/types";
import { recordUsage } from "@/lib/db/collections";
import type { StrategistChunk } from "./schemas";
import type { StudentProfile } from "@/lib/profile";
import type { UserMemoryFact } from "@/lib/db/collections";
import type { Lang } from "@/lib/i18n/strings";
import { BN_ERRORS } from "@/lib/i18n/server";

/**
 * Ceilings for one answer. Rounds bound latency; calls bound cost. The final
 * round is served without tools, so the model always closes with prose rather
 * than an unresolved branch.
 */
const MAX_TOOL_ROUNDS = 4;
const MAX_TOOL_CALLS = 8;
/** Tool output is truncated before it re-enters the context window. */
const MAX_TOOL_RESULT_CHARS = 6000;

function clampToolResult(value: unknown): unknown {
  const json = JSON.stringify(value ?? null);
  if (json !== undefined && json.length <= MAX_TOOL_RESULT_CHARS) return value;
  return {
    truncated: true,
    note: "Result was too large to return in full. Narrow the query and call again.",
    preview: (json ?? "").slice(0, MAX_TOOL_RESULT_CHARS),
  };
}

export type ResearchInput = {
  userId: string;
  profile: StudentProfile;
  memory: UserMemoryFact[];
  recentMilestones: string[];
  userMessage: string;
  /** Recent turns of this thread - used to resolve follow-up references. */
  history?: TurnHistory;
  mode: StrategistMode;
  language?: Lang;
  routeMode?: RouteMode;
  preferred?: { providerId: string; modelId: string };
  autoSelect?: boolean;
  offline?: boolean;
  allowPaid?: boolean;
  abortSignal?: AbortSignal;
};

export type ResearchOutcome = {
  answerText: string;
  webSources: Array<{ uri: string; title: string }>;
  kbHits: KbHit[];
  userHits: UserHit[];
  providerId: string;
  modelId: string;
  tier: "free" | "paid" | "local";
  fallbackUsed: boolean;
  tokensIn: number;
  tokensOut: number;
  latencyMs: number;
  outcome: "ok" | "error";
};

export async function* deepResearch(
  input: ResearchInput,
  outcome: { current?: ResearchOutcome },
): AsyncGenerator<StrategistChunk> {
  // 1. Retrieval (always). One plan, two indexes: the shared KB and the
  //    student's own material. A follow-up turn is rewritten into a
  //    standalone question first, otherwise "what about the second one?"
  //    would be searched literally.
  yield { kind: "tool", name: "retrieval", status: "start" };
  const plan = await planQueries({
    message: input.userMessage,
    history: input.history,
    signal: input.abortSignal,
  });

  // With reranking on we retrieve a deeper pool, because a reranker can only
  // promote what fusion actually handed it.
  const firstPassDepth = isRerankEnabled() ? 15 : 5;
  const [rawFirstPass, userHits] = await Promise.all([
    searchKb(plan.queries, firstPassDepth).catch(() => [] as KbHit[]),
    searchUserDocs(input.userId, plan.queries, 4, {
      signal: input.abortSignal,
    }).catch(() => [] as UserHit[]),
  ]);

  let rerankReason = "";
  let firstPass = rawFirstPass;
  if (isRerankEnabled() && rawFirstPass.length > 1) {
    const outcome = await rerank(
      plan.queries[0] ?? input.userMessage,
      rawFirstPass.map((hit) => ({ ...hit, text: hit.snippet })),
      5,
      { signal: input.abortSignal },
    );
    firstPass = outcome.hits;
    rerankReason = outcome.reason;
  } else {
    firstPass = rawFirstPass.slice(0, 5);
  }

  // Second pass: only when the first came back thin. Costs nothing on a
  // healthy retrieval, and rescues the case one-shot retrieval always lost.
  let kbHits = firstPass;
  const secondPass = await planSecondPass({
    question: input.userMessage,
    hits: firstPass,
    signal: input.abortSignal,
  }).catch(() => ({ triggered: false, queries: [], reason: "" }));
  if (secondPass.triggered) {
    const extra = await searchKb(secondPass.queries, 5).catch(() => [] as KbHit[]);
    kbHits = mergeHits(firstPass, extra, 6);
  }

  // If even the best passage is off-topic after every pass, send none. An
  // empty <kb> block is a truthful "we have nothing on this"; five plausible
  // but unrelated passages are an invitation to improvise.
  const relevance = dropIfIrrelevant(kbHits);
  kbHits = relevance.hits;

  for (const h of kbHits) {
    yield { kind: "source", label: h.title, uri: `kb://${h.id}`, source: "kb" };
  }
  for (const h of userHits) {
    yield { kind: "source", label: h.title, uri: `me://${h.id}`, source: h.kind === "roadmap" || h.kind === "milestone" ? "roadmap" : "profile" };
  }
  yield {
    kind: "tool",
    name: "retrieval",
    status: "done",
    result: {
      queries: plan.queries,
      rewritten: plan.rewritten,
      reason: plan.reason,
      kbHits: kbHits.length,
      userHits: userHits.length,
      rounds: secondPass.triggered ? 2 : 1,
      droppedAsIrrelevant: relevance.dropped || undefined,
      reranked: rerankReason || undefined,
      secondPassQueries: secondPass.triggered ? secondPass.queries : undefined,
      secondPassReason: secondPass.reason || undefined,
    },
  };

  // 2. Pick a model via the router.
  let route = await chooseModel({
    task: input.mode,
    mode: input.routeMode,
    preferred: input.preferred,
    autoSelect: input.autoSelect,
    offline: input.offline,
    allowPaid: input.allowPaid,
  });

  if (!route) {
    const fallback = refusalFallback(input.language ?? "en");
    yield* deterministicFallback(input);
    outcome.current = {
      answerText: fallback,
      webSources: [],
      kbHits,
      userHits,
      providerId: "none",
      modelId: "none",
      tier: "free",
      fallbackUsed: false,
      tokensIn: 0,
      tokensOut: fallback.split(/\s+/).length,
      latencyMs: 0,
      outcome: "ok",
    };
    return;
  }

  yield {
    kind: "tool",
    name: "model_route",
    status: "done",
    result: {
      providerId: route.chosen.provider.id,
      providerName: route.chosen.provider.name,
      modelId: route.chosen.model.id,
      modelLabel: route.chosen.model.label,
      tier: route.chosen.model.tier,
      reason: route.reason,
      fallbacks: route.fallbacks.map((f) => ({
        providerId: f.provider.id,
        modelId: f.model.id,
      })),
    },
  };

  // 3. Build prompts.
  const relevantMemory = selectRelevantFacts(input.memory, input.userMessage, 8);
  const baseSystem = buildResearchSystemPrompt(
    input.profile,
    input.recentMilestones,
    relevantMemory,
    input.language,
  );
  const fullSystem = baseSystem + modeInstructions(input.mode);

  const wantsSearch = modeWantsWebSearch(input.mode);
  const providerHasSearch = !!route.chosen.model.capabilities?.search;

  // 4. If the chosen model can't search and we want web context, do a
  //    Tavily pre-fetch and inline the snippets into the user prompt.
  let webContext = "";
  let preFetchedSources: Array<{ uri: string; title: string }> = [];
  if (wantsSearch && !providerHasSearch && process.env.TAVILY_API_KEY) {
    yield { kind: "tool", name: "web_search", status: "start" };
    const tav = await tavilySearch(input.userMessage, { maxResults: 5 });
    if (tav.length) {
      webContext =
        `<web>\n` +
        tav.map((r) => `[${shortDomain(r.url)}] ${r.title}\n${r.snippet}\n${r.url}`).join("\n\n") +
        `\n</web>\n\n`;
      preFetchedSources = tav.map((r) => ({
        uri: r.url,
        title: r.title || shortDomain(r.url),
      }));
      for (const s of preFetchedSources) {
        yield { kind: "source", label: s.title, uri: s.uri, source: "web" };
      }
    }
    yield {
      kind: "tool",
      name: "web_search",
      status: "done",
      result: { sources: preFetchedSources.length, viaTavily: true },
    };
  } else if (wantsSearch && providerHasSearch) {
    yield { kind: "tool", name: "web_search", status: "start" };
  }

  // Memory facts already render in <memory>; drop retrieved copies of them
  // so the same sentence doesn't occupy the context window twice.
  const memoryBlock = renderMemoryBlock(relevantMemory);
  const ownHits = userHits.filter(
    (h) => h.kind !== "memory" || !memoryBlock.includes(h.snippet.slice(0, 60)),
  );

  const userPrompt = [
    `<kb>`,
    kbHits.length
      ? kbHits.map((h) => `id=${h.id} | ${h.title}: ${h.snippet}`).join("\n\n")
      : "(no internal KB matches)",
    `</kb>`,
    ``,
    ownHits.length
      ? [
          `<me>`,
          ownHits.map((h) => `id=${h.id} | ${h.title}: ${h.snippet}`).join("\n\n"),
          `</me>`,
          ``,
        ].join("\n")
      : "",
    webContext,
    `<memory>`,
    memoryBlock,
    `</memory>`,
    ``,
    `<question>${input.userMessage}</question>`,
  ].join("\n");

  // 5. Stream from the chosen provider, walking fallbacks on failure.
  //
  //    Each attempt runs a tool loop: the model streams, may request tools, we
  //    execute them and hand the results back, and it continues. Iterative
  //    research falls out of this - a follow-up search_kb is simply another
  //    round, driven by what the model found rather than by a fixed threshold.
  const startedAt = Date.now();
  let answerText = "";
  let webSources: Array<{ uri: string; title: string }> = [...preFetchedSources];
  let tokensIn = 0;
  let tokensOut = 0;
  let fallbackUsed = false;
  let lastError: Error | null = null;
  const emittedKbIds = new Set(kbHits.map((hit) => hit.id));
  const baseMessages: ChatMessage[] = [{ role: "user", content: userPrompt }];
  // Tool output is evidence the model was legitimately given, so the numeric
  // guard below must see it too. Without this a probability returned by
  // compute_probability is flagged as unsupported - the exact opposite of the
  // truth, and it teaches students to distrust the most reliable figure there.
  let toolEvidence = "";

  while (route) {
    let attemptOk = false;
    let toolCallsUsed = 0;
    // A model whose tool calls keep failing will happily spend every round
    // retrying, and each round is a full generation against a per-minute
    // quota. Two fruitless rounds is enough evidence that more tools will not
    // help; the rounds that remain answer from what we already have.
    let barrenRounds = 0;
    const messages: ChatMessage[] = [...baseMessages];
    try {
      for (let round = 1; round <= MAX_TOOL_ROUNDS; round += 1) {
        let pendingCalls: ToolCall[] = [];
        let sawDone = false;
        const toolsAllowed =
          round < MAX_TOOL_ROUNDS && toolCallsUsed < MAX_TOOL_CALLS && barrenRounds < 2;

        for await (const chunk of route.chosen.provider.streamChat({
          model: route.chosen.model.id,
          system: fullSystem,
          messages,
          temperature: input.mode === "coding" ? 0.3 : 0.55,
          maxOutputTokens: 1800,
          thinkingLevel:
            input.routeMode === "reasoning" || input.routeMode === "advanced"
              ? "high" : "minimal",
          webSearch: wantsSearch && providerHasSearch,
          ...(toolsAllowed ? { tools: STRATEGIST_TOOLS } : {}),
          abortSignal: input.abortSignal,
        })) {
          if (input.abortSignal?.aborted) {
            attemptOk = true;
            break;
          }
          if (chunk.kind === "text") {
            answerText += chunk.delta;
            yield { kind: "text", delta: chunk.delta };
          } else if (chunk.kind === "web_source") {
            if (!webSources.find((s) => s.uri === chunk.uri)) {
              webSources.push({ uri: chunk.uri, title: chunk.title });
              yield { kind: "source", label: chunk.title, uri: chunk.uri, source: "web" };
            }
          } else if (chunk.kind === "tool_call") {
            pendingCalls = chunk.calls;
          } else if (chunk.kind === "done") {
            // Rounds accumulate: one answer can span several generations.
            tokensIn += chunk.tokensIn ?? 0;
            tokensOut += chunk.tokensOut ?? 0;
            if (wantsSearch && providerHasSearch) {
              yield {
                kind: "tool",
                name: "web_search",
                status: "done",
                result: {
                  sources: webSources.length,
                  queries: chunk.searchQueries ?? [],
                },
              };
            }
            sawDone = true;
          }
        }

        if (input.abortSignal?.aborted) break;
        if (!pendingCalls.length) {
          attemptOk = sawDone;
          break;
        }

        const results: ToolResult[] = [];
        let roundFailures = 0;
        for (const call of pendingCalls) {
          if (toolCallsUsed >= MAX_TOOL_CALLS) {
            results.push({
              id: call.id,
              name: call.name,
              result: { error: "Tool budget for this answer is spent. Answer with what you already have." },
            });
            continue;
          }
          toolCallsUsed += 1;
          yield {
            kind: "tool",
            name: call.name,
            status: "start",
            result: { args: call.args, mutating: MUTATING_TOOLS.has(call.name) },
          };

          let value: unknown;
          let failed = false;
          if (!isToolName(call.name)) {
            value = { error: 'Unknown tool "' + call.name + '".' };
            failed = true;
          } else {
            try {
              value = clampToolResult(
                await runTool(call.name, call.args, {
                  userId: input.userId,
                  profile: input.profile,
                }),
              );
            } catch (err) {
              // A tool failure is data for the model, not a dead stream.
              value = { error: err instanceof Error ? err.message : String(err) };
              failed = true;
            }
          }

          // Passages pulled mid-answer are citable like first-pass ones, so
          // surface them as sources too.
          if (!failed && call.name === "search_kb" && Array.isArray(value)) {
            for (const hit of value as KbHit[]) {
              if (!hit?.id || emittedKbIds.has(hit.id)) continue;
              emittedKbIds.add(hit.id);
              yield { kind: "source", label: hit.title, uri: "kb://" + hit.id, source: "kb" };
            }
          }

          if (!failed) {
            try {
              toolEvidence += " " + JSON.stringify(value);
            } catch {
              // Unserialisable results contribute nothing to the guard.
            }
          }

          if (failed) roundFailures += 1;

          yield {
            kind: "tool",
            name: call.name,
            status: failed ? "error" : "done",
            result: value,
          };
          results.push({ id: call.id, name: call.name, result: value });
        }

        // Every call this round failed - count it, and stop offering tools once
        // that has happened twice in a row.
        barrenRounds = roundFailures === pendingCalls.length ? barrenRounds + 1 : 0;

        messages.push({ role: "assistant", content: "", toolCalls: pendingCalls });
        messages.push({ role: "user", content: "", toolResults: results });
      }
      if (attemptOk) break;
    } catch (err) {
      lastError = err as Error;
      const next = pickFallback(route);
      // Reset partial answer state for the next attempt.
      answerText = "";
      toolEvidence = "";
      webSources = [...preFetchedSources];
      tokensIn = 0;
      tokensOut = 0;
      if (!next) break;
      fallbackUsed = true;
      yield {
        kind: "tool",
        name: "model_route",
        status: "done",
        result: {
          providerId: next.chosen.provider.id,
          providerName: next.chosen.provider.name,
          modelId: next.chosen.model.id,
          modelLabel: next.chosen.model.label,
          tier: next.chosen.model.tier,
          reason: next.reason,
          fallbacks: next.fallbacks.map((f) => ({
            providerId: f.provider.id,
            modelId: f.model.id,
          })),
        },
      };
      route = next;
      continue;
    }
    break;
  }

  const latencyMs = Date.now() - startedAt;

  if (answerText.length === 0 && lastError) {
    const e = lastError as Error & { status?: number };
    const isQuota =
      e.status === 429 ||
      /quota|rate.?limit|too many requests|\b429\b/i.test(e.message ?? "");
    // The classified code alone cannot separate a real quota rejection from an
    // error that merely matches the pattern, and the usage row written below
    // keeps no message. Log the cause once so a failed answer stays diagnosable.
    console.error("[strategist] stream failed (quota=%s):", isQuota, e);
    yield {
      kind: "error",
      code: isQuota ? "AI_QUOTA" : "STREAM_FAILED",
      message: isQuota
        ? (input.language === "bn" ? BN_ERRORS.capacity : "Gemma 4 is over capacity right now. Try again in a minute.")
        : (input.language === "bn" ? BN_ERRORS.stream : "The Gemma 4 Strategist hit an error. Please retry."),
    };
    outcome.current = {
      answerText: "",
      webSources,
      kbHits,
      userHits,
      providerId: route?.chosen.provider.id ?? "none",
      modelId: route?.chosen.model.id ?? "none",
      tier: (route?.chosen.model.tier ?? "free") as "free" | "paid" | "local",
      fallbackUsed,
      tokensIn,
      tokensOut,
      latencyMs,
      outcome: "error",
    };
    void recordUsage({
      userId: input.userId,
      providerId: route?.chosen.provider.id ?? "none",
      modelId: route?.chosen.model.id ?? "none",
      tier: (route?.chosen.model.tier ?? "free") as "free" | "paid" | "local",
      mode: input.mode,
      tokensIn,
      tokensOut,
      latencyMs,
      fallback: fallbackUsed,
      outcome: "error",
      errorCode: isQuota ? "AI_QUOTA" : "STREAM_FAILED",
    });
    return;
  }

  // Numeric guard. Prompt rules reduced invented figures but did not remove
  // them, and an invented tuition or cutoff is the failure a student cannot
  // detect on their own. This check is deterministic - it compares the numbers
  // in the answer against the numbers the model was actually given - and it
  // runs after streaming, so it annotates rather than blocks.
  const unsupportedFigures = findUnsupportedFigures(
    answerText,
    `${fullSystem}
${userPrompt}
${toolEvidence}
${webSources.map((s) => s.title).join(" ")}`,
  );
  if (unsupportedFigures.length > 0) {
    yield {
      kind: "verification",
      figures: unsupportedFigures.map((f) => f.text),
      message: figureWarning(unsupportedFigures),
    };
  }

  yield {
    kind: "done",
    messageId: crypto.randomUUID(),
    tokensIn,
    tokensOut,
  };

  outcome.current = {
    answerText,
    webSources,
    kbHits,
    userHits,
    providerId: route!.chosen.provider.id,
    modelId: route!.chosen.model.id,
    tier: route!.chosen.model.tier,
    fallbackUsed,
    tokensIn,
    tokensOut,
    latencyMs,
    outcome: "ok",
  };

  void recordUsage({
    userId: input.userId,
    providerId: route!.chosen.provider.id,
    modelId: route!.chosen.model.id,
    tier: route!.chosen.model.tier,
    mode: input.mode,
    tokensIn,
    tokensOut,
    latencyMs,
    fallback: fallbackUsed,
    outcome: "ok",
  });
}

/** Used when literally no provider is configured. */
async function* deterministicFallback(
  input: ResearchInput,
): AsyncGenerator<StrategistChunk> {
  const reply = refusalFallback(input.language ?? "en");
  for (const word of reply.split(" ")) {
    if (input.abortSignal?.aborted) return;
    yield { kind: "text", delta: word + " " };
    await new Promise((r) => setTimeout(r, 18));
  }
  yield {
    kind: "done",
    messageId: crypto.randomUUID(),
    tokensIn: 0,
    tokensOut: reply.split(" ").length,
  };
}

/** Used by the stream layer to pull `RouteResult` for logging. */
export type { RouteResult };

