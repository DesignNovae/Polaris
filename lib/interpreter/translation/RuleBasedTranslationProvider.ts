/**
 * Deterministic translation from the curated lexicon and rule grammar.
 *
 * This is the baseline provider: no network, no key, no latency, identical output
 * for identical input. It runs the pipeline stage properly - tag, reorder into the
 * target syntax, resolve signs, fingerspell what it does not know, time the result
 * against the segment - and it is honest about its ceiling. A rule grammar over a
 * bounded lexicon reads well in this register and would produce nonsense outside
 * it, so it spells rather than guesses.
 *
 * Registered as `machine-synthetic`. It is not certified and does not claim to be.
 */

import { MACHINE_SYNTHETIC, type SignLanguageCode, type SignSequence } from "../types/gestures";
import { classifyIntent } from "../segmentation/segmentText";
import { applyGrammar, tagSegment, type TaggedToken } from "./grammar";
import { lookupSign } from "./lexicon";
import { buildGestures, fingerspell, type RealizedSign } from "./realize";
import {
  registerTranslationProvider,
  type SignTranslationProvider,
  type TranslationRequest,
} from "./SignTranslationProvider";

/** Resolves a tagged token to signs: a lexical sign when we have one, letters when we do not. */
function realizeToken(token: TaggedToken, language: SignLanguageCode): RealizedSign[] {
  const entry = lookupSign(token.lemma, language);
  if (!entry) return fingerspell(token.surface, language);

  return [{
    gloss: entry.gloss,
    weight: entry.weight ?? 1,
    meta: {
      handShape: entry.handShape,
      endHandShape: entry.endHandShape,
      location: entry.location,
      endLocation: entry.endLocation,
      movement: entry.movement,
      handedness: entry.handedness,
      palm: entry.palm,
      nonManual: entry.nonManual,
      sourceText: token.surface,
      // Plurality is reduplication in all three languages, never a suffix.
      repeat: token.plural ? Math.max(2, entry.repeat ?? 1) : entry.repeat,
      confidence: 1,
    },
  }];
}

function translateOne(request: TranslationRequest): SignSequence {
  const { segment, language } = request;
  const intent = classifyIntent(segment.text);
  const { tokens, marker } = applyGrammar(tagSegment(segment.text), language, intent);
  const signs = tokens.flatMap((token) => realizeToken(token, language));

  const { gestures, gloss, duration } = buildGestures({
    signs,
    startTime: segment.startTime,
    budgetSeconds: request.budgetSeconds ?? segment.endTime - segment.startTime,
    marker,
    idPrefix: `${segment.id}-r`,
  });

  return {
    segmentId: segment.id,
    language,
    gestures,
    duration,
    startTime: segment.startTime,
    gloss: gloss || segment.text.toUpperCase(),
    providerId: "polaris-rule-engine",
    certification: MACHINE_SYNTHETIC,
  };
}

export const RuleBasedTranslationProvider: SignTranslationProvider = {
  id: "polaris-rule-engine",
  label: "Polaris rule engine",
  rank: 30,
  synchronous: true,
  supportedLanguages: () => ["ase", "bfi", "ins"],
  translate: (request) => translateOne(request),
  translateBatch: async (requests) => requests.map(translateOne),
};

registerTranslationProvider(RuleBasedTranslationProvider);

/** Gloss-only view of a segment. Used by the diagnostics readout and by tests. */
export function glossSegment(text: string, language: SignLanguageCode): string {
  const { tokens } = applyGrammar(tagSegment(text), language, classifyIntent(text));
  return tokens
    .map((token) => lookupSign(token.lemma, language)?.gloss ?? `fs-${token.surface.toUpperCase()}`)
    .join(" ");
}
