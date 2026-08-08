"use client";

/**
 * Fit breakdown - the transparent half of the Acceptance-Probability Engine.
 *
 * The model itself lives in lib/ml/probability.ts. It is a logistic regression:
 *
 *     z = intercept + Σ (weightᵢ × normalisedᵢ)
 *     P = 1 / (1 + e^−z)          ← sigmoid, squashes z into 0…1
 *
 * `scoreProbability()` already returns every factor's weight and its signed
 * contribution to z, so this component does NO maths of its own - it just
 * renders what the engine reports. That is the whole point: the score is not a
 * black box, you can read off exactly which factor pushed it up or down.
 *
 * The sliders below write straight back into the engine's inputs, so dragging
 * one re-runs the model and every number here updates in real time.
 */

import type { ProbabilityInputs } from "@/lib/ml/probability";
import { FIT_TONES, type FitResult } from "@/lib/admissions";
import { Pill } from "./ui";
import { cn } from "@/lib/cn";

export type FactorId = keyof ProbabilityInputs;

/** The four things a student can simulate. Academic signals only - there are
 *  deliberately no demographic inputs in this model. */
export const FACTORS: {
  id: FactorId; label: string; min: number; max: number; step: number; fmt: (v: number) => string;
}[] = [
  { id: "gpa",            label: "GPA / academic ceiling", min: 0, max: 4,   step: 0.01, fmt: (v) => v.toFixed(2) },
  { id: "testPercentile", label: "Standardized testing",   min: 0, max: 100, step: 1,    fmt: (v) => `${v.toFixed(0)}%ile` },
  { id: "ecCount",        label: "Strong extracurriculars", min: 0, max: 10, step: 1,    fmt: (v) => v.toFixed(0) },
  { id: "research",       label: "Research / shipped work", min: 0, max: 10, step: 1,    fmt: (v) => v.toFixed(0) },
];

export function FitBreakdown({
  fit, inputs, onChange, onReset,
}: {
  fit: FitResult;
  inputs: ProbabilityInputs;
  onChange: (next: ProbabilityInputs) => void;
  onReset: () => void;
}) {
  // A factor's contribution can never exceed its own weight (the normalised
  // feature is clamped to −1…1), so the largest weight is a safe, stable bar
  // scale - bars don't jump around as you drag.
  const scale = Math.max(...fit.factors.map((f) => f.weight), 1);

  return (
    <div className="space-y-4">
      {/* ─── Headline number ─── */}
      <div className="flex items-end justify-between gap-4 rounded-xl bg-paper-soft px-4 py-3">
        <div>
          <div className="text-[10.5px] uppercase tracking-[0.18em] text-ink-muted font-medium">
            Estimated acceptance probability
          </div>
          <div className="flex items-baseline gap-2 mt-1">
            <span className="font-serif text-[34px] leading-none font-bold text-ink tabular-nums">
              {(fit.estimate * 100).toFixed(1)}%
            </span>
            <Pill tone={FIT_TONES[fit.band]}>{fit.band}</Pill>
          </div>
        </div>
        <div className="text-right shrink-0">
          <div className="text-[10.5px] uppercase tracking-[0.18em] text-ink-muted font-medium">Admit rate</div>
          <div className="font-mono text-[13px] text-ink-dim tabular-nums mt-1">
            {(fit.baseline * 100).toFixed(1)}%
          </div>
        </div>
      </div>

      {/* ─── Factor contributions ─── */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <span className="text-[11px] uppercase tracking-[0.18em] text-ink-muted font-medium">
            Top contributing factors
          </span>
          <span className="font-mono text-[10.5px] text-ink-muted">P = sigmoid(Σ weight × factor)</span>
        </div>

        <ul className="space-y-2">
          {fit.factors.map((f) => {
            const positive = f.contribution >= 0;
            const width = Math.min(50, (Math.abs(f.contribution) / scale) * 50);
            return (
              <li key={f.name} className="rounded-xl bg-paper-soft px-3.5 py-2.5">
                <div className="flex items-center gap-2 text-[12.5px]">
                  <span className="font-medium text-ink flex-1 min-w-0 truncate">{f.name}</span>
                  <span className="font-mono text-[10.5px] text-ink-muted shrink-0">weight ×{f.weight.toFixed(1)}</span>
                  <span className={cn(
                    "font-mono text-[11.5px] font-semibold tabular-nums w-14 text-right shrink-0",
                    positive ? "text-aurora-700 dark:text-aurora-100" : "text-signal-rose",
                  )}>
                    {positive ? "+" : "−"}{Math.abs(f.contribution).toFixed(2)}
                  </span>
                </div>

                {/* Diverging bar - centre line is "neutral", right is helping,
                    left is hurting. */}
                <div className="relative h-1.5 mt-2 rounded-full bg-paper-deep overflow-hidden">
                  <span className="absolute left-1/2 top-0 bottom-0 w-px bg-ink-faint/50" />
                  <span
                    className={cn("absolute top-0 bottom-0", positive ? "bg-aurora-500 rounded-r-full" : "bg-signal-rose rounded-l-full")}
                    style={positive ? { left: "50%", width: `${width}%` } : { right: "50%", width: `${width}%` }}
                  />
                </div>

                <p className="text-[11px] text-ink-muted leading-relaxed mt-1.5">{f.hint}</p>
              </li>
            );
          })}
        </ul>
      </div>

      {/* ─── What-if sliders ─── */}
      <div className="rounded-xl hairline bg-paper-card px-4 py-3.5">
        <div className="flex items-center justify-between mb-2.5">
          <div>
            <div className="text-[11px] uppercase tracking-[0.18em] text-ink-muted font-medium">What-if simulation</div>
            <div className="text-[11.5px] text-ink-dim mt-0.5">Drag a factor — the score above updates live.</div>
          </div>
          <button onClick={onReset} className="text-[11.5px] font-semibold text-polaris-600 dark:text-polaris-300 hover:underline shrink-0">
            Reset to my profile
          </button>
        </div>

        <div className="space-y-2">
          {FACTORS.map((f) => (
            <label key={f.id} className="flex items-center gap-3 text-[12px]">
              <span className="w-[150px] shrink-0 font-medium text-ink truncate">{f.label}</span>
              <input
                type="range" min={f.min} max={f.max} step={f.step}
                value={inputs[f.id]}
                onChange={(e) => onChange({ ...inputs, [f.id]: parseFloat(e.target.value) })}
                className="flex-1 accent-polaris-500 min-w-0"
              />
              <span className="w-14 text-right font-mono text-[11px] text-ink tabular-nums shrink-0">
                {f.fmt(inputs[f.id])}
              </span>
            </label>
          ))}
        </div>
      </div>

      <p className="text-[11px] text-ink-muted leading-relaxed">
        Academic inputs only — the model uses <span className="font-semibold text-ink-dim">no demographic proxies</span>.
        This is an estimate from public admit rates and accepted-student patterns, not an official prediction.
      </p>
    </div>
  );
}
