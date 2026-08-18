/**
 * Semantic segmentation stage.
 *
 *   Video -> Transcript -> Alignment -> [Segmentation] -> Translation -> ...
 *
 * This is the stage that makes phrase-level translation possible, and it is the
 * reason the pipeline never signs word by word. Sign languages have their own
 * syntax; you cannot reorder a sentence into topic-comment order until you know
 * where the sentence ends. So segmentation runs before translation, always, and
 * translation is only ever handed a complete proposition.
 *
 * Pure string work: no DOM, no network, no provider imports.
 */

/** Abbreviations whose full stop does not end a sentence. */
const ABBREVIATIONS = new Set([
  "mr", "mrs", "ms", "dr", "prof", "st", "no", "vs", "etc", "e.g", "i.e",
  "a.m", "p.m", "fig", "approx", "dept", "univ", "jan", "feb", "mar", "apr",
  "jun", "jul", "aug", "sep", "sept", "oct", "nov", "dec",
]);

/**
 * Subordinators that open a clause worth signing as its own unit. Splitting here
 * keeps each sign sequence to one proposition, which is what makes the output
 * readable rather than a run-on.
 */
const CLAUSE_OPENERS = [
  "because", "although", "though", "however", "therefore", "but", "and then",
  "so that", "which means", "while", "whereas", "unless", "if you", "when you",
];

/** Above this, a segment is too long to hold in working memory as a single sign phrase. */
const MAX_SEGMENT_CHARS = 96;
/** Below this, a fragment is merged into its neighbour rather than signed alone. */
const MIN_SEGMENT_CHARS = 12;

/** True when the full stop at `index` genuinely closes a sentence. */
function isSentenceEnd(text: string, index: number): boolean {
  const char = text[index];
  if (char !== "." && char !== "!" && char !== "?") return false;

  // "3.5" or "1.2.6" - a decimal point, not a terminator.
  if (char === "." && /\d/.test(text[index - 1] ?? "") && /\d/.test(text[index + 1] ?? "")) return false;

  const before = text.slice(Math.max(0, index - 12), index).toLowerCase();
  const lastWord = before.split(/[\s(]/).pop() ?? "";
  if (ABBREVIATIONS.has(lastWord)) return false;

  // A single capital before the stop is an initial: "J. Smith".
  if (char === "." && /(^|\s)[a-z]$/i.test(before) && before.trim().length <= 1) return false;

  const after = text.slice(index + 1, index + 3);
  return after === "" || /^\s/.test(after);
}

/** Splits on sentence terminators, keeping the terminator with its sentence. */
function splitSentences(text: string): string[] {
  const sentences: string[] = [];
  let start = 0;
  for (let index = 0; index < text.length; index += 1) {
    if (!isSentenceEnd(text, index)) continue;
    let end = index + 1;
    while (end < text.length && /["')\]]/.test(text[end])) end += 1;
    const sentence = text.slice(start, end).trim();
    if (sentence) sentences.push(sentence);
    start = end;
  }
  const tail = text.slice(start).trim();
  if (tail) sentences.push(tail);
  return sentences;
}

/** Breaks an over-long sentence at the latest clause boundary before the limit. */
function splitLongSentence(sentence: string): string[] {
  if (sentence.length <= MAX_SEGMENT_CHARS) return [sentence];

  const lower = sentence.toLowerCase();
  let cut = -1;
  for (const opener of CLAUSE_OPENERS) {
    const at = lower.lastIndexOf(` ${opener} `, MAX_SEGMENT_CHARS);
    if (at > MIN_SEGMENT_CHARS && at > cut) cut = at;
  }
  if (cut < 0) {
    const comma = sentence.lastIndexOf(", ", MAX_SEGMENT_CHARS);
    if (comma > MIN_SEGMENT_CHARS) cut = comma + 1;
  }
  if (cut < 0) {
    const space = sentence.lastIndexOf(" ", MAX_SEGMENT_CHARS);
    cut = space > MIN_SEGMENT_CHARS ? space : MAX_SEGMENT_CHARS;
  }

  const head = sentence.slice(0, cut).trim();
  const tail = sentence.slice(cut).trim();
  return tail ? [head, ...splitLongSentence(tail)] : [head];
}

/** Folds fragments too short to stand alone into the previous segment. */
function mergeShortFragments(segments: string[]): string[] {
  const merged: string[] = [];
  for (const segment of segments) {
    const previous = merged[merged.length - 1];
    if (previous && segment.length < MIN_SEGMENT_CHARS && previous.length + segment.length <= MAX_SEGMENT_CHARS) {
      merged[merged.length - 1] = `${previous} ${segment}`;
      continue;
    }
    merged.push(segment);
  }
  return merged;
}

/**
 * Text in, one-proposition-per-entry out.
 *
 * The three passes are ordered deliberately: split at the strongest boundary
 * first, then the weaker one, then repair anything the splits over-fragmented.
 */
export function splitIntoSegments(text: string): string[] {
  const normalized = text.replace(/\s+/g, " ").trim();
  if (!normalized) return [];
  const sentences = splitSentences(normalized);
  const clauses = sentences.flatMap(splitLongSentence);
  return mergeShortFragments(clauses).filter(Boolean);
}

/** Sentence type, which decides the non-manual marker the whole phrase carries. */
export type SegmentIntent = "statement" | "yes-no-question" | "wh-question" | "command" | "exclamation";

const WH_WORDS = ["what", "where", "when", "why", "who", "whom", "whose", "which", "how"];
/**
 * Verbs that open an instruction in this register. Anchored to the start, so
 * "Read the passage" is a command while "Reading is scored separately" is not.
 */
const IMPERATIVE_OPENERS =
  /^(do not|don't|never|always|use|read|write|check|watch|practise|practice|listen|leave|underline|spend|extend|record|name|select|report|cross|add|link|choose|avoid|remember|keep|make sure|take|skim|scan|plan|support|compare|state|answer)\b/;

const AUXILIARIES = [
  "is", "are", "was", "were", "do", "does", "did", "can", "could", "will",
  "would", "should", "shall", "have", "has", "had", "may", "might",
];

/**
 * Classifies a segment so translation can attach the right non-manual marker.
 *
 * This matters more than it looks: in ASL, BSL and ISL the difference between a
 * statement and a yes/no question is carried on the eyebrows, not the hands. A
 * renderer that ignores intent produces grammatically wrong output even when
 * every individual sign is correct.
 */
export function classifyIntent(segment: string): SegmentIntent {
  const trimmed = segment.trim();
  const lower = trimmed.toLowerCase();
  const firstWord = lower.split(/\s+/)[0]?.replace(/[^a-z]/g, "") ?? "";

  if (trimmed.endsWith("?")) {
    return WH_WORDS.includes(firstWord) ? "wh-question" : "yes-no-question";
  }
  if (trimmed.endsWith("!")) return "exclamation";
  if (WH_WORDS.includes(firstWord)) return "wh-question";

  // Imperatives are tested before auxiliaries. "Do not use your own knowledge"
  // opens with an auxiliary but is an instruction, and signing it with the raised
  // brows of a yes/no question would tell a Deaf reader the opposite of what it
  // means.
  if (IMPERATIVE_OPENERS.test(lower)) return "command";

  if (AUXILIARIES.includes(firstWord)) return "yes-no-question";
  return "statement";
}
