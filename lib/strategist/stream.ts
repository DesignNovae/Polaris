/**
 * Server-Sent Events stream for the Strategist agent.
 *
 * Forwards the deep-research orchestrator's chunks over SSE, and fires
 * an async memory-extraction pass once the answer is complete.
 */

import { deepResearch, type ResearchOutcome } from "./research";
import {
  addMemoryFacts,
  getUserMemory,
  type UserMemoryFact,
} from "@/lib/db/collections";
import { extractFactsFromExchange } from "./memory";
import { ingestUserDocs } from "@/lib/rag/ingest";
import type { TurnHistory } from "@/lib/rag/rewrite";
import type { StrategistChunk } from "./schemas";
import type { StudentProfile } from "@/lib/profile";
import type { StrategistMode } from "./profiles";
import type { RouteMode } from "@/lib/llm/providers/types";
import type { Lang } from "@/lib/i18n/strings";
import { BN_ERRORS } from "@/lib/i18n/server";

type StreamInput = {
  userId: string;
  profile: StudentProfile;
  recentMilestones: string[];
  userMessage: string;
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

function sseLine(chunk: StrategistChunk): string {
  return `data: ${JSON.stringify(chunk)}\n\n`;
}
export function strategistStream(input: StreamInput): ReadableStream<Uint8Array> {
  const enc = new TextEncoder();
  return new ReadableStream({
    async start(controller) {
      const send = (c: StrategistChunk) =>
        controller.enqueue(enc.encode(sseLine(c)));

      try {
        const memDoc = await getUserMemory(input.userId).catch(() => null);
        const memory: UserMemoryFact[] = memDoc?.facts ?? [];

        const outcomeBox: { current?: ResearchOutcome } = {};
        for await (const chunk of deepResearch(
          {
            userId: input.userId,
            profile: input.profile,
            memory,
            recentMilestones: input.recentMilestones,
            userMessage: input.userMessage,
            history: input.history,
            mode: input.mode,
            language: input.language,
            routeMode: input.routeMode,
            preferred: input.preferred,
            autoSelect: input.autoSelect,
            offline: input.offline,
            allowPaid: input.allowPaid,
            abortSignal: input.abortSignal,
          },
          outcomeBox,
        )) {
          if (input.abortSignal?.aborted) return;
          send(chunk);
        }

        // Async memory extraction, then a refresh of this student's retrieval
        // index. Both run after the answer has streamed, so neither adds
        // latency; the index is warm for the next turn. New chat messages are
        // persisted by the client, so they land in the turn after that.
        const outcome = outcomeBox.current;
        if (
          outcome &&
          outcome.outcome === "ok" &&
          outcome.answerText.length > 40
        ) {
          void (async () => {
            try {
              const newFacts = await extractFactsFromExchange(
                input.userMessage,
                outcome.answerText,
                memory,
              );
              if (newFacts.length > 0) {
                await addMemoryFacts(input.userId, newFacts);
              }
            } catch (err) {
              console.error("[strategist] memory write failed:", err);
            }
            const report = await ingestUserDocs(input.userId).catch((err) => ({
              error: (err as Error).message,
            }));
            if ("error" in report && report.error) {
              console.error("[strategist] user index refresh failed:", report.error);
            }
          })();
        }
      } catch (err) {
        console.error("[strategist] stream error:", err);
        const e = err as { status?: number; message?: string };
        const isQuota =
          e?.status === 429 ||
          /quota|rate.?limit|too many requests|\b429\b/i.test(e?.message ?? "");
        send(
          isQuota
            ? {
                kind: "error",
                code: "AI_QUOTA",
                message:
                  input.language === "bn"
                    ? BN_ERRORS.capacity
                    : "The Strategist's AI is temporarily over capacity. Please try again.",
              }
            : {
                kind: "error",
                code: "STREAM_FAILED",
                message: input.language === "bn"
                  ? BN_ERRORS.stream
                  : "The Strategist hit an error. Try again in a moment.",
              },
        );
      } finally {
        controller.close();
      }
    },
  });
}

export function sseHeaders() {
  return {
    "Content-Type": "text/event-stream; charset=utf-8",
    "Cache-Control": "no-cache, no-transform",
    "Connection": "keep-alive",
    "X-Accel-Buffering": "no",
  };
}
