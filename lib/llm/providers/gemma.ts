/** The sole generative-model adapter in the Gemma 4 competition build. */

import { ThinkingLevel } from "@google/genai";
import {
  DEFAULT_GEMMA_MODEL,
  gemmaClient,
  getGemmaModelId,
  hasGemmaKey,
} from "../gemma";
import type {
  LLMProvider,
  LLMStreamChunk,
  ModelDescriptor,
  StreamRequest,
} from "./types";

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

    const contents = req.messages.map((message) => ({
      role: message.role === "assistant" ? "model" : "user",
      parts: [{ text: message.content }],
    }));
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
        ...(req.abortSignal ? { abortSignal: req.abortSignal } : {}),
      },
    });

    let tokensIn = 0;
    let tokensOut = 0;
    for await (const piece of stream) {
      if (req.abortSignal?.aborted) return;
      const text = piece.text;
      if (text) yield { kind: "text", delta: text };
      tokensIn = piece.usageMetadata?.promptTokenCount ?? tokensIn;
      tokensOut = piece.usageMetadata?.candidatesTokenCount ?? tokensOut;
    }

    yield { kind: "done", tokensIn, tokensOut };
  },
};
