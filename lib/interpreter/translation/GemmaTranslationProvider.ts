/**
 * Model-backed translation.
 *
 * Outranks the rule engine because a model handles what a rule grammar cannot:
 * idiom, classifier constructions, role shift, and the register shifts that make
 * a phrase read naturally rather than merely correctly. It asks Gemma for the
 * gloss and word order only - phonological parameters still come from the curated
 * lexicon, so the model can restructure a sentence but cannot invent a sign that
 * does not exist.
 *
 * That split is the important part. Letting a model produce handshapes directly
 * is how machine signing generates confident nonsense, and a Deaf viewer has no
 * way to tell it apart from correct output.
 *
 * The result is still `machine-synthetic`. A model does not confer certification.
 */

import { gemmaHeaders } from "@/lib/gemma/browser-key";
import { MACHINE_SYNTHETIC, type SignSequence, describeSignLanguage } from "../types/gestures";
import { classifyIntent } from "../segmentation/segmentText";
import { intentMarker } from "./grammar";
import { SIGNABLE_GLOSSES } from "./lexicon";
import { buildGestures, realizeGloss, type RealizedSign } from "./realize";
import { RuleBasedTranslationProvider } from "./RuleBasedTranslationProvider";
import {
  registerTranslationProvider,
  type SignTranslationProvider,
  type TranslationRequest,
} from "./SignTranslationProvider";

/** Segments per request. Batching is what makes a network provider viable at all. */
const BATCH_SIZE = 8;
/** Backoff after a failure, so a missing key does not turn one lesson into dozens of failed calls. */
const BACKOFF_MS = 60_000;

type GlossResponse = { glosses?: Array<{ segmentId?: string; gloss?: string }> };

const cache = new Map<string, string>();
const cacheKey = (segmentId: string, language: string) => `${language}:${segmentId}`;

let unavailableUntil = 0;

const fallback = (request: TranslationRequest): SignSequence =>
  RuleBasedTranslationProvider.translate(request) as SignSequence;

/** Builds a sequence from a model-produced gloss, resolving every token through the lexicon. */
function sequenceFromGloss(request: TranslationRequest, gloss: string): SignSequence {
  const { segment, language } = request;
  const marker = intentMarker(classifyIntent(segment.text), /\b(NOT|NEVER)\b/.test(gloss));

  const signs: RealizedSign[] = gloss
    .split(/\s+/)
    .filter(Boolean)
    .flatMap((token) => realizeGloss(token, language, 0.9));

  if (signs.length === 0) return fallback(request);

  const built = buildGestures({
    signs,
    startTime: segment.startTime,
    budgetSeconds: request.budgetSeconds ?? segment.endTime - segment.startTime,
    marker,
    idPrefix: `${segment.id}-m`,
  });

  return {
    segmentId: segment.id,
    language,
    gestures: built.gestures,
    duration: built.duration,
    startTime: segment.startTime,
    gloss: built.gloss,
    providerId: "gemma-gloss",
    certification: MACHINE_SYNTHETIC,
  };
}

async function fetchGlosses(requests: TranslationRequest[]): Promise<Map<string, string>> {
  const descriptor = describeSignLanguage(requests[0].language);
  const response = await fetch("/api/interpreter", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...gemmaHeaders() },
    body: JSON.stringify({
      kind: "gloss",
      language: descriptor.abbreviation,
      languageName: descriptor.name,
      // Constrains the model to glosses the renderer can articulate, so it
      // reaches for a real sign before it reaches for fingerspelling.
      vocabulary: SIGNABLE_GLOSSES,
      segments: requests.map((request) => ({ id: request.segment.id, text: request.segment.text })),
    }),
    signal: requests[0].signal,
  });
  if (!response.ok) throw new Error(`Gloss request failed: ${response.status}`);
  const payload = (await response.json()) as GlossResponse;

  const result = new Map<string, string>();
  for (const item of payload.glosses ?? []) {
    if (typeof item.segmentId === "string" && typeof item.gloss === "string" && item.gloss.trim()) {
      result.set(item.segmentId, item.gloss.trim());
    }
  }
  return result;
}

export const GemmaTranslationProvider: SignTranslationProvider = {
  id: "gemma-gloss",
  label: "Gemma gloss model",
  rank: 50,
  synchronous: false,
  supportedLanguages: () => ["ase", "bfi", "ins"],

  translate: async (request) => {
    const results = await (GemmaTranslationProvider.translateBatch?.([request]) ?? Promise.resolve([]));
    return results[0] ?? fallback(request);
  },

  translateBatch: async (requests) => {
    if (requests.length === 0) return [];
    if (Date.now() < unavailableUntil) return requests.map(fallback);

    const pending: TranslationRequest[] = [];
    const results = new Map<string, SignSequence>();

    for (const request of requests) {
      const cached = cache.get(cacheKey(request.segment.id, request.language));
      if (cached) results.set(request.segment.id, sequenceFromGloss(request, cached));
      else pending.push(request);
    }

    for (let index = 0; index < pending.length; index += BATCH_SIZE) {
      const slice = pending.slice(index, index + BATCH_SIZE);
      try {
        const glosses = await fetchGlosses(slice);
        for (const request of slice) {
          const gloss = glosses.get(request.segment.id);
          if (gloss) {
            cache.set(cacheKey(request.segment.id, request.language), gloss);
            results.set(request.segment.id, sequenceFromGloss(request, gloss));
          } else {
            results.set(request.segment.id, fallback(request));
          }
        }
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") throw error;
        unavailableUntil = Date.now() + BACKOFF_MS;
        for (const request of slice) results.set(request.segment.id, fallback(request));
      }
    }

    return requests.map((request) => results.get(request.segment.id) ?? fallback(request));
  },
};

registerTranslationProvider(GemmaTranslationProvider);
