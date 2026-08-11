import { generateGemmaText, hasGemmaKey } from "@/lib/llm/gemma";
import { summarizeProfile, type StudentProfile } from "@/lib/profile";
import type { StrategistRequest } from "./schemas";

export function sseHeaders(): HeadersInit {
  return {
    "Content-Type": "text/event-stream; charset=utf-8",
    "Cache-Control": "no-cache, no-transform",
    Connection: "keep-alive",
    "X-Accel-Buffering": "no",
  };
}

function encodeChunk(value: unknown): Uint8Array {
  return new TextEncoder().encode(`data: ${JSON.stringify(value)}\n\n`);
}

function fallbackReply(message: string, mode: StrategistRequest["mode"], profile: StudentProfile | null): string {
  const focus = profile?.targetTier ? `your ${profile.targetTier} target` : "your target universities";
  const modeLead = mode === "coding"
    ? "Let’s turn this into a small, testable build step."
    : mode === "study"
      ? "Let’s make this concrete and manageable."
      : mode === "research"
        ? "I’ll separate the research question from the next action."
        : "Here’s a grounded next move.";
  return [
    modeLead,
    `For ${focus}, start with one outcome for this week: ${message.trim().slice(0, 180)}.`,
    "1. Define the smallest deliverable you can finish in 60–90 minutes.",
    "2. Put it on a specific day and record the result in your roadmap.",
    "3. Come back with the result and I’ll help you choose the next highest-leverage step.",
  ].join("\n\n");
}

function splitText(text: string, size = 180): string[] {
  const chunks: string[] = [];
  for (let i = 0; i < text.length; i += size) chunks.push(text.slice(i, i + size));
  return chunks.length ? chunks : [text];
}

export function strategistStream({
  message,
  mode,
  profile,
  roadmapContext,
  abortSignal,
}: {
  message: string;
  mode: StrategistRequest["mode"];
  profile: StudentProfile | null;
  roadmapContext?: StrategistRequest["roadmapContext"];
  abortSignal?: AbortSignal;
}): ReadableStream<Uint8Array> {
  return new ReadableStream<Uint8Array>({
    async start(controller) {
      const push = (value: unknown) => {
        if (!abortSignal?.aborted) controller.enqueue(encodeChunk(value));
      };

      try {
        push({
          kind: "tool",
          name: "model_route",
          status: "done",
          result: {
            providerName: hasGemmaKey() ? "Gemma 4" : "Polaris local fallback",
            modelLabel: hasGemmaKey() ? "Gemma 4 26B" : "Local Strategist",
            reason: hasGemmaKey() ? "Gemma-only project route" : "No Gemma key configured",
          },
        });

        // Keep profile and roadmap context inside this server process. The
        // optional hosted completion receives only the user's actual prompt.
        let text: string | null = null;
        if (hasGemmaKey() && !abortSignal?.aborted) {
          const timeout = AbortSignal.timeout(25000);
          const signal = typeof AbortSignal.any === "function"
            ? AbortSignal.any([abortSignal ?? timeout, timeout])
            : timeout;
          text = await generateGemmaText({
            system: [
              "You are PolarisBot, the AI Strategist inside Polaris.",
              "Give practical, concise advice for an ambitious student.",
              `Current mode: ${mode}.`,
              "Use short paragraphs and numbered actions when useful. Do not invent citations.",
            ].join("\n\n"),
            contents: message,
            temperature: mode === "coding" ? 0.25 : 0.4,
            maxOutputTokens: 900,
            thinkingLevel: mode === "research" ? "high" : "minimal",
            abortSignal: signal,
          }).catch(() => null);
        }

        const reply = text?.trim() || fallbackReply(message, mode, profile);
        for (const delta of splitText(reply)) {
          if (abortSignal?.aborted) return;
          push({ kind: "text", delta });
        }
        if (profile) {
          push({ kind: "source", label: "Student profile", uri: "profile://current", source: "profile" });
        }
        if (roadmapContext?.recentEvents?.length) {
          push({ kind: "source", label: "Recent roadmap activity", uri: "roadmap://recent", source: "roadmap" });
        }
        push({
          kind: "done",
          messageId: crypto.randomUUID(),
          tokensIn: Math.ceil(message.length / 4),
          tokensOut: Math.ceil(reply.length / 4),
        });
        controller.close();
      } catch {
        if (!abortSignal?.aborted) {
          push({ kind: "error", message: "The Strategist could not complete that request.", code: "STRATEGIST_ERROR" });
          controller.close();
        }
      }
    },
  });
}
