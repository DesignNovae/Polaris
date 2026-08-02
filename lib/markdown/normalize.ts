/**
 * Makes common model-produced math delimiters compatible with remark-math.
 *
 * The transformation deliberately skips fenced and inline code so examples
 * remain byte-for-byte readable. Invalid formulas are left intact; KaTeX is
 * configured by the renderer to show the source instead of throwing.
 */
export function normalizeAIResponseMarkdown(input: string): string {
  const source = input
    .replace(/\r\n?/g, "\n")
    .replace(/\u0000/g, "")
    .trim();

  if (!source) return "";

  const lines = source.split("\n");
  let inFence = false;

  return lines
    .map((line) => {
      if (/^\s*(```|~~~)/.test(line)) {
        inFence = !inFence;
        return line;
      }
      if (inFence) return line;

      return line
        .split(/(`+[^`]*`+)/g)
        .map((part, index) => (index % 2 === 1 ? part : normalizeMath(part)))
        .join("");
    })
    .join("\n");
}

function normalizeMath(text: string): string {
  return text
    .replace(/\\\\([\[\]()])/g, "\\$1")
    .replace(/\\begin\{(?:equation\*?|displaymath)\}/g, () => "$$")
    .replace(/\\end\{(?:equation\*?|displaymath)\}/g, () => "$$")
    .replace(/\\\[/g, () => "$$")
    .replace(/\\\]/g, () => "$$")
    .replace(/\\\(/g, "$")
    .replace(/\\\)/g, "$");
}
