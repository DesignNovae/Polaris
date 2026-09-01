/**
 * Auditable model boundary types. The competition registry contains exactly
 * one generative adapter: Gemma 4.
 */

export type ChatRole = "system" | "user" | "assistant";

/** One function the model may call, declared in JSON-Schema shape. */
export type ToolDeclaration = {
  name: string;
  description: string;
  parameters: {
    type: "object";
    properties: Record<string, unknown>;
    required?: string[];
  };
};

/** A call the model asked for. `id` correlates the result back to it. */
export type ToolCall = {
  id: string;
  name: string;
  args: Record<string, unknown>;
};

/** The value a tool returned, sent back on the next turn. */
export type ToolResult = {
  id: string;
  name: string;
  result: unknown;
};

export type ChatMessage = {
  role: ChatRole;
  content: string;
  /** Calls this assistant turn requested. Replayed so the model sees its own move. */
  toolCalls?: ToolCall[];
  /** Results answering the previous assistant turn's calls. */
  toolResults?: ToolResult[];
};

/** A single chunk emitted by `streamChat`. */
export type LLMStreamChunk =
  | { kind: "text"; delta: string }
  /** Emitted when the provider has finished a search/grounding sub-step. */
  | {
      kind: "web_source";
      uri: string;
      title: string;
    }
  /**
   * Emitted once at the end of a turn in which the model requested tools.
   * The caller runs them and sends the results back as a follow-up turn.
   */
  | { kind: "tool_call"; calls: ToolCall[] }
  /** Emitted exactly once when the stream ends. */
  | {
      kind: "done";
      tokensIn?: number;
      tokensOut?: number;
      searchQueries?: string[];
    };

export type ProviderTier = "free" | "paid" | "local";
export type TaskKind = "general" | "research" | "study" | "coding";

/**
 * User-facing speed/quality preset. Orthogonal to TaskKind: the task says
 * WHAT the request is, the mode says HOW the user wants it served -
 * fast (low latency), balanced (default), advanced (strongest model),
 * reasoning (multi-step thinking).
 */
export type RouteMode = "fast" | "balanced" | "advanced" | "reasoning";

/** Static descriptor for a model exposed by a provider. */
export type ModelDescriptor = {
  /** Whitelisted model id returned in API responses. */
  id: string;
  /** Human label for the dropdown. */
  label: string;
  /** "free" / "paid" / "local" - drives the cost optimizer + UI tag. */
  tier: ProviderTier;
  /** Optional approximate cost per 1K output tokens (USD). 0 for free/local. */
  costPer1k?: number;
  /** Approximate context window (tokens). */
  contextWindow: number;
  /** Capability flags the router consults. */
  capabilities?: {
    /** Provider runs a native web search tool. */
    search?: boolean;
    /** Strong at long documents (>32K tokens). */
    longContext?: boolean;
    /** Strong at code synthesis. */
    code?: boolean;
    /** Strong at multi-step reasoning. */
    reasoning?: boolean;
  };
  /** Tasks this model is preferred for when auto-selecting. */
  preferredFor?: TaskKind[];
  /** Speed/quality presets this model is a strong pick for. */
  modes?: RouteMode[];
  /** Previous-generation model; hidden from the dropdown by default. */
  legacy?: boolean;
};

export type StreamRequest = {
  model: string;
  /** System instruction passed to Gemma 4. */
  system: string;
  messages: ChatMessage[];
  temperature?: number;
  maxOutputTokens?: number;
  /** Gemma 4 supports minimal or high internal reasoning. */
  thinkingLevel?: "minimal" | "high";
  /** When true and provider supports it, enable the native web-search/grounding tool. */
  webSearch?: boolean;
  /** Functions the model may call. Omit or leave empty to disable tool use. */
  tools?: ToolDeclaration[];
  abortSignal?: AbortSignal;
};

/** Common shape every provider adapter satisfies. */
export interface LLMProvider {
  /** Stable provider id; always "gemma" in this build. */
  id: string;
  /** Display name. */
  name: string;
  /** True if env vars / local service is reachable so the provider is usable. */
  isConfigured(): boolean | Promise<boolean>;
  /** All models the provider exposes (may be filtered later by config). */
  listModels(): Promise<ModelDescriptor[]> | ModelDescriptor[];
  /** Streamed chat completion. */
  streamChat(req: StreamRequest): AsyncGenerator<LLMStreamChunk>;
  /** Short tag for the UI: "free", "paid", "local". */
  defaultTier: ProviderTier;
}

/**
 * Resolved provider + model pair returned by the router. The orchestrator
 * always works with this struct rather than raw strings.
 */
export type ResolvedModel = {
  provider: LLMProvider;
  model: ModelDescriptor;
};
