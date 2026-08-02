/**
 * Gemma 4-only model router.
 *
 * The public request shape stays backward compatible with existing clients,
 * but every preference, mode, and stale database value resolves to the same
 * audited Gemma 4 provider. Deterministic code is the only fallback.
 */

import { getProvider } from "./providers/registry";
import { getGemmaModelId, GEMMA_PROVIDER_ID } from "./gemma";
import type {
  LLMProvider,
  ResolvedModel,
  RouteMode,
  TaskKind,
} from "./providers/types";

export type RouteRequest = {
  task: TaskKind;
  mode?: RouteMode;
  preferred?: { providerId: string; modelId: string };
  offline?: boolean;
  autoSelect?: boolean;
  allowPaid?: boolean;
};

export type RouteResult = {
  chosen: ResolvedModel;
  reason: string;
  fallbacks: ResolvedModel[];
};

export async function chooseModel(
  request: RouteRequest,
): Promise<RouteResult | null> {
  const provider = getProvider(GEMMA_PROVIDER_ID);
  if (!provider || !(await Promise.resolve(provider.isConfigured()))) {
    return null;
  }

  const modelId = getGemmaModelId();
  const models = await Promise.resolve(provider.listModels());
  const model = models.find((candidate) => candidate.id === modelId);
  if (!model) return null;

  const thinking =
    request.mode === "reasoning" || request.mode === "advanced"
      ? "high-thinking"
      : "efficient-thinking";

  return {
    chosen: { provider, model },
    reason: `Gemma 4-only policy: ${model.label} (${thinking}) for ${request.task}.`,
    fallbacks: [],
  };
}

/** No generative-model fallback is permitted by the competition rules. */
export function pickFallback(_result: RouteResult): RouteResult | null {
  return null;
}

export function providerById(id: string): LLMProvider | null {
  return id === GEMMA_PROVIDER_ID ? getProvider(id) : null;
}
