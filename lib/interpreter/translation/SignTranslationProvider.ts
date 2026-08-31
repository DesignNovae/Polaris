/**
 * Translation stage contract.
 *
 *   ... -> Segmentation -> [Translation] -> Gesture Sequence -> Renderer
 *
 * A provider turns a *segment* into a sign sequence. Never a word - the unit is
 * always a complete proposition, so the provider is free to reorder, drop and
 * restructure, which is what translating into a sign language requires.
 *
 * Nothing here knows how a gesture will be drawn, and nothing here knows what the
 * video is doing. That is the whole point: swapping this layer for an AI model, a
 * cloud service, a local ML runtime, or a library of certified interpreter clips
 * requires no change to rendering or synchronisation.
 */

import type { SignLanguageCode, SignSequence } from "../types/gestures";
import type { TranscriptSegment } from "../types/transcript";

export type TranslationRequest = {
  segment: TranscriptSegment;
  language: SignLanguageCode;
  /**
   * Seconds available to articulate. Usually the segment span, but the caller may
   * shorten it when the media is running fast.
   */
  budgetSeconds?: number;
  signal?: AbortSignal;
};

export interface SignTranslationProvider {
  readonly id: string;
  /** Shown in the provenance readout. */
  readonly label: string;
  /**
   * Higher wins when several providers can serve a language. Certified clip
   * libraries rank above models, which rank above the rule engine.
   */
  readonly rank: number;
  /** True when the provider can return synchronously - lets the caller skip a tick. */
  readonly synchronous: boolean;

  supportedLanguages(): SignLanguageCode[];
  translate(request: TranslationRequest): Promise<SignSequence> | SignSequence;
  /**
   * Batch entry point. Providers with per-call overhead (network, model load)
   * override this; the default just maps over `translate`.
   */
  translateBatch?(requests: TranslationRequest[]): Promise<SignSequence[]>;
}

export class TranslationUnsupportedError extends Error {
  constructor(readonly language: SignLanguageCode, readonly providerId: string) {
    super(`${providerId} does not support ${language}`);
    this.name = "TranslationUnsupportedError";
  }
}

const providers = new Map<string, SignTranslationProvider>();

export function registerTranslationProvider(provider: SignTranslationProvider): void {
  providers.set(provider.id, provider);
}

export function listTranslationProviders(): SignTranslationProvider[] {
  return [...providers.values()].sort((a, b) => b.rank - a.rank);
}

/** Highest-ranked provider that supports the language, or null. */
export function selectTranslationProvider(language: SignLanguageCode): SignTranslationProvider | null {
  return listTranslationProviders().find((provider) => provider.supportedLanguages().includes(language)) ?? null;
}

/** Every language any registered provider can serve. Drives the language control. */
export function supportedLanguages(): SignLanguageCode[] {
  const codes = new Set<SignLanguageCode>();
  for (const provider of providers.values()) {
    for (const code of provider.supportedLanguages()) codes.add(code);
  }
  return [...codes];
}

/**
 * Translates a batch through the best available provider.
 *
 * Falls back one rank at a time rather than failing the whole batch: a model
 * provider timing out should degrade to the rule engine, not to a blank panel.
 */
export async function translateSegments(requests: TranslationRequest[]): Promise<SignSequence[]> {
  if (requests.length === 0) return [];
  const language = requests[0].language;
  const chain = listTranslationProviders().filter((provider) => provider.supportedLanguages().includes(language));
  if (chain.length === 0) throw new TranslationUnsupportedError(language, "chain");

  let lastError: unknown;
  for (const provider of chain) {
    try {
      if (provider.translateBatch) return await provider.translateBatch(requests);
      return await Promise.all(requests.map((request) => provider.translate(request)));
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") throw error;
      lastError = error;
    }
  }
  throw lastError instanceof Error ? lastError : new Error("Every translation provider failed");
}
