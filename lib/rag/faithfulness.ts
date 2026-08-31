/**
 * Generation-side evaluation.
 *
 * Retrieval eval (eval.ts) answers "did we fetch the right passage?". It says
 * nothing about the half that actually reaches the student. A pipeline can
 * retrieve perfectly and still invent a deadline, or cite a source that says
 * something else. This module measures that half:
 *
 *   1. Citation audit - deterministic. Every kb:// and me:// uri the model
 *      emits must point at a passage that was actually retrieved for that
 *      turn. No model involved, so this check cannot itself hallucinate, and
 *      it catches the single most damaging failure mode: a confident answer
 *      wearing a fabricated citation.
 *
 *   2. Groundedness judging - Gemma as judge. The answer is decomposed into
 *      factual claims and each is checked against the retrieved context.
 *      Judge output is advisory: it is one model grading another, and it is
 *      reported next to the deterministic number rather than instead of it.
 *
 * Scope: this exercises the real retrieval path and the real system prompt,
 * through a non-streaming call. It does not exercise the SSE transport or the
 * model router - those are delivery concerns, not faithfulness ones.
 */

import { generateGemmaText } from "@/lib/llm/gemma";
import { buildResearchSystemPrompt } from "@/lib/strategist/prompt";
import { modeInstructions } from "@/lib/strategist/profiles";
import { summarizeProfile, type StudentProfile } from "@/lib/profile";
import { hybridSearch } from "./search";
import { loadGoldenSet } from "./eval";
import { findUnsupportedFigures } from "./figures";
import { createLimiter, FREE_TIER_GENERATE_RPM } from "./limiter";

/* ─── 1. Deterministic citation audit ───────────────────────────────────── */

const CITE_PATTERN = /<cite>([^|<]*)\|([^<]*)<\/cite>/g;

export type CitationAudit = {
  total: number;
  /** Citations pointing at a passage that was actually retrieved. */
  valid: number;
  /** Internal uris that reference nothing we supplied - fabricated. */
  invalid: string[];
  /** http(s) citations, which the prompt forbids outside web-search results. */
  external: string[];
  /**
   * Real ids wrapped in the context's display brackets (kb://[uni:mit]).
   * Counted as valid - the passage exists - but tracked separately because a
   * malformed uri breaks anything that resolves a citation back to a source.
   */
  malformed: string[];
};

/** Strips the display brackets the model copies out of the context block. */
function normalizeId(id: string): string {
  return id.replace(/^\[+/, "").replace(/\]+$/, "").trim();
}

/**
 * Splits a citation uri into scheme and id, tolerating the two malformations
 * the model actually produces: `kb://[cost:germany]` (display brackets copied
 * from the context) and `kb:cost:germany` (the slashes dropped).
 *
 * The slash-less form matters for measurement, not just rendering: a strict
 * `startsWith("kb://")` test treats `kb:cost:germany` as some other scheme and
 * waves it through, so a run full of malformed citations scores 1.000.
 */
function parseCitationUri(uri: string): { scheme: string; id: string; wellFormed: boolean } | null {
  const withSlashes = uri.match(/^(kb|me):\/\/(.+)$/i);
  if (withSlashes) {
    const id = normalizeId(withSlashes[2]);
    return { scheme: withSlashes[1].toLowerCase(), id, wellFormed: id === withSlashes[2] };
  }
  const withoutSlashes = uri.match(/^(kb|me):(.+)$/i);
  if (withoutSlashes) {
    return {
      scheme: withoutSlashes[1].toLowerCase(),
      id: normalizeId(withoutSlashes[2]),
      wellFormed: false,
    };
  }
  return null;
}

export function auditCitations(answer: string, retrievedIds: string[]): CitationAudit {
  const allowed = new Set(retrievedIds);
  const audit: CitationAudit = {
    total: 0, valid: 0, invalid: [], external: [], malformed: [],
  };

  for (const match of answer.matchAll(CITE_PATTERN)) {
    const uri = match[2].trim();
    audit.total++;
    if (uri.startsWith("http://") || uri.startsWith("https://")) {
      audit.external.push(uri);
      continue;
    }
    // profile:// and roadmap:// are supplied outside the retrieved set, so
    // they are structurally valid; only kb and me name a retrieved passage.
    const parsed = parseCitationUri(uri);
    if (!parsed) {
      audit.valid++;
      continue;
    }
    if (allowed.has(parsed.id)) {
      audit.valid++;
      if (!parsed.wellFormed) audit.malformed.push(uri);
    } else {
      audit.invalid.push(uri);
    }
  }
  return audit;
}

/* ─── 2. Groundedness judging ───────────────────────────────────────────── */

const JUDGE_SYSTEM = [
  "You grade whether an answer is supported by the context it was given. You are strict and literal.",
  "Split the answer into standalone factual claims. Ignore hedges, questions, advice framed as opinion, and generic encouragement - grade only checkable factual assertions (numbers, dates, names, eligibility rules, requirements).",
  "A claim is supported ONLY if the context states it or directly entails it. Plausible-but-absent is unsupported. General knowledge not present in the context is unsupported.",
  "Return JSON only:",
  '  "claims": total number of factual claims found,',
  '  "supported": how many are supported by the context,',
  '  "unsupported": array of the unsupported claims, each quoted briefly (max 5 entries),',
  '  "relevance": 0-1, how directly the answer addresses the question,',
  '  "usedContext": true if the answer actually draws on the context rather than ignoring it.',
].join("\n");

const JUDGE_SCHEMA = {
  type: "object",
  properties: {
    claims: { type: "integer" },
    supported: { type: "integer" },
    unsupported: { type: "array", items: { type: "string" } },
    relevance: { type: "number" },
    usedContext: { type: "boolean" },
  },
  required: ["claims", "supported", "relevance", "usedContext"],
};

export type Judgement = {
  claims: number;
  supported: number;
  unsupported: string[];
  relevance: number;
  usedContext: boolean;
  /** supported / claims, or 1 when the answer made no factual claims. */
  groundedness: number;
  error?: string;
};

export async function judgeAnswer(input: {
  question: string;
  context: string;
  answer: string;
  signal?: AbortSignal;
}): Promise<Judgement> {
  const empty: Judgement = {
    claims: 0,
    supported: 0,
    unsupported: [],
    relevance: 0,
    usedContext: false,
    groundedness: 0,
  };
  try {
    const raw = await generateGemmaText({
      system: JUDGE_SYSTEM,
      contents: [
        `<context>\n${input.context}\n</context>`,
        `<question>${input.question}</question>`,
        `<answer>\n${input.answer}\n</answer>`,
      ].join("\n\n"),
      temperature: 0,
      maxOutputTokens: 700,
      thinkingLevel: "high",
      responseJsonSchema: JUDGE_SCHEMA,
      abortSignal: input.signal,
    });
    if (!raw) return { ...empty, error: "judge returned nothing" };
    const parsed = JSON.parse(raw) as Partial<Judgement>;
    const claims = Math.max(Number(parsed.claims ?? 0), 0);
    const supported = Math.min(Math.max(Number(parsed.supported ?? 0), 0), claims);
    return {
      claims,
      supported,
      unsupported: Array.isArray(parsed.unsupported)
        ? parsed.unsupported.filter((c): c is string => typeof c === "string").slice(0, 5)
        : [],
      relevance: Math.min(Math.max(Number(parsed.relevance ?? 0), 0), 1),
      usedContext: parsed.usedContext === true,
      groundedness: claims === 0 ? 1 : supported / claims,
    };
  } catch (err) {
    return { ...empty, error: (err as Error).message };
  }
}

/* ─── 3. End-to-end runner ──────────────────────────────────────────────── */

/**
 * A neutral profile. Faithfulness is a property of the retrieval + prompt
 * contract, not of one student, so every case runs against the same profile
 * to keep results comparable between runs.
 */
const EVAL_PROFILE: StudentProfile = {
  grade: "late-hs",
  country: "Bangladesh",
  degree: "undergrad",
  gpa: 3.7,
  ecs: ["Olympiads", "Research"],
  targetTier: "elite",
};

export type FaithfulnessRow = {
  id: string;
  question: string;
  retrieved: string[];
  answerChars: number;
  citations: CitationAudit;
  /** Figures in the answer that appear in none of its sources - deterministic. */
  unsupportedFigures: string[];
  judge: Judgement;
  ms: number;
  error?: string;
};

export type FaithfulnessResult = {
  sampled: number;
  /** Answers containing at least one figure absent from their sources. */
  answersWithUnsupportedFigures: number;
  unsupportedFigures: string[];
  /** Valid ids emitted with broken syntax - see CitationAudit.malformed. */
  malformedCitations: string[];
  /** Share of emitted kb:// and me:// citations that resolve to a retrieved passage. */
  citationPrecision: number;
  citationsEmitted: number;
  fabricatedCitations: string[];
  /** Mean of per-answer supported/claims. */
  groundedness: number;
  relevance: number;
  answersUsingContext: number;
  rows: FaithfulnessRow[];
  ms: number;
};

export async function runFaithfulnessEval(options: {
  sample?: number;
  topK?: number;
  signal?: AbortSignal;
} = {}): Promise<FaithfulnessResult> {
  const startedAt = Date.now();
  const sample = Math.max(1, options.sample ?? 8);
  const topK = options.topK ?? 5;

  // Deterministic spread across query kinds rather than a random draw, so two
  // runs of the same size are comparable.
  const all = loadGoldenSet();
  const stride = Math.max(1, Math.floor(all.length / sample));
  const cases = all.filter((_, i) => i % stride === 0).slice(0, sample);

  // Two model calls per case (generate + judge). Pacing them keeps a run from
  // degrading into "half the answers failed", which reads as a good score.
  const limiter = createLimiter({ requestsPerMinute: FREE_TIER_GENERATE_RPM });

  const rows: FaithfulnessRow[] = [];
  for (const testCase of cases) {
    const caseStart = Date.now();
    try {
      const hits = await hybridSearch(testCase.q, topK, { signal: options.signal });
      const context = hits.length
        ? hits.map((h) => `id=${h.id} | ${h.title}: ${h.text}`).join("\n\n")
        : "(no internal KB matches)";

      const system =
        buildResearchSystemPrompt(EVAL_PROFILE, [], [], "en") + modeInstructions("general");
      const userPrompt = [
        `<kb>\n${context}\n</kb>`,
        "",
        `<memory>(none)</memory>`,
        "",
        `<question>${testCase.q}</question>`,
      ].join("\n");
      const answer = await limiter.run(() =>
        generateGemmaText({
          system,
          contents: userPrompt,
          temperature: 0.55,
          maxOutputTokens: 900,
          thinkingLevel: "minimal",
          abortSignal: options.signal,
        }),
      );

      if (!answer) {
        rows.push({
          id: testCase.id,
          question: testCase.q,
          retrieved: hits.map((h) => h.id),
          answerChars: 0,
          citations: { total: 0, valid: 0, invalid: [], external: [], malformed: [] },
          unsupportedFigures: [],
          judge: {
            claims: 0, supported: 0, unsupported: [], relevance: 0,
            usedContext: false, groundedness: 0,
          },
          ms: Date.now() - caseStart,
          error: "no answer generated",
        });
        continue;
      }

      const citations = auditCitations(answer, hits.map((h) => h.id));
      // Deterministic numeric check against everything the model was given -
      // no judge involved, so this number is not itself an opinion.
      const unsupportedFigures = findUnsupportedFigures(
        answer,
        `${system}\n${userPrompt}`,
      ).map((figure) => figure.text);

      // The judge must see everything the model was legitimately grounded in.
      // Scoring against the KB block alone marks correct personalization
      // ("your GPA is 3.7") as invention, which understates groundedness.
      const judge = await limiter.run(() =>
        judgeAnswer({
          question: testCase.q,
          context: [
            `STUDENT PROFILE (the model was given this):`,
            summarizeProfile(EVAL_PROFILE),
            ``,
            `RETRIEVED PASSAGES:`,
            context,
          ].join("\n"),
          answer,
          signal: options.signal,
        }),
      );

      rows.push({
        id: testCase.id,
        question: testCase.q,
        retrieved: hits.map((h) => h.id),
        answerChars: answer.length,
        citations,
        unsupportedFigures,
        judge,
        ms: Date.now() - caseStart,
      });
    } catch (err) {
      rows.push({
        id: testCase.id,
        question: testCase.q,
        retrieved: [],
        answerChars: 0,
        citations: { total: 0, valid: 0, invalid: [], external: [], malformed: [] },
        unsupportedFigures: [],
        judge: {
          claims: 0, supported: 0, unsupported: [], relevance: 0,
          usedContext: false, groundedness: 0,
        },
        ms: Date.now() - caseStart,
        error: (err as Error).message,
      });
    }
  }

  const scored = rows.filter((row) => !row.error);
  const citationsEmitted = rows.reduce((sum, row) => sum + row.citations.total, 0);
  const citationsValid = rows.reduce((sum, row) => sum + row.citations.valid, 0);
  const mean = (pick: (row: FaithfulnessRow) => number) =>
    scored.length ? scored.reduce((sum, row) => sum + pick(row), 0) / scored.length : 0;

  return {
    sampled: rows.length,
    answersWithUnsupportedFigures: rows.filter((row) => row.unsupportedFigures.length > 0).length,
    unsupportedFigures: rows.flatMap((row) => row.unsupportedFigures),
    malformedCitations: rows.flatMap((row) => row.citations.malformed),
    citationPrecision: citationsEmitted ? round(citationsValid / citationsEmitted) : 1,
    citationsEmitted,
    fabricatedCitations: rows.flatMap((row) => row.citations.invalid),
    groundedness: round(mean((row) => row.judge.groundedness)),
    relevance: round(mean((row) => row.judge.relevance)),
    answersUsingContext: scored.filter((row) => row.judge.usedContext).length,
    rows,
    ms: Date.now() - startedAt,
  };
}

function round(value: number): number {
  return Math.round(value * 1000) / 1000;
}

export function formatFaithfulness(result: FaithfulnessResult): string {
  const lines: string[] = [];
  lines.push(`Faithfulness eval - ${result.sampled} answers generated and graded`);
  lines.push("");
  lines.push(`  citation precision   ${result.citationPrecision.toFixed(3)}  (${result.citationsEmitted} citations emitted, deterministic check)`);
  lines.push(`  groundedness         ${result.groundedness.toFixed(3)}  (claims supported by retrieved context, judged)`);
  lines.push(`  answer relevance     ${result.relevance.toFixed(3)}  (judged)`);
  lines.push(
    `  unsupported figures  ${result.unsupportedFigures.length}  in ${result.answersWithUnsupportedFigures}/${result.sampled} answers (deterministic check)`,
  );
  lines.push(`  used the context     ${result.answersUsingContext}/${result.sampled}`);
  if (result.malformedCitations.length) {
    lines.push(`  malformed uris      ${result.malformedCitations.length} (real ids wrapped in display brackets)`);
  }
  if (result.unsupportedFigures.length) {
    lines.push("");
    lines.push(`  FIGURES NOT IN ANY SOURCE: ${result.unsupportedFigures.join(", ")}`);
  }
  if (result.fabricatedCitations.length) {
    lines.push("");
    lines.push(`  FABRICATED CITATIONS: ${result.fabricatedCitations.join(", ")}`);
  }
  const shaky = result.rows
    .filter((row) => !row.error && row.judge.groundedness < 1)
    .slice(0, 5);
  if (shaky.length) {
    lines.push("");
    lines.push("Unsupported claims:");
    for (const row of shaky) {
      lines.push(`  ${row.id} (${row.judge.supported}/${row.judge.claims}) "${row.question}"`);
      for (const claim of row.judge.unsupported) lines.push(`      - ${claim}`);
    }
  }
  const failed = result.rows.filter((row) => row.error);
  if (failed.length) {
    lines.push("");
    lines.push(`Failed: ${failed.map((row) => `${row.id} (${row.error})`).join(", ")}`);
  }
  lines.push("");
  lines.push(`Completed in ${result.ms}ms.`);
  return lines.join("\n");
}
