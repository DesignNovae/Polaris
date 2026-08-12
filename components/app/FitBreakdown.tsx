"use client";

/**
 * Shows the student's estimated chance at one university, which parts of their
 * profile are helping or hurting, and sliders to try changes.
 *
 * All maths lives in lib/ml/probability.ts - this file only displays results.
 */

import { useState } from "react";
import type { ProbabilityInputs } from "@/lib/ml/probability";
import { FIT_TONES, type FitResult } from "@/lib/admissions";
import { Pill, Icon } from "./ui";
import { cn } from "@/lib/cn";

export type FactorId = keyof ProbabilityInputs;

/**
 * The four adjustable factors. GPA is shown out of 5 (the SSC/HSC scale) and
 * converted to the 0–4 scale the model uses; the rest map straight across.
 */
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
  { id: "testPercentile", label: "Test score",       min: 0, max: 100, step: 1, fmt: (v) => `${v.toFixed(0)}th` },
  { id: "ecCount",        label: "Extracurriculars", min: 0, max: 10,  step: 1, fmt: (v) => v.toFixed(0) },
  { id: "research",       label: "Research work",    min: 0, max: 10,  step: 1, fmt: (v) => v.toFixed(0) },
];

/** Describes a factor's effect in words rather than numbers. */
function verdict(contribution: number) {
  if (contribution > 0.15) return { label: "Helping", tone: "aurora" as const };
  if (contribution < -0.15) return { label: "Holding you back", tone: "rose" as const };
  return { label: "Average", tone: "ink" as const };
}

/** One slider. Shared by the university modal and the page-level Scenario Lab. */
export function FactorSlider({
  factor: f, inputs, onChange, labelWidth = "w-[150px]",
}: {
  factor: (typeof FACTORS)[number];
  inputs: ProbabilityInputs;
  onChange: (next: ProbabilityInputs) => void;
  labelWidth?: string;
}) {
  const shown = f.toDisplay ? f.toDisplay(inputs[f.id]) : inputs[f.id];

  return (
    <label className="flex items-center gap-3 text-[12px]">
      <span className={cn("shrink-0 font-medium text-ink truncate", labelWidth)}>{f.label}</span>
      <input
        type="range" min={f.min} max={f.max} step={f.step}
        value={shown}
        onChange={(e) => {
          const v = parseFloat(e.target.value);
          onChange({ ...inputs, [f.id]: f.fromDisplay ? f.fromDisplay(v) : v });
        }}
        className="flex-1 accent-polaris-500 min-w-0"
      />
      <span className="w-12 text-right font-mono text-[11px] text-ink tabular-nums shrink-0">
        {f.fmt(shown)}
      </span>
    </label>
  );
}

export function FitBreakdown({
  fit, inputs, onChange, onReset,
}: {
  fit: FitResult;
  inputs: ProbabilityInputs;
  onChange: (next: ProbabilityInputs) => void;
  onReset: () => void;
}) {
  const [showWhatIf, setShowWhatIf] = useState(false);

  return (
    <div className="space-y-3">
      <div className="flex items-end justify-between gap-4 rounded-xl bg-paper-soft px-4 py-3">
        <div className="flex items-baseline gap-2">
          <span className="font-serif text-[32px] leading-none font-bold text-ink tabular-nums">
            {Math.round(fit.estimate * 100)}%
          </span>
          <Pill tone={FIT_TONES[fit.band]}>{fit.band}</Pill>
        </div>
        <div className="text-[11.5px] text-ink-dim shrink-0">
          This school admits {Math.round(fit.baseline * 100)}%
        </div>
      </div>

      <ul className="space-y-1">
        {fit.factors.slice(0, 3).map((f) => (
          <li key={f.name} className="flex items-center gap-2 px-1 text-[12.5px]">
            <span className="font-medium text-ink flex-1 min-w-0 truncate">{f.name}</span>
            <Pill tone={verdict(f.contribution).tone}>{verdict(f.contribution).label}</Pill>
          </li>
        ))}
      </ul>

      <div>
        <button
          onClick={() => setShowWhatIf((v) => !v)}
          className="inline-flex items-center gap-1.5 text-[11.5px] font-semibold text-polaris-600 dark:text-polaris-300 hover:underline"
        >
          <span className={cn("transition-transform duration-150", showWhatIf && "rotate-90")}>
            <Icon.chev size={11} />
          </span>
          Try what-if
        </button>

        {showWhatIf && (
          <div className="mt-2.5 rounded-xl hairline bg-paper-card px-4 py-3.5 space-y-2">
            {FACTORS.map((f) => (
              <FactorSlider key={f.id} factor={f} inputs={inputs} onChange={onChange} />
            ))}
            <button
              onClick={onReset}
              className="text-[11.5px] font-semibold text-polaris-600 dark:text-polaris-300 hover:underline"
            >
              Reset to my profile
            </button>
          </div>
        )}
      </div>

      <p className="text-[11px] text-ink-muted leading-relaxed">
        Based on your academic profile only — no demographic data. An estimate, not an official prediction.
      </p>
    </div>
  );
}
