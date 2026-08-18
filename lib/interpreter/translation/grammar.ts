/**
 * Sign language syntax.
 *
 * This module exists to enforce one rule from the brief: never translate word by
 * word. ASL, BSL and ISL are not English with the hands - they have their own
 * word order, their own topic marking, and they carry tense, negation and
 * question type on the face rather than in the sign stream.
 *
 * So the unit of translation is a whole segment. A segment arrives as English,
 * gets tagged, gets reordered into the target language's syntax, and only then
 * becomes signs. Anything that maps English tokens directly onto signs in source
 * order is producing signed English, which fluent signers find harder to read
 * than captions.
 *
 * Scope, stated plainly: this is a register-specific rule grammar tuned to the
 * study-skills language the Action Lab lessons use. It is not a parser and it is
 * not a substitute for a trained interpreter. It is the deterministic baseline
 * that a model-backed provider can beat - see GemmaTranslationProvider.
 */

import type { SignLanguageCode, NonManualMarker } from "../types/gestures";
import { classifyIntent, type SegmentIntent } from "../segmentation/segmentText";
import { FUNCTION_WORDS, isKnownLexeme } from "./lexicon";

/** Coarse tag set. Enough to drive word order; deliberately not a full POS set. */
export type Tag = "time" | "pronoun" | "noun" | "verb" | "adjective" | "negation" | "question" | "number" | "conjunction";

export type TaggedToken = {
  /** Lemma, ready for lexicon lookup. */
  lemma: string;
  /** Original surface form, kept for fingerspelling and for the gloss track. */
  surface: string;
  tag: Tag;
  /** Set when the source marked plural or repetition; drives reduplication. */
  plural?: boolean;
};

const TIME_WORDS = new Set([
  "today", "tomorrow", "yesterday", "now", "then", "before", "after", "first",
  "second", "next", "last", "always", "never", "often", "sometimes", "every",
  "daily", "week", "day", "minute", "hour", "year", "month", "later", "soon",
  "already", "still", "when", "while", "during", "finally",
]);

const PRONOUNS = new Set(["i", "you", "he", "she", "it", "we", "they", "me", "him", "her", "us", "them", "my", "your", "his", "their", "our", "this", "that", "these", "those"]);

const NEGATIONS = new Set(["not", "no", "never", "cannot", "none", "neither", "nor", "without"]);

const QUESTION_WORDS = new Set(["what", "where", "when", "why", "who", "whom", "whose", "which", "how"]);

const CONJUNCTIONS = new Set(["and", "but", "because", "or", "so", "if", "although", "though", "however", "therefore", "unless", "while", "whereas", "than"]);

/** Verbs common to this register that morphology alone would not identify. */
const VERB_HINTS = new Set([
  "read", "write", "listen", "hear", "speak", "say", "tell", "ask", "look",
  "watch", "see", "find", "scan", "skim", "check", "know", "think", "understand",
  "remember", "forget", "need", "must", "can", "use", "make", "give", "take",
  "go", "come", "start", "begin", "finish", "end", "continue", "move", "change",
  "correct", "explain", "describe", "compare", "choose", "select", "plan",
  "support", "connect", "link", "follow", "show", "mean", "matter", "save",
  "build", "cover", "leave", "wait", "earn", "guess", "copy", "underline",
  "cross", "add", "spend", "extend", "record", "lose", "practise", "practice",
  "study", "learn", "graph", "calculate", "convert", "memorise", "memorize",
  "name", "report", "state", "restate", "repeat", "appear", "grow", "double",
  "substitute", "discuss", "contradict", "paraphrase", "answer", "score", "test",
]);

const ADJECTIVE_HINTS = new Set([
  "good", "bad", "right", "wrong", "important", "hard", "difficult", "easy",
  "fast", "quick", "slow", "long", "short", "new", "same", "different", "main",
  "specific", "general", "academic", "natural", "normal", "clear", "strong",
  "weak", "empty", "complex", "simple", "concrete", "key", "positive",
  "negative", "parallel", "true", "false", "correct", "hardest", "best",
]);

const CONTRACTIONS: Record<string, string> = {
  cannot: "cannot", "can't": "cannot", cant: "cannot",
  "don't": "not", dont: "not", "doesn't": "not", doesnt: "not",
  "didn't": "not", didnt: "not", "won't": "not", wont: "not",
  "isn't": "not", isnt: "not", "aren't": "not", arent: "not",
  "shouldn't": "not", shouldnt: "not", "it's": "it", its: "it",
  "you're": "you", youre: "you", "they're": "they", theyre: "they",
};

/**
 * Strips English inflection that sign languages do not carry on the sign itself.
 * Plurality survives as a flag because it becomes reduplication, not a suffix.
 */
export function normalizeLemma(word: string): { lemma: string; plural: boolean } {
  const clean = word.toLowerCase().replace(/[^a-z0-9'-]/g, "");
  if (!clean) return { lemma: "", plural: false };

  // An all-capital token is an acronym or a proper noun, never an inflected word.
  // Stemming one produces a non-word ("IELTS" -> "ielt") that then fails lookup
  // and gets spelled anyway - but spelled wrong, minus its last letter.
  if (/^[A-Z0-9]{2,}$/.test(word.replace(/[^A-Za-z0-9]/g, ""))) {
    return { lemma: clean, plural: false };
  }

  // Contractions resolve to the lemma the lexicon actually holds. Without this
  // "cannot" falls through to the plural rule, stems to "cannot"/"cant", misses
  // the lexicon, and gets fingerspelled letter by letter.
  const contraction = CONTRACTIONS[clean];
  if (contraction) return { lemma: contraction, plural: false };

  // A word the lexicon already knows is never stemmed. This is the guard that
  // stops "this" becoming "thi": the plural rule cannot tell a genuine plural
  // from a word that simply ends in s, so the known form always wins.
  if (isKnownLexeme(clean)) return { lemma: clean, plural: false };

  if (clean.length <= 3) return { lemma: clean, plural: false };

  if (clean.endsWith("ies") && clean.length > 4) return { lemma: `${clean.slice(0, -3)}y`, plural: true };
  if (clean.endsWith("ses") || clean.endsWith("xes") || clean.endsWith("ches") || clean.endsWith("shes")) {
    return { lemma: clean.slice(0, -2), plural: true };
  }
  if (clean.endsWith("ing")) {
    const stem = clean.slice(0, -3);
    // "planning" -> "plan": undo the doubled consonant.
    if (stem.length > 2 && stem[stem.length - 1] === stem[stem.length - 2]) return { lemma: stem.slice(0, -1), plural: false };
    return { lemma: VERB_HINTS.has(stem) ? stem : `${stem}e`, plural: false };
  }
  if (clean.endsWith("ed") && clean.length > 4) {
    const stem = clean.slice(0, -2);
    return { lemma: VERB_HINTS.has(stem) ? stem : clean.slice(0, -1), plural: false };
  }
  if (clean.endsWith("ly") && clean.length > 4) return { lemma: clean.slice(0, -2), plural: false };
  if (clean.endsWith("s") && !clean.endsWith("ss") && !clean.endsWith("us")) {
    const stem = clean.slice(0, -1);
    // Third-person verb agreement is not plurality.
    return { lemma: stem, plural: !VERB_HINTS.has(stem) };
  }
  return { lemma: clean, plural: false };
}

/**
 * Negatives that are also temporal adverbs. They are signed in the time slot,
 * not the negation slot, but they still trigger the headshake that spans the
 * clause - so they need to be recognised as both.
 */
const TEMPORAL_NEGATIVES = new Set(["never"]);

function tagToken(lemma: string): Tag {
  if (QUESTION_WORDS.has(lemma)) return "question";
  // Checked before NEGATIONS: NEVER is a sign in its own right and must survive
  // into the output, not be swallowed by the negation slot.
  if (TEMPORAL_NEGATIVES.has(lemma)) return "time";
  if (NEGATIONS.has(lemma)) return "negation";
  if (TIME_WORDS.has(lemma)) return "time";
  if (PRONOUNS.has(lemma)) return "pronoun";
  if (CONJUNCTIONS.has(lemma)) return "conjunction";
  if (/^\d+$/.test(lemma)) return "number";
  if (VERB_HINTS.has(lemma)) return "verb";
  if (ADJECTIVE_HINTS.has(lemma)) return "adjective";
  return "noun";
}

/** English text -> tagged tokens, with function words already dropped. */
export function tagSegment(text: string): TaggedToken[] {
  return text
    .split(/\s+/)
    .map((surface) => {
      const { lemma, plural } = normalizeLemma(surface);
      return { surface: surface.replace(/[.,!?;:]$/, ""), lemma, plural };
    })
    .filter((token) => token.lemma.length > 0)
    // Copulas, articles and most prepositions have no sign. Dropping them is
    // correct translation, not data loss - they are recoverable from context.
    //
    // Both forms are tested because normalisation runs first and mangles
    // inflected function words: "does" stems to "doe", which is in no list and
    // would otherwise survive into the output as a fingerspelled non-word.
    .filter((token) => !FUNCTION_WORDS.has(token.lemma) && !FUNCTION_WORDS.has(token.surface.toLowerCase()))
    .map((token) => ({ ...token, tag: tagToken(token.lemma) }));
}

/**
 * Non-manual marker for the segment as a whole.
 *
 * In all three languages this is grammar: brows raised through a yes/no question,
 * furrowed through a wh-question, headshake spanning a negation. It applies to
 * the whole phrase, not to one sign, which is why it is computed here rather
 * than looked up per-word.
 */
export function intentMarker(intent: SegmentIntent, negated: boolean): NonManualMarker {
  const base: NonManualMarker = (() => {
    switch (intent) {
      case "yes-no-question":
        return { brows: "raised", head: "forward", eyes: "wide" };
      case "wh-question":
        return { brows: "furrowed", head: "tilt-left", eyes: "squint" };
      case "command":
        return { brows: "neutral", head: "nod", eyes: "wide" };
      case "exclamation":
        return { brows: "raised", head: "nod", eyes: "wide" };
      default:
        return { brows: "neutral", head: "neutral", eyes: "neutral" };
    }
  })();
  return negated ? { ...base, head: "shake", brows: base.brows === "raised" ? "raised" : "furrowed" } : base;
}

type Ordered = { tokens: TaggedToken[]; marker: NonManualMarker };

/**
 * Reorders tagged English into the target language's syntax.
 *
 * ASL and BSL are topic-comment languages: establish what you are talking about,
 * then say something about it, with time set up first because it scopes the whole
 * utterance. ISL is subject-object-verb. All three move the wh-word to the end,
 * which is the single most visible difference from English and the thing that
 * makes signed English read as foreign.
 */
export function applyGrammar(tokens: TaggedToken[], language: SignLanguageCode, intent: SegmentIntent): Ordered {
  const negated = tokens.some((token) => token.tag === "negation" || TEMPORAL_NEGATIVES.has(token.lemma));
  const marker = intentMarker(intent, negated);

  const time = tokens.filter((token) => token.tag === "time");
  const questions = tokens.filter((token) => token.tag === "question");
  const negation = tokens.filter((token) => token.tag === "negation");
  const rest = tokens.filter(
    (token) => token.tag !== "time" && token.tag !== "question" && token.tag !== "negation" && token.tag !== "conjunction",
  );

  const pronouns = rest.filter((token) => token.tag === "pronoun");
  const verbs = rest.filter((token) => token.tag === "verb");
  const others = rest.filter((token) => token.tag !== "pronoun" && token.tag !== "verb");

  let ordered: TaggedToken[];
  switch (language) {
    case "ins":
      // ISL: TIME - SUBJECT - OBJECT - VERB - NEGATION - QUESTION
      ordered = [...time, ...pronouns, ...others, ...verbs, ...negation, ...questions];
      break;
    case "bfi":
      // BSL: also topic-comment with the question word final, and for this
      // register the ordering genuinely matches ASL. The differences that do
      // exist between the two are lexical and phonological rather than syntactic
      // - a two-handed manual alphabet and a substantially different sign
      // inventory - and those live in the lexicon, not here. Encoding a fake
      // word-order difference to make the languages look distinct would be worse
      // than sharing the rule and saying so.
      ordered = [...time, ...others, ...pronouns, ...verbs, ...negation, ...questions];
      break;
    case "ase":
    default:
      // ASL: TIME - TOPIC - SUBJECT - VERB - NEGATION - QUESTION.
      // Negation follows the verb it scopes; the headshake spans both.
      ordered = [...time, ...others, ...pronouns, ...verbs, ...negation, ...questions];
      break;
  }

  // A phrase with no content left after filtering is not signable. Fall back to
  // the original token order rather than emitting nothing.
  return { tokens: ordered.length ? ordered : tokens, marker };
}

export { classifyIntent };
export type { SegmentIntent };
