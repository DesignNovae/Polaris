"use client";

/**
 * Cohort benchmarking.
 *
 * Shows where a student sits against everyone else aiming at the same tier -
 * as a distribution, not a leaderboard. Deliberately no names, no ranks, no
 * "you are #14": the histogram plus a percentile is the most that can be shown
 * without making other students identifiable, and it is also the most that is
 * actually useful.
 *
 * When the cohort is too small the suppression notice is the content. It
 * explains the rule rather than showing an empty chart, because a student who
 * sees nothing assumes the feature is broken.
 */

import { useCallback, useEffect, useState } from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/cn";
import { Card, SectionTitle, Pill } from "./ui";

type Bucket = { label: string; count: number; contains: boolean };

type MetricSummary = {
  metric: string;
  label: string;
  you: number;
  percentile: number;
  median: number;
  quartiles: [number, number];
  buckets: Bucket[];
};

type Cohort =
  | { suppressed: true; cohortSize: number; minimum: number; tier: string; country: string | null }
  | { suppressed: false; cohortSize: number; tier: string; country: string | null; metrics: MetricSummary[] };

const TIER_LABEL: Record<string, string> = {
  elite: "elite", top50: "top-50", top200: "top-200", regional: "regional",
};

export function CohortClient({ demoCohort }: { demoCohort?: Cohort } = {}) {
  const [matchCountry, setMatchCountry] = useState(false);
  const [cohort, setCohort] = useState<Cohort | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(true);

  const load = useCallback(async () => {
    // The demo has no database behind it; seeded statistics stand in so the
    // surface is explorable without an account.
    if (demoCohort) {
      setCohort(demoCohort);
      setBusy(false);
      return;
    }
    setBusy(true);
    setError("");
    try {
      const res = await fetch(`/api/cohort?country=${matchCountry ? "1" : "0"}`, {
        cache: "no-store",
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.error || "Could not load the cohort");
      setCohort(d.cohort);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
      setCohort(null);
    } finally {
      setBusy(false);
    }
  }, [matchCountry, demoCohort]);

  useEffect(() => { void load(); }, [load]);

  return (
    <div className="mx-auto max-w-4xl px-5 py-8 sm:px-8">
      <SectionTitle
        eyebrow="Benchmarks"
        title="Where you stand"
        sub="Compared with anonymised students targeting the same tier. Distributions and percentiles only - never individual students, and never a cohort small enough to identify one."
      />

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <label className="flex cursor-pointer items-center gap-2 text-[13px] text-ink-dim">
          <input
            type="checkbox"
            checked={matchCountry}
            onChange={(e) => setMatchCountry(e.target.checked)}
            className="accent-polaris-500"
          />
          Only students from my country
        </label>
        {cohort && !busy && (
          <Pill tone="ink">
            {cohort.cohortSize} student{cohort.cohortSize === 1 ? "" : "s"}
          </Pill>
        )}
      </div>

      {error && (
        <Card className="mt-6 p-6">
          <p className="text-[13.5px] text-ink-dim">{error}</p>
        </Card>
      )}

      {busy && !cohort && (
        <Card className="mt-6 p-6">
          <p className="text-[13.5px] text-ink-dim">Building the cohort…</p>
        </Card>
      )}

      {cohort?.suppressed && (
        <Card className="mt-6 p-6">
          <div className="flex items-start gap-3">
            <span className="mt-1 grid h-6 w-6 shrink-0 place-items-center rounded-full bg-polaris-500/12 text-polaris-700 dark:text-polaris-300">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden>
                <rect x="4" y="10" width="16" height="10" rx="2" />
                <path d="M8 10V7a4 4 0 0 1 8 0v3" />
              </svg>
            </span>
            <div>
              <h3 className="font-serif text-[17px] font-bold text-ink">
                Not enough students yet
              </h3>
              <p className="mt-2 max-w-lg text-[13.5px] leading-relaxed text-ink-dim">
                {cohort.cohortSize} student{cohort.cohortSize === 1 ? " is" : "s are"} targeting{" "}
                {TIER_LABEL[cohort.tier] ?? cohort.tier} universities
                {cohort.country ? ` from ${cohort.country}` : ""}. Statistics need at
                least {cohort.minimum}.
              </p>
              <p className="mt-2 max-w-lg text-[12.5px] leading-relaxed text-ink-dim">
                This is a rule, not a loading state. In a group this small a
                percentile would tell you another student&apos;s scores, so nothing
                is shown at all.
              </p>
              {cohort.country && (
                <button
                  type="button"
                  onClick={() => setMatchCountry(false)}
                  className="mt-3 text-[13px] font-semibold text-polaris-700 hover:underline dark:text-polaris-300"
                >
                  Widen to all countries
                </button>
              )}
            </div>
          </div>
        </Card>
      )}

      {cohort && !cohort.suppressed && (
        <div className="mt-6 space-y-4">
          {cohort.metrics.map((m, i) => (
            <MetricCard key={m.metric} metric={m} index={i} />
          ))}

          <p className="pt-2 text-[11.5px] leading-relaxed text-ink-dim">
            Based on {cohort.cohortSize} profiles targeting{" "}
            {TIER_LABEL[cohort.tier] ?? cohort.tier} universities
            {cohort.country ? ` from ${cohort.country}` : ""}. Your own profile is
            included. Percentiles are computed on the same GPA and test basis the
            acceptance model uses, so the two agree.
          </p>
        </div>
      )}
    </div>
  );
}

function MetricCard({ metric, index }: { metric: MetricSummary; index: number }) {
  const max = Math.max(1, ...metric.buckets.map((b) => b.count));
  const above = metric.percentile >= 50;

  return (
    <Card className="p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h3 className="text-[15px] font-semibold text-ink">{metric.label}</h3>
        <div className="flex items-baseline gap-3 text-[12.5px] text-ink-dim">
          <span>
            You <strong className="font-mono text-ink tabular-nums">{metric.you}</strong>
          </span>
          <span>
            Median <span className="font-mono tabular-nums">{metric.median}</span>
          </span>
        </div>
      </div>

      {/* Percentile line */}
      <div className="mt-3 flex items-center gap-3">
        <div className="relative h-2 flex-1 overflow-hidden rounded-full bg-paper-deep dark:bg-white/[0.07]">
          <motion.div
            className={cn(
              "h-full rounded-full",
              above ? "bg-aurora-500" : "bg-polaris-500",
            )}
            initial={{ width: 0 }}
            animate={{ width: `${metric.percentile}%` }}
            transition={{ duration: 0.7, delay: index * 0.06, ease: [0.16, 1, 0.3, 1] }}
          />
        </div>
        <span
          className={cn(
            "shrink-0 text-[12.5px] font-bold tabular-nums",
            above ? "text-aurora-700 dark:text-aurora-300" : "text-polaris-700 dark:text-polaris-300",
          )}
        >
          {metric.percentile}th
        </span>
      </div>

      {/* Distribution */}
      <div className="mt-4 flex items-end gap-1.5" role="img" aria-label={`Distribution of ${metric.label}`}>
        {metric.buckets.map((b, i) => (
          <div key={b.label} className="flex flex-1 flex-col items-center gap-1.5">
            <motion.div
              className={cn(
                "w-full rounded-t-md",
                b.contains
                  ? "bg-gradient-to-t from-polaris-500 to-polaris-400"
                  : "bg-ink/[0.10] dark:bg-white/[0.12]",
              )}
              style={{ minHeight: 3 }}
              initial={{ height: 3 }}
              animate={{ height: Math.max(3, (b.count / max) * 68) }}
              transition={{ duration: 0.6, delay: index * 0.06 + i * 0.04, ease: [0.16, 1, 0.3, 1] }}
              title={`${b.count} student${b.count === 1 ? "" : "s"}`}
            />
            <span
              className={cn(
                "text-[9.5px] tabular-nums",
                b.contains ? "font-bold text-ink" : "text-ink-dim",
              )}
            >
              {b.label}
            </span>
          </div>
        ))}
      </div>

      <p className="mt-3 text-[11.5px] text-ink-dim">
        Middle half of the cohort sits between{" "}
        <span className="font-mono tabular-nums">{metric.quartiles[0]}</span> and{" "}
        <span className="font-mono tabular-nums">{metric.quartiles[1]}</span>.
      </p>
    </Card>
  );
}
