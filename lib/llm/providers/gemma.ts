/** The sole generative-model adapter in the Gemma 4 competition build. */

import { ThinkingLevel, type FunctionDeclaration } from "@google/genai";
import {
  DEFAULT_GEMMA_MODEL,
  gemmaClient,
  getGemmaModelId,
  hasGemmaKey,
} from "../gemma";
import type {
  ChatMessage,
  LLMProvider,
  LLMStreamChunk,
  ModelDescriptor,
  StreamRequest,
  ToolCall,
} from "./types";

type GenPart =
  | { text: string }
  | { functionCall: { name: string; args: Record<string, unknown> } }
  | { functionResponse: { id?: string; name: string; response: Record<string, unknown> } };

/**
 * Maps one transport message onto Gemma content parts.
 *
 * A turn carrying tool results is sent with the "user" role: the API models a
 * function response as input to the next generation, not as model output.
 */
function toContent(message: ChatMessage): { role: string; parts: GenPart[] } {
  if (message.toolResults?.length) {
    return {
      role: "user",
      parts: message.toolResults.map((result) => ({
        functionResponse: {
          ...(result.id ? { id: result.id } : {}),
          name: result.name,
          // The API requires an object; primitives are wrapped under "output".
          response:
            result.result !== null &&
            typeof result.result === "object" &&
            !Array.isArray(result.result)
              ? (result.result as Record<string, unknown>)
              : { output: result.result },
        },
      })),
    };
  }
  if (message.toolCalls?.length) {
    const parts: GenPart[] = message.toolCalls.map((call) => ({
      functionCall: { name: call.name, args: call.args },
    }));
    if (message.content) parts.unshift({ text: message.content });
    return { role: "model", parts };
  }
  return {
    role: message.role === "assistant" ? "model" : "user",
    parts: [{ text: message.content }],
  };
}

const MODELS: ModelDescriptor[] = [
  {
    id: DEFAULT_GEMMA_MODEL,
    label: "Polaris AI",
    tier: "free",
    contextWindow: 262_144,
    capabilities: { longContext: true, reasoning: true, code: true },
    preferredFor: ["general", "research", "study", "coding"],
    modes: ["fast", "balanced", "advanced", "reasoning"],
  },
];

export const gemmaProvider: LLMProvider = {
  id: "gemma",
  name: "Polaris",
  defaultTier: "free",
  isConfigured: hasGemmaKey,
  listModels: () =>
    MODELS.map((model) => ({
      ...model,
      id: getGemmaModelId(),
      label:
        getGemmaModelId() === "gemma-4-31b-it"
          ? "Polaris AI Advanced"
          : "Polaris AI",
    })),
  async *streamChat(req: StreamRequest): AsyncGenerator<LLMStreamChunk> {
    const client = gemmaClient();
    if (!client) throw new Error("Polaris AI is not configured");

    const contents = req.messages.map(toContent);
    if (contents.length === 0) throw new Error("Empty messages array");

    const stream = await client.models.generateContentStream({
      model: getGemmaModelId(),
      contents,
      config: {
        systemInstruction: req.system,
        temperature: req.temperature ?? 0.55,
        maxOutputTokens: req.maxOutputTokens ?? 1800,
        thinkingConfig: {
          thinkingLevel:
            req.thinkingLevel === "minimal"
              ? ThinkingLevel.MINIMAL : ThinkingLevel.HIGH,
          includeThoughts: false,
        },
        // The transport type is provider-agnostic; translating it to the
        // SDK's Schema shape is this adapter's job.
        ...(req.tools?.length
          ? { tools: [{ functionDeclarations: req.tools as unknown as FunctionDeclaration[] }] }
          : {}),
        ...(req.abortSignal ? { abortSignal: req.abortSignal } : {}),
      },
    });

    let tokensIn = 0;
    let tokensOut = 0;
    // Calls arrive alongside text and are replayed to the caller as one batch
    // at the end of the turn, which is the unit the tool loop acts on.
    const calls: ToolCall[] = [];
    for await (const piece of stream) {
      if (req.abortSignal?.aborted) return;
      const text = piece.text;
      if (text) yield { kind: "text", delta: text };
      for (const call of piece.functionCalls ?? []) {
        if (!call.name) continue;
        calls.push({
          id: call.id ?? `${call.name}-${calls.length}`,
          name: call.name,
          args: (call.args ?? {}) as Record<string, unknown>,
        });
      }
      tokensIn = piece.usageMetadata?.promptTokenCount ?? tokensIn;
      tokensOut = piece.usageMetadata?.candidatesTokenCount ?? tokensOut;
    }

    if (calls.length) yield { kind: "tool_call", calls };
    yield { kind: "done", tokensIn, tokensOut };
  },
};
