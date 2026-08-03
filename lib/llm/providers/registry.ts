/**
 * Central provider registry.
 *
 * Aggregates every adapter, exposes the configured/available set, and
 * provides lookup helpers used by the router + the dropdown API.
 *
 * Providers self-report whether they're configured (env var present /
 * local service reachable). We cache the "configured" verdict for 30s so
 * UI lookups don't hammer the network.
 */

import { gemmaProvider } from "./gemma";
import type { LLMProvider, ModelDescriptor, ResolvedModel } from "./types";

export const ALL_PROVIDERS: LLMProvider[] = [
  gemmaProvider,
];

export function getProvider(id: string): LLMProvider | null {
  return ALL_PROVIDERS.find((p) => p.id === id) ?? null;
}

/** Snapshot of one provider for the API/UI: configured + model list. */
export type ProviderInfo = {
  id: string;
  name: string;
  defaultTier: LLMProvider["defaultTier"];
  configured: boolean;
  models: ModelDescriptor[];
};

/** Build the list of providers and their models for the dropdown. */
export async function listAvailableProviders(): Promise<ProviderInfo[]> {
  const results = await Promise.all(
    ALL_PROVIDERS.map(async (p): Promise<ProviderInfo> => {
      const configured = await Promise.resolve(p.isConfigured());
      const models = configured
        ? await Promise.resolve(p.listModels())
        : await Promise.resolve(p.listModels()).catch(() => []);
      return {
        id: p.id,
        name: p.name,
        defaultTier: p.defaultTier,
        configured,
        models,
      };
    }),
  );
  return results;
}

/**
 * Look up a provider + model pair by string ids. Returns null if either
 * the provider isn't configured or the model isn't available.
 */
export async function resolveModel(
  providerId: string,
  modelId: string,
): Promise<ResolvedModel | null> {
  const p = getProvider(providerId);
  if (!p) return null;
  const ok = await Promise.resolve(p.isConfigured());
  if (!ok) return null;
  const models = await Promise.resolve(p.listModels());
  const m = models.find((x) => x.id === modelId);
  if (!m) return null;
  return { provider: p, model: m };
}
