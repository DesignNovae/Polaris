/**
 * Strategist mode profiles.
 *
 * Each "mode" layers a tone + behavior on top of the personalized base
 * prompt (profile + memory + KB). The orchestrator picks one by user
 * preference or by router decision (e.g. "research" mode prefers a model
 * with web search + reasoning).
 *
 * Modes:
 *   • general   - friendly co-pilot, balanced
 *   • research  - deep multi-source synthesis, prefers web search
 *   • study     - explainer mode, step-by-step, pedagogically clear
 *   • coding    - code-first, syntax + runnable snippets
 */

import type { TaskKind } from "@/lib/llm/providers/types";

export type StrategistMode = TaskKind;

export const MODE_LABELS: Record<StrategistMode, string> = {
  general: "General",
  research: "Research",
  study: "Study",
  coding: "Coding",
};

export const MODE_DESCRIPTIONS: Record<StrategistMode, string> = {
  general:  "Balanced co-pilot. Friendly tone, normal depth.",
  research: "Deep dive - searches the web, cross-checks sources, cites everything.",
  study:    "Explainer mode - walks through concepts step-by-step at your level.",
  coding:   "Code-first - runnable snippets, exact syntax, no waffle.",
};

/**
 * Mode-specific instructions appended to the base system prompt. Kept
 * additive so the base personalization layer (profile + memory) is the
 * source of truth for *what* the model knows, while the mode layer
 * controls *how* it responds.
 */
export function modeInstructions(mode: StrategistMode): string {
  switch (mode) {
    case "research":
      return [
        ``,
        `=== MODE: RESEARCH ===`,
        `You are in deep-research mode. Treat every question as if the user wants the most authoritative answer possible.`,
        `  • Always check the web for current data - deadlines, requirements, fees, recent admissions stats.`,
        `  • Run 2–4 targeted sub-queries, not one vague search.`,
        `  • Cross-check at least two reputable sources before stating a specific number, date, or quote.`,
        `  • Prefer .edu, official government, official scholarship boards over aggregators or blogs.`,
        `  • If sources disagree, say so explicitly and explain which you trust and why.`,
        `  • Structure: 2–3 short paragraphs, then "Sources:" line if useful (citations are auto-attached).`,
      ].join("\n");

    case "study":
      return [
        ``,
        `=== MODE: STUDY ===`,
        `You are in study mode. The student is here to learn something, not just get an answer.`,
        `  • Start with a one-sentence intuition.`,
        `  • Then go step-by-step, defining any jargon the first time you use it.`,
        `  • Use simple analogies tied to the student's interests if you know them.`,
        `  • End with a quick "Check yourself" question they can answer to confirm they got it.`,
        `  • Keep paragraphs short. No headings.`,
      ].join("\n");

    case "coding":
      return [
        ``,
        `=== MODE: CODING ===`,
        `You are in coding mode. The user wants working code, not prose.`,
        `  • Lead with a single fenced code block. Make it runnable.`,
        `  • Comment any line that's not obvious; skip comments for trivial lines.`,
        `  • After the block, give a 2–3 sentence "Why this works" + one edge case to watch for.`,
        `  • If you need to ask a clarifying question, ask it FIRST in one short line, then provide a best-guess implementation anyway.`,
        `  • Cite docs from the web when you used a non-obvious API.`,
      ].join("\n");

    case "general":
    default:
      return [
        ``,
        `=== MODE: GENERAL ===`,
        `Balanced co-pilot tone. Short paragraphs. Use the web when the question is time-sensitive or factual; skip it when it's about the student's own plan/strategy.`,
      ].join("\n");
  }
}

/** Modes that benefit from web search (router uses this to pick a model). */
export function modeWantsWebSearch(mode: StrategistMode): boolean {
  return mode === "research" || mode === "general";
}

