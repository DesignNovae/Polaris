"use client";

/**
 * Fit breakdown - the transparent half of the Acceptance-Probability Engine.
 *
 * The model (lib/ml/probability.ts) is a scorecard: the university sets a
 * starting difficulty, each part of the profile earns points, the total is
 * converted into a percentage. "Logistic regression" is the textbook name for
 * exactly that.
 *
 * This component prints the model's top three factors and their point values.
 * It does no maths of its own - that is what makes the score explainable
 * rather than a black box. The what-if sliders are collapsed by default so
 * opening a university stays a quick read.
 */

import { useState } from "react";
import type { ProbabilityInputs } from "@/lib/ml/probability";
import { FIT_TONES, type FitResult } from "@/lib/admissions";
import { Pill, Icon } from "./ui";
import { cn } from "@/lib/cn";

export type FactorId = keyof ProbabilityInputs;

/**
 * Approximate SAT score → percentile lookup, from College Board's published
 * concordance. Students know their SAT score; nobody knows their percentile,
 * so the slider asks for the score and converts. Values between table rows are
 * interpolated in a straight line.
 */
const SAT_TABLE: [sat: number, percentile: number][] = [
  [400, 0], [600, 1], [700, 4], [800, 11], [900, 25], [1000, 41], [1050, 50],
  [1100, 58], [1200, 74], [1300, 87], [1400, 94], [1500, 98], [1550, 99], [1600, 100],
];

/** Reads the table in either direction: from = column to look up, to = column to return. */
function lookup(x: number, from: 0 | 1, to: 0 | 1): number {
  const first = SAT_TABLE[0], last = SAT_TABLE[SAT_TABLE.length - 1];
  if (x <= first[from]) return first[to];
  if (x >= last[from]) return last[to];
  for (let i = 1; i < SAT_TABLE.length; i++) {
    const a = SAT_TABLE[i - 1], b = SAT_TABLE[i];
    if (x <= b[from]) {
      const t = (x - a[from]) / (b[from] - a[from]);
      return a[to] + t * (b[to] - a[to]);
    }
  }
  return last[to];
}

const satToPercentile = (sat: number) => lookup(sat, 0, 1);
const percentileToSat = (pct: number) => lookup(pct, 1, 0);

/** The four things a student can simulate. Academic signals only - there are
 *  deliberately no demographic inputs in this model.
 *
 *  GPA is shown on the 0–5 scale Bangladeshi SSC/HSC results actually use.
 *  The engine works internally on a 0–4 scale (so O/A-Levels and overseas
 *  CGPAs can be compared against the same yardstick), so `toDisplay` and
 *  `fromDisplay` convert between the two. Every other factor is 1:1. */
export const FACTORS: {
  id: FactorId; label: string; min: number; max: number; step: number;
  fmt: (v: number) => string;
  toDisplay?: (engineValue: number) => number;
  fromDisplay?: (shownValue: number) => number;
}[] = [
  {
    id: "gpa", label: "GPA (out of 5)", min: 0, max: 5, step: 0.01,
    fmt: (v) => v.toFixed(2),
    toDisplay: (engine) => (engine / 4) * 5,
    fromDisplay: (shown) => (shown / 5) * 4,
  },
  {
    id: "testPercentile", label: "SAT score", min: 400, max: 1600, step: 10,
    fmt: (sat) => `${sat.toFixed(0)} · ${satToPercentile(sat).toFixed(0)}th`,
    toDisplay: (percentile) => Math.round(percentileToSat(percentile) / 10) * 10,
    fromDisplay: (sat) => satToPercentile(sat),
  },
  { id: "ecCount",        label: "Strong extracurriculars", min: 0, max: 10,  step: 1, fmt: (v) => v.toFixed(0) },
  { id: "research",       label: "Research / shipped work", min: 0, max: 10,  step: 1, fmt: (v) => v.toFixed(0) },
];

export function FitBreakdown({
  fit, inputs, onChange, onReset,
}: {
  fit: FitResult;
  inputs: ProbabilityInputs;
  onChange: (next: ProbabilityInputs) => void;
  onReset: () => void;
}) {
  const [showWhatIf, setShowWhatIf] = useState(false);

  // fit.factors arrives sorted by contribution, strongest first.
  const top = fit.factors.slice(0, 3);

  return (
    <div className="space-y-3">
      {/* ─── The score ─── */}
      <div className="flex items-end justify-between gap-4 rounded-xl bg-paper-soft px-4 py-3">
        <div className="flex items-baseline gap-2">
          <span className="font-serif text-[32px] leading-none font-bold text-ink tabular-nums">
            {(fit.estimate * 100).toFixed(1)}%
          </span>
          <Pill tone={FIT_TONES[fit.band]}>{fit.band}</Pill>
        </div>
        <div className="text-[11.5px] text-ink-dim shrink-0">
          This school admits <span className="font-mono text-ink tabular-nums">{(fit.baseline * 100).toFixed(1)}%</span>
        </div>
      </div>

      {/* ─── Top contributing factors ─── */}
      <ul className="space-y-1">
        {top.map((f) => {
          const positive = f.contribution >= 0;
          return (
            <li key={f.name} className="flex items-center gap-2 px-1 text-[12.5px]">
              <span className="font-medium text-ink flex-1 min-w-0 truncate">{f.name}</span>
              <span className="font-mono text-[10.5px] text-ink-muted shrink-0">worth up to {f.weight.toFixed(1)}</span>
              <span className={cn(
                "font-mono text-[12px] font-semibold tabular-nums w-14 text-right shrink-0",
                positive ? "text-aurora-700 dark:text-aurora-100" : "text-signal-rose",
              )}>
                {positive ? "+" : "−"}{Math.abs(f.contribution).toFixed(2)}
              </span>
            </li>
          );
        })}
      </ul>

      {/* ─── What-if sliders (collapsed by default) ─── */}
      <div>
        <button
          onClick={() => setShowWhatIf((v) => !v)}
          className="inline-flex items-center gap-1.5 text-[11.5px] font-semibold text-polaris-600 dark:text-polaris-300 hover:underline"
        >
          <span className={cn("transition-transform duration-150", showWhatIf && "rotate-90")}><Icon.chev size={11} /></span>
          Try what-if
        </button>

        {showWhatIf && (
          <div className="mt-2.5 rounded-xl hairline bg-paper-card px-4 py-3.5 space-y-2">
            {FACTORS.map((f) => {
              const shown = f.toDisplay ? f.toDisplay(inputs[f.id]) : inputs[f.id];
              return (
                <label key={f.id} className="flex items-center gap-3 text-[12px]">
                  <span className="w-[150px] shrink-0 font-medium text-ink truncate">{f.label}</span>
                  <input
                    type="range" min={f.min} max={f.max} step={f.step}
                    value={shown}
                    onChange={(e) => {
                      const v = parseFloat(e.target.value);
                      onChange({ ...inputs, [f.id]: f.fromDisplay ? f.fromDisplay(v) : v });
                    }}
                    className="flex-1 accent-polaris-500 min-w-0"
                  />
                  <span className="w-[84px] text-right font-mono text-[11px] text-ink tabular-nums shrink-0">
                    {f.fmt(shown)}
                  </span>
                </label>
              );
            })}
            <p className="text-[10.5px] text-ink-muted leading-relaxed pt-0.5">
              GPA is on the SSC/HSC 5.0 scale; other curricula are converted onto the same yardstick
              so everyone is compared fairly. SAT scores are converted to a percentile — the rank
              the model actually uses — so 1400 means &ldquo;better than 94% of test takers&rdquo;.
            </p>
            <button onClick={onReset} className="text-[11.5px] font-semibold text-polaris-600 dark:text-polaris-300 hover:underline">
              Reset to my profile
            </button>
          </div>
        )}
      </div>

      <p className="text-[11px] text-ink-muted leading-relaxed">
        Academic factors only — <span className="font-semibold text-ink-dim">no demographic proxies</span>. An estimate, not an official prediction.
      </p>
    </div>
  );
}
