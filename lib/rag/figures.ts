/**
 * Deterministic detection of unsupported figures.
 *
 * Prompt hardening reduced invented numbers; it did not eliminate them. The
 * faithfulness run still produced "a monthly withdrawal limit of ~€992" and
 * "SAT 1550+" from a context containing neither. Those are the claims that
 * actually cost a student money or a place, and a student cannot tell an
 * invented figure from a real one - both arrive in the same confident prose.
 *
 * So numbers get a check that does not involve a model. Every currency
 * amount, percentage and test score in an answer must correspond to a number
 * present in what the model was given. No judgement, no second opinion, no
 * chance of the checker hallucinating agreement.
 *
 * Deliberately narrow. It flags money, percentages and scores - the harmful
 * categories - and ignores counts, list positions and ordinary prose numbers,
 * because a guard that cries wolf gets switched off.
 */

export type FigureKind = "currency" | "percentage" | "score";

export type Figure = {
  /** The figure as written in the answer, for display. */
  text: string;
  kind: FigureKind;
  /** Numeric value after unit expansion, used for comparison. */
  value: number;
};

/* ─── Extraction ────────────────────────────────────────────────────────── */

const CURRENCY_SYMBOLS = "\\$£€₹৳";
const CURRENCY_CODES = "USD|GBP|EUR|BDT|CAD|SGD|AUD|NZD|SEK|PLN|CHF|JPY|INR|TK";

/**
 * $62k, £10,224, €11,904, ₹1.5 lakh, CAD 20,635, 45000 USD
 *
 * The multiplier must be a whole word. Without the trailing boundary,
 * "€11,904 must be deposited" captured "€11,904 m" and multiplied a correct
 * figure by a million - flagging a true statement as invented. A guard that
 * cries wolf is a guard people switch off.
 */
const MULTIPLIER_WORDS = "k|m|lakh|crore|thousand|million";
const CURRENCY_PATTERN = new RegExp(
  `(?:[${CURRENCY_SYMBOLS}]|\\b(?:${CURRENCY_CODES})\\s*)\\s?\\d[\\d,.]*(?:\\s*(?:${MULTIPLIER_WORDS})\\b)?` +
    `|\\b\\d[\\d,.]*(?:\\s*(?:${MULTIPLIER_WORDS})\\b)?\\s*(?:${CURRENCY_CODES})\\b`,
  "gi",
);

const PERCENT_PATTERN = /\b\d[\d,.]*\s?%/g;

/**
 * Scores only where an exam is named nearby, so "3 universities" and "top 50"
 * are never mistaken for a cutoff.
 */
const SCORE_PATTERN =
  /\b(SAT|ACT|IELTS|TOEFL|GRE|GMAT|GPA|CGPA|A\*|band|percentile)\b[^.\n]{0,40}?\b(\d[\d,.]*)\b/gi;

/**
 * Multipliers that appear beside an amount.
 *
 * Anchored to the digits rather than a word boundary: "$62k" has no boundary
 * between "2" and "k", so a \b-anchored pattern silently read it as 62 - the
 * difference between a year's tuition and a bus fare.
 */
const MULTIPLIERS: Array<[RegExp, number]> = [
  [/\d\s*crore\b/i, 10_000_000],
  [/\d\s*lakh\b/i, 100_000],
  [/\d\s*(?:m|million)\b/i, 1_000_000],
  [/\d\s*(?:k|thousand)\b/i, 1_000],
];

function toNumber(raw: string): number | null {
  const digits = raw.match(/\d[\d,.]*/);
  if (!digits) return null;
  // Strip thousands separators, keep a single decimal point.
  const cleaned = digits[0].replace(/,/g, "");
  const parts = cleaned.split(".");
  const normalized =
    parts.length > 2 ? `${parts[0]}.${parts.slice(1).join("")}` : cleaned;
  const base = Number(normalized);
  if (!Number.isFinite(base)) return null;

  for (const [pattern, factor] of MULTIPLIERS) {
    if (pattern.test(raw)) return base * factor;
  }
  return base;
}

/** Citation URIs and markdown links carry ids and digits that are not claims. */
function stripNonProse(text: string): string {
  return text
    .replace(/<cite>[^<]*<\/cite>/g, " ")
    .replace(/\((?:https?:)?\/\/[^)]*\)/g, " ")
    .replace(/https?:\/\/\S+/g, " ")
    .replace(/`[^`]*`/g, " ");
}

export function extractFigures(text: string): Figure[] {
  const prose = stripNonProse(text);
  const found: Figure[] = [];
  const seen = new Set<string>();

  const push = (raw: string, kind: FigureKind) => {
    const value = toNumber(raw);
    if (value === null) return;
    const key = `${kind}:${value}`;
    if (seen.has(key)) return;
    seen.add(key);
    found.push({ text: raw.trim(), kind, value });
  };

  for (const match of prose.matchAll(CURRENCY_PATTERN)) push(match[0], "currency");
  for (const match of prose.matchAll(PERCENT_PATTERN)) push(match[0], "percentage");
  for (const match of prose.matchAll(SCORE_PATTERN)) push(match[0], "score");

  return found;
}

/* ─── Verification ──────────────────────────────────────────────────────── */

/**
 * Every number in the supplied context, with unit variants expanded, so
 * "$62k" in the source supports "$62,000" in the answer.
 */
function contextValues(context: string): Set<number> {
  const values = new Set<number>();
  for (const match of context.matchAll(/\d[\d,.]*\s*(?:k|m|lakh|crore|thousand|million)?/gi)) {
    const value = toNumber(match[0]);
    if (value !== null) {
      values.add(value);
      // A source writing "62" for "$62k" is the same claim at another scale.
      if (value < 1000) values.add(value * 1000);
    }
  }
  return values;
}

/**
 * Percentages and scores are quoted exactly; money is allowed a little slack,
 * because restating "£10,224" as "about £10,000" is a rounding, not an
 * invention, and flagging it would train people to ignore the warning.
 */
const CURRENCY_TOLERANCE = 0.02;

function isSupported(figure: Figure, values: Set<number>): boolean {
  if (values.has(figure.value)) return true;
  if (figure.kind !== "currency") return false;
  for (const value of values) {
    if (value === 0) continue;
    if (Math.abs(value - figure.value) / value <= CURRENCY_TOLERANCE) return true;
  }
  return false;
}

/**
 * Returns the figures in `answer` that do not appear in `context`.
 *
 * `context` must include everything the model was legitimately given - the
 * retrieved passages, the student's profile, and any web snippets - or
 * correct answers get flagged.
 */
export function findUnsupportedFigures(answer: string, context: string): Figure[] {
  if (!answer.trim()) return [];
  const values = contextValues(context);
  return extractFigures(answer).filter((figure) => !isSupported(figure, values));
}

/** One-line caveat shown under an answer that contains unverified figures. */
export function figureWarning(figures: Figure[]): string {
  if (figures.length === 0) return "";
  const list = figures.map((f) => f.text).join(", ");
  return figures.length === 1
    ? `One figure above (${list}) is not in Polaris's sources - verify it on the official page before relying on it.`
    : `Some figures above (${list}) are not in Polaris's sources - verify them on the official pages before relying on them.`;
}
