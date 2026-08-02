/**
 * Deterministic safety checks for model-written prose.
 *
 * Structured JSON can be syntactically valid while still containing a
 * degeneration loop (the same sentence or option repeated many times). This
 * module removes obvious loops without rewriting the student's content.
 */

function comparisonKey(value: string): string {
  return value
    .toLocaleLowerCase()
    .replace(/[\s\u00a0]+/g, " ")
    .replace(/[\p{P}\p{S}]+/gu, "")
    .trim();
}

function cleanParagraph(paragraph: string): string {
  const sentences = paragraph
    .split(/(?<=[.!?।])\s+/u)
    .map((item) => item.trim())
    .filter(Boolean);
  if (sentences.length < 2) return paragraph.trim();

  const seen = new Map<string, number>();
  const kept: string[] = [];
  for (const sentence of sentences) {
    const key = comparisonKey(sentence);
    if (!key) continue;
    const count = seen.get(key) ?? 0;
    // A repeated sentence may be rhetorical once. A third copy is always a
    // generation loop, and consecutive duplicates are never useful here.
    const previous = kept.length ? comparisonKey(kept[kept.length - 1]) : "";
    if (previous === key || count >= 2) continue;
    seen.set(key, count + 1);
    kept.push(sentence);
  }
  return kept.join(" ");
}

export function stabilizeGeneratedText(value: string): string {
  if (!value) return value;
  const normalized = value.replace(/\r\n?/g, "\n").replace(/[ \t]+\n/g, "\n");
  const paragraphs = normalized.split(/\n{2,}/);
  const seenBlocks = new Set<string>();
  const kept = paragraphs.flatMap((paragraph) => {
    const cleaned = cleanParagraph(paragraph);
    const key = comparisonKey(cleaned);
    if (!key || seenBlocks.has(key)) return [];
    seenBlocks.add(key);
    return [cleaned];
  });
  return kept.join("\n\n").trim();
}

export function hasDegenerateRepetition(value: string): boolean {
  if (!value) return true;
  const sentences = value
    .split(/(?<=[.!?।])\s+/u)
    .map(comparisonKey)
    .filter((item) => item.length >= 12);
  const counts = new Map<string, number>();
  for (const sentence of sentences) {
    const next = (counts.get(sentence) ?? 0) + 1;
    counts.set(sentence, next);
    if (next >= 3) return true;
  }
  return false;
}

export function hasUniqueChoices(options: string[]): boolean {
  if (options.length !== 4) return false;
  const keys = options.map(comparisonKey);
  return keys.every(Boolean) && new Set(keys).size === keys.length;
}
