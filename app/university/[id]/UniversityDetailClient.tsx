"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Nav } from "@/components/Nav";
import { Footer } from "@/components/Footer";
import { useLang } from "@/lib/i18n/LangProvider";
import { cn } from "@/lib/cn";
import {
  profileToInputs,
  scoreProbability,
  type ProbabilityInputs,
  type ProbabilityResult,
} from "@/lib/ml/probability";
import { PROFILE_KEY, type StudentProfile } from "@/lib/profile";

export type Uni = {
  id: string;
  name: string;
  country: string;
  city: string;
  tier: "elite" | "top10" | "top50" | "top100" | "top200" | "regional";
  acceptanceRate: number;
  topPrograms: string[];
  requirements: {
    gpa: string;
    tests: string;
    essays: string;
    recs: string;
    differentiators: string;
  };
  summary: string;
  tags: string[];
};

/**
 * Interactive half of the university page.
 *
 * The university itself is fetched on the server and handed down as a prop, so
 * the page's content is in the initial HTML - it used to be fetched after
 * hydration, which left the highest-value pages in the product (one per
 * university) as an empty shell to a crawler.
 *
 * What genuinely needs the client stays here: the acceptance estimate reads the
 * visitor's locally-stored profile, which the server has no access to.
 */
export function UniversityDetailClient({ uni }: { uni: Uni }) {
  const { t } = useLang();
  const [inputs, setInputs] = useState<ProbabilityInputs>({
    gpa: 3.7,
    testPercentile: 85,
    ecCount: 4,
    research: 2,
  });

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(PROFILE_KEY);
      const profile: StudentProfile | null = raw ? JSON.parse(raw) : null;
      setInputs(profileToInputs(profile));
    } catch {
      // ignore
    }
  }, []);

  const result: ProbabilityResult | null = useMemo(() => {
    return scoreProbability(inputs, {
      id: uni.id,
      tier: uni.tier,
      acceptanceRate: uni.acceptanceRate,
    });
  }, [uni, inputs]);

  const probPct = result ? Math.round(result.probability * 100) : 0;
  const baselinePct = uni.acceptanceRate * 100;

  return (
    <main className="min-h-screen">
      <Nav />
      <section className="mx-auto max-w-6xl px-4 sm:px-6 py-8 sm:py-12">
        <Link
          href="/university"
          className="text-sm text-ink-dim hover:text-ink transition-all duration-200 inline-flex items-center gap-1"
        >
          ← {t.uni.backToList}
        </Link>

        <div className="mt-4 sm:mt-6 flex flex-col md:flex-row md:items-end md:justify-between gap-4">
          <div>
            <h1 className="text-3xl sm:text-4xl md:text-5xl font-serif font-bold tracking-tight">
              {uni.name}
            </h1>
            <div className="mt-2 text-ink-dim">
              {uni.city} · {uni.country} · {(uni.acceptanceRate * 100).toFixed(1)}%
              published acceptance
            </div>
          </div>
        </div>

        <div className="mt-10 grid grid-cols-1 lg:grid-cols-5 gap-6">
          {/* Probability ring */}
          <div className="lg:col-span-2 glass-strong rounded-3xl p-7 relative overflow-hidden">
            <div className="absolute -top-24 -right-24 h-72 w-72 rounded-full bg-polaris-500/10 blur-3xl" />
            <div className="text-xs uppercase tracking-[0.2em] text-ink-muted relative">
              {t.uni.probability}
            </div>
            <div className="relative mt-6 flex items-center justify-center">
              <ProbabilityRing pct={probPct} baseline={baselinePct} />
            </div>
            {result && (
              <div className="mt-6 relative">
                <div className="text-xs uppercase tracking-[0.2em] text-ink-muted mb-3">
                  {t.uni.whyTitle}
                </div>
                <div className="text-xs text-ink-muted mb-3">{t.uni.whyHint}</div>
                <ul className="space-y-2.5">
                  {result.factors.map((f) => (
                    <FactorBar key={f.name} factor={f} />
                  ))}
                </ul>
              </div>
            )}
          </div>

          {/* Scenario simulator */}
          <div className="lg:col-span-3 glass rounded-3xl p-7">
            <div className="text-xs uppercase tracking-[0.2em] text-ink-muted">
              {t.uni.simTitle}
            </div>
            <div className="text-xs text-ink-muted mt-1.5 mb-6">{t.uni.simHint}</div>

            <div className="space-y-6">
              <Slider
                label={t.uni.gpa}
                value={inputs.gpa}
                min={2}
                max={4}
                step={0.05}
                display={inputs.gpa.toFixed(2)}
                onChange={(v) => setInputs((p) => ({ ...p, gpa: v }))}
              />
              <Slider
                label={t.uni.test}
                value={inputs.testPercentile}
                min={0}
                max={100}
                step={1}
                display={`${inputs.testPercentile}%`}
                onChange={(v) => setInputs((p) => ({ ...p, testPercentile: v }))}
              />
              <Slider
                label={t.uni.ecCount}
                value={inputs.ecCount}
                min={0}
                max={10}
                step={1}
                display={`${inputs.ecCount} / 10`}
                onChange={(v) => setInputs((p) => ({ ...p, ecCount: v }))}
              />
              <Slider
                label={t.uni.research}
                value={inputs.research}
                min={0}
                max={10}
                step={1}
                display={`${inputs.research} / 10`}
                onChange={(v) => setInputs((p) => ({ ...p, research: v }))}
              />
            </div>

            {/* Requirements callout */}
            <div className="mt-8 pt-6 border-t border-polaris-500/15">
              <div className="text-xs uppercase tracking-[0.2em] text-ink-muted mb-3">
                What this school looks for
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                <Req label="GPA" value={uni.requirements.gpa} />
                <Req label="Tests" value={uni.requirements.tests} />
                <Req label="Essays" value={uni.requirements.essays} />
                <Req label="Recs" value={uni.requirements.recs} />
              </div>
              <div className="mt-4 text-sm text-ink-dim leading-relaxed">
                <span className="font-semibold text-ink">Differentiator:</span>{" "}
                {uni.requirements.differentiators}
              </div>
            </div>
          </div>
        </div>

        {/* Ethics footer */}
        <div className="mt-8 sm:mt-12 glass rounded-2xl p-5 sm:p-6">
          <div className="text-xs uppercase tracking-[0.2em] text-aurora-500 mb-2 flex items-center gap-1.5">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-aurora-500"><path d="M15 15l5 5" /><circle cx="10" cy="10" r="7" /></svg>
            {t.ethics.title}
          </div>
          <p className="text-sm text-ink-dim leading-relaxed">{t.ethics.body}</p>
        </div>
      </section>
      <Footer />
    </main>
  );
}

function Slider({
  label,
  value,
  min,
  max,
  step,
  display,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  display: string;
  onChange: (v: number) => void;
}) {
  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <div className="text-sm text-ink">{label}</div>
        <div className="text-sm font-semibold text-polaris-500 tabular-nums">{display}</div>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="w-full"
      />
    </div>
  );
}

function FactorBar({
  factor,
}: {
  factor: { name: string; weight: number; contribution: number; hint?: string };
}) {
  const ratio = factor.contribution / factor.weight; // -1 .. 1
  const positive = ratio >= 0;
  const filled = Math.min(1, Math.abs(ratio));
  const sign = factor.contribution >= 0 ? "+" : "";
  return (
    <li className="text-xs">
      <div className="flex items-center justify-between mb-1">
        <span className="text-ink">{factor.name}</span>
        <span
          className={cn(
            "tabular-nums",
            positive ? "text-aurora-500" : "text-nova-500"
          )}
        >
          {sign}{factor.contribution.toFixed(2)}
          <span className="text-ink-muted"> · w {factor.weight.toFixed(2)}</span>
        </span>
      </div>
      <div className="relative h-1.5 rounded-full bg-bg-soft overflow-hidden flex">
        {/* center divider */}
        <div className="absolute left-1/2 top-0 bottom-0 w-px bg-ink-muted/30" />
        {positive ? (
          <>
            <div className="w-1/2" />
            <div
              className="h-full bg-gradient-to-r from-polaris-400 via-aurora-400 to-aurora-500 transition-all"
              style={{ width: `${filled * 50}%` }}
            />
          </>
        ) : (
          <>
            <div className="w-1/2 flex justify-end">
              <div
                className="h-full bg-gradient-to-l from-nova-500 to-nova-400 transition-all"
                style={{ width: `${filled * 100}%` }}
              />
            </div>
            <div className="w-1/2" />
          </>
        )}
      </div>
      {factor.hint && <div className="text-[11px] text-ink-muted mt-1 leading-snug">{factor.hint}</div>}
    </li>
  );
}

function Req({ label, value }: { label: string; value: string }) {
  return (
    <div className="glass rounded-xl p-3">
      <div className="text-[10px] uppercase tracking-wide text-ink-muted mb-1">{label}</div>
      <div className="text-sm text-ink leading-snug">{value}</div>
    </div>
  );
}

function ProbabilityRing({ pct, baseline }: { pct: number; baseline: number }) {
  const r = 80;
  const c = 2 * Math.PI * r;
  const offset = c - (pct / 100) * c;
  return (
    <div className="relative">
      <svg width="200" height="200" viewBox="0 0 200 200" className="-rotate-90">
        <defs>
          <linearGradient id="ringGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#8B5E3C" />
            <stop offset="50%" stopColor="#C47D4E" />
            <stop offset="100%" stopColor="#5B8C6D" />
          </linearGradient>
        </defs>
        <circle
          cx="100"
          cy="100"
          r={r}
          fill="none"
          stroke="rgba(139,94,60,0.12)"
          strokeWidth="14"
        />
        <circle
          cx="100"
          cy="100"
          r={r}
          fill="none"
          stroke="url(#ringGrad)"
          strokeWidth="14"
          strokeDasharray={c}
          strokeDashoffset={offset}
          strokeLinecap="round"
          className="transition-[stroke-dashoffset] duration-500 ease-out"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <div className="text-5xl font-serif font-bold text-ink tabular-nums">{pct}%</div>
        <div className="text-xs text-ink-muted mt-1">vs {baseline.toFixed(1)}% baseline</div>
      </div>
    </div>
  );
}
