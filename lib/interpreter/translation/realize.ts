/**
 * Shared realisation: ordered glosses -> timed gestures.
 *
 * Both the rule engine and the model provider end up at the same place - a list
 * of signs that needs handshapes attached and a duration budget divided between
 * them. Only the route to that list differs. Keeping realisation here means a new
 * provider inherits correct timing, correct fingerspelling and correct non-manual
 * handling for free, and cannot quietly diverge from the others.
 */

import type {
  Gesture,
  GestureMetadata,
  HandShapeId,
  NonManualMarker,
  SignLanguageCode,
} from "../types/gestures";
import { distributeDuration } from "../utils/timeline";
import { lookupSign } from "./lexicon";
import { normalizeLemma } from "./grammar";

/** One resolved sign, before it has been given a place on the clock. */
export type RealizedSign = {
  /** Gloss label, or "" for continuation letters inside a fingerspelled word. */
  gloss: string;
  /** Relative articulation cost, used to divide the segment's duration. */
  weight: number;
  meta: GestureMetadata;
};

/** Fingerspelled letters are quick relative to a lexical sign. */
export const LETTER_WEIGHT = 0.34;
/** Silence between sequences so consecutive phrases do not blur together. */
export const INTER_SIGN_GAP = 0.04;
/** Nothing readable is shorter than this. */
export const MIN_GESTURE_SECONDS = 0.09;

/**
 * Manual-alphabet handshapes. Letters sharing a handshape in the real alphabet
 * share one here; letters without a distinct entry fall back to the nearest
 * contrastive shape rather than inventing a form.
 */
const LETTER_SHAPES: Record<string, HandShapeId> = {
  a: "a", b: "flat-b", c: "c", d: "d", e: "claw", f: "f", g: "g", h: "u",
  i: "i", j: "i", k: "v", l: "l", m: "s-fist", n: "n", o: "o", p: "v",
  q: "g", r: "r", s: "s-fist", t: "a", u: "u", v: "v", w: "w", x: "one",
  y: "y", z: "one",
};

/**
 * Spells a word letter by letter.
 *
 * This is the honest fallback for anything outside the lexicon - proper nouns,
 * technical terms, brand names. Fingerspelling is what a human interpreter does
 * in exactly this situation, and it is always better than substituting a sign
 * that means something else.
 */
export function fingerspell(word: string, language: SignLanguageCode): RealizedSign[] {
  const letters = word.toLowerCase().replace(/[^a-z0-9]/g, "").split("");
  if (letters.length === 0) return [];
  const label = word.replace(/[^A-Za-z0-9]/g, "").toUpperCase();

  return letters.map((letter, index) => ({
    gloss: index === 0 ? `fs-${label}` : "",
    weight: LETTER_WEIGHT,
    meta: {
      handShape: LETTER_SHAPES[letter] ?? "five",
      location: "side-high",
      movement: index === 0 ? "straight" : "hold",
      // A two-handed manual alphabet articulates against the weak hand.
      handedness: language === "ase" ? "dominant" : "both-same",
      palm: "out",
      fingerspelled: true,
      sourceText: letter,
      confidence: 0.75,
    },
  }));
}

/**
 * Resolves one gloss token to signs.
 *
 * `fs-` prefixed tokens are spelled on request. Unknown tokens are spelled rather
 * than approximated: a wrong sign reads as a confident lie, a spelled word reads
 * as a word the interpreter chose to spell.
 */
export function realizeGloss(token: string, language: SignLanguageCode, confidence = 1): RealizedSign[] {
  const fingerspelled = token.startsWith("fs-");
  const bare = fingerspelled ? token.slice(3) : token;
  const entry = fingerspelled ? null : lookupSign(normalizeLemma(bare).lemma, language);

  if (!entry) return fingerspell(bare, language);

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
      repeat: entry.repeat,
      sourceText: bare,
      confidence,
    },
  }];
}

/**
 * Places resolved signs on the media clock.
 *
 * Duration is divided by weight rather than evenly, because signs are not
 * isochronous - a held sign and a fingerspelled letter are not the same length,
 * and spacing them evenly is immediately recognisable as machine output.
 *
 * The phrase-level non-manual marker is merged over each sign's own marker:
 * sentence grammar outranks lexical decoration, so a headshake spanning a
 * negated clause survives a sign that would otherwise set a neutral brow.
 */
export function buildGestures(options: {
  signs: RealizedSign[];
  startTime: number;
  budgetSeconds: number;
  marker: NonManualMarker;
  idPrefix: string;
}): { gestures: Gesture[]; gloss: string; duration: number } {
  const { signs, startTime, marker, idPrefix } = options;
  const span = Math.max(0.4, options.budgetSeconds - INTER_SIGN_GAP);
  const durations = distributeDuration(signs.map((item) => item.weight), span);

  let cursor = startTime;
  const gestures: Gesture[] = signs.map((item, index) => {
    const duration = Math.max(MIN_GESTURE_SECONDS, durations[index]);
    const gesture: Gesture = {
      id: `${idPrefix}-${index}`,
      name: item.gloss || item.meta.sourceText?.toUpperCase() || "SIGN",
      startTime: cursor,
      endTime: cursor + duration,
      metadata: { ...item.meta, nonManual: { ...item.meta.nonManual, ...marker } },
    };
    cursor += duration;
    return gesture;
  });

  return {
    gestures,
    gloss: signs.map((item) => item.gloss).filter(Boolean).join(" "),
    duration: cursor - startTime,
  };
}
