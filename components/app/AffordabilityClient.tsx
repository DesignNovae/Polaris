"use client";

/**
 * Affordability planner.
 *
 * Answers the question that actually decides a Bangladeshi family's university
 * list - "can we pay for this?" - in taka, and names the shortfall rather than
 * leaving it implied.
 *
 * Every figure is labelled with its basis. Living costs carry their official
 * source and link to it; tuition is marked as an estimate wherever it appears.
 * A planner that blurs the two would be worse than no planner, because a family
 * would plan around it.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/cn";
import { Card, SectionTitle, Btn, Pill, Progress } from "./ui";
import { formatBdt, assessAffordability } from "@/lib/affordability/model";

type Tier = "elite" | "top10" | "top50" | "top100" | "top200" | "regional";

type CostLine = {
  label: string; bdt: number; basis: "official" | "estimate";
  note: string; sourceName?: string; sourceUrl?: string;
};

type Assessment = {
  country: string;
  supported: boolean;
  lines: CostLine[];
  tuitionRangeBdt: [number, number] | null;
  grossAnnualBdt: number;
  aidAnnualBdt: number;
  netAnnualBdt: number;
  budgetAnnualBdt: number;
  gapAnnualBdt: number;
  totalNetBdt: number;
  totalGapBdt: number;
  verdict: "comfortable" | "tight" | "gap";
  fxAsOf: string;
};

type Scholarship = {
  id: string; name: string; host: string; value: string; eligibility: string;
  summary: string; coverage: "full" | "substantial" | "partial" | "unknown";
  gapImpact: string; bangladeshEligible: boolean; officialUrl?: string;
  typicalWindow?: string; difficulty?: string;
};

const TIERS: { id: Tier; label: string }[] = [
  { id: "elite", label: "Elite" },
  { id: "top10", label: "Top 10" },
  { id: "top50", label: "Top 50" },
  { id: "top100", label: "Top 100" },
  { id: "top200", label: "Top 200" },
  { id: "regional", label: "Regional" },
];

const VERDICT = {
  comfortable: { label: "Within budget", tone: "aurora", copy: "Your stated budget covers the modelled cost." },
  tight: { label: "Tight", tone: "polaris", copy: "Within about 15% of your budget - workable, but with no room for a bad year." },
  gap: { label: "Funding gap", tone: "rose", copy: "The modelled cost exceeds your budget. Close it before this school goes on the list." },
} as const;

export function AffordabilityClient({
  countries, defaultCountry, demoScholarships,
}: {
  countries: string[];
  defaultCountry: string;
  /**
   * Demo mode. The cost model is pure, so the demo runs it in the browser and
   * uses a seeded award list instead of calling the authenticated API.
   */
  demoScholarships?: Scholarship[];
}) {
  const [country, setCountry] = useState(defaultCountry);
  const [tier, setTier] = useState<Tier>("top50");
  const [budgetLakh, setBudgetLakh] = useState(15);
  const [aidPct, setAidPct] = useState(0);
  const [years, setYears] = useState(4);

  const [assessment, setAssessment] = useState<Assessment | null>(null);
  const [scholarships, setScholarships] = useState<Scholarship[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const annualBudgetBdt = useMemo(() => Math.round(budgetLakh * 100_000), [budgetLakh]);

  const run = useCallback(async () => {
    if (demoScholarships) {
      setAssessment(assessAffordability({
        country, tier, annualBudgetBdt, aidRatio: aidPct / 100, years,
      }) as Assessment);
      setScholarships(demoScholarships);
      return;
    }
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/affordability", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          country, tier, annualBudgetBdt, aidRatio: aidPct / 100, years,
        }),
      });
      if (!res.ok) throw new Error("Could not run the assessment");
      const d = await res.json();
      setAssessment(d.assessment);
      setScholarships(d.scholarships ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }, [country, tier, annualBudgetBdt, aidPct, years, demoScholarships]);

  // Debounced so dragging a slider doesn't fire a request per pixel.
  useEffect(() => {
    const id = window.setTimeout(run, 260);
    return () => window.clearTimeout(id);
  }, [run]);

  const v = assessment ? VERDICT[assessment.verdict] : null;

  return (
    <div className="mx-auto max-w-5xl px-5 py-8 sm:px-8">
      <SectionTitle
        eyebrow="Money"
        title="Can you actually afford it?"
        sub="Living costs come from official visa and maintenance requirements. Tuition is a published-range estimate and is labelled as one."
      />

      <div className="mt-8 grid gap-5 lg:grid-cols-[minmax(0,320px)_minmax(0,1fr)]">
        {/* ── Inputs ── */}
        <Card className="h-fit p-5">
          <Field label="Country">
            <div className="flex flex-wrap gap-1.5">
              {countries.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setCountry(c)}
                  className={cn(
                    "rounded-lg px-2.5 py-1.5 text-[12.5px] font-medium transition-colors",
                    c === country
                      ? "bg-polaris-500 text-paper"
                      : "bg-paper-soft text-ink-dim hover:bg-paper-deep hover:text-ink dark:bg-white/[0.05] dark:hover:bg-white/[0.09]",
                  )}
                >
                  {c}
                </button>
              ))}
            </div>
          </Field>

          <Field label="University tier">
            <div className="flex flex-wrap gap-1.5">
              {TIERS.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setTier(t.id)}
                  className={cn(
                    "rounded-lg px-2.5 py-1.5 text-[12.5px] font-medium transition-colors",
                    t.id === tier
                      ? "bg-ink text-paper dark:bg-white/[0.16]"
                      : "bg-paper-soft text-ink-dim hover:bg-paper-deep hover:text-ink dark:bg-white/[0.05] dark:hover:bg-white/[0.09]",
                  )}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </Field>

          <Field label={`Family budget per year — ${formatBdt(annualBudgetBdt)}`}>
            <input
              type="range" min={1} max={80} step={1}
              value={budgetLakh}
              onChange={(e) => setBudgetLakh(Number(e.target.value))}
              className="w-full accent-polaris-500"
              aria-label="Annual family budget in lakh taka"
            />
            <div className="mt-1 flex justify-between text-[10.5px] text-ink-dim">
              <span>৳1L</span><span>৳80L</span>
            </div>
          </Field>

          <Field label={`Expected aid — ${aidPct}% of tuition`}>
            <input
              type="range" min={0} max={100} step={5}
              value={aidPct}
              onChange={(e) => setAidPct(Number(e.target.value))}
              className="w-full accent-aurora-500"
              aria-label="Expected aid as a percentage of tuition"
            />
            <p className="mt-1 text-[11px] leading-snug text-ink-dim">
              Applied to tuition only. Maintenance requirements are rarely waived.
            </p>
          </Field>

          <Field label={`Programme length — ${years} years`}>
            <input
              type="range" min={1} max={6} step={1}
              value={years}
              onChange={(e) => setYears(Number(e.target.value))}
              className="w-full accent-nova-500"
              aria-label="Programme length in years"
            />
          </Field>

          {error && <p className="mt-3 text-[12px] text-rose-600">{error}</p>}
        </Card>

        {/* ── Result ── */}
        <div className="space-y-5">
          {assessment && !assessment.supported && (
            <Card className="p-6">
              <p className="text-[14px] text-ink-dim">
                No sourced cost benchmark for {assessment.country} yet, so there is
                nothing honest to show. Pick another country.
              </p>
            </Card>
          )}

          {assessment?.supported && v && (
            <>
              <Card className={cn("relative overflow-hidden p-6", busy && "opacity-70")}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="text-[11px] uppercase tracking-[0.18em] text-ink-dim">
                      Net cost per year
                    </div>
                    <div className="mt-1.5 font-serif text-[38px] font-bold leading-none text-ink tabular-nums">
                      {formatBdt(assessment.netAnnualBdt)}
                    </div>
                    <div className="mt-1.5 text-[12.5px] text-ink-dim">
                      {formatBdt(assessment.totalNetBdt)} across {years} years
                    </div>
                  </div>
                  <Pill tone={v.tone}>{v.label}</Pill>
                </div>

                <p className="mt-4 text-[13.5px] leading-relaxed text-ink-dim">{v.copy}</p>

                {/* Budget vs cost */}
                <div className="mt-5">
                  <div className="flex justify-between text-[11.5px] text-ink-dim">
                    <span>Your budget {formatBdt(assessment.budgetAnnualBdt)}</span>
                    <span>Cost {formatBdt(assessment.netAnnualBdt)}</span>
                  </div>
                  <div className="mt-1.5">
                    <Progress
                      value={Math.min(100, (assessment.budgetAnnualBdt / Math.max(1, assessment.netAnnualBdt)) * 100)}
                      tone={assessment.verdict === "gap" ? "rose" : assessment.verdict === "tight" ? "polaris" : "aurora"}
                      height="h-2"
                    />
                  </div>
                </div>

                <AnimatePresence>
                  {assessment.gapAnnualBdt > 0 && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      className="overflow-hidden"
                    >
                      <div className="mt-5 rounded-xl border border-rose-500/25 bg-rose-500/[0.06] p-4">
                        <div className="text-[11px] uppercase tracking-[0.16em] text-rose-700 dark:text-rose-300">
                          Funding gap
                        </div>
                        <div className="mt-1 font-serif text-[26px] font-bold text-ink tabular-nums">
                          {formatBdt(assessment.gapAnnualBdt)}
                          <span className="ml-1.5 text-[13px] font-normal text-ink-dim">per year</span>
                        </div>
                        <p className="mt-1.5 text-[12.5px] text-ink-dim">
                          {formatBdt(assessment.totalGapBdt)} over the full programme. The
                          awards below are ranked by how much of it they would close.
                        </p>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </Card>

              {/* Breakdown */}
              <Card className="p-6">
                <h3 className="font-serif text-[17px] font-bold text-ink">
                  Where the money goes
                </h3>
                <ul className="mt-4 space-y-3">
                  {assessment.lines.map((line) => (
                    <li key={line.label} className="border-b border-polaris-500/10 pb-3 last:border-0 last:pb-0">
                      <div className="flex items-baseline justify-between gap-3">
                        <div className="flex items-center gap-2">
                          <span className="text-[14px] font-semibold text-ink">{line.label}</span>
                          <span
                            className={cn(
                              "rounded px-1.5 py-0.5 text-[9.5px] font-bold uppercase tracking-[0.1em]",
                              line.basis === "official"
                                ? "bg-aurora-500/12 text-aurora-700 dark:text-aurora-200"
                                : "bg-ink/[0.06] text-ink-dim dark:bg-white/[0.08]",
                            )}
                          >
                            {line.basis}
                          </span>
                        </div>
                        <span className="shrink-0 font-mono text-[14px] font-semibold text-ink tabular-nums">
                          {formatBdt(line.bdt)}
                        </span>
                      </div>
                      <p className="mt-1 text-[12px] leading-relaxed text-ink-dim">{line.note}</p>
                      {line.sourceUrl && (
                        <a
                          href={line.sourceUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="mt-1 inline-block text-[11.5px] font-medium text-polaris-700 hover:underline dark:text-polaris-300"
                        >
                          {line.sourceName} ↗
                        </a>
                      )}
                    </li>
                  ))}
                  {assessment.aidAnnualBdt > 0 && (
                    <li className="flex items-baseline justify-between gap-3 pt-1">
                      <span className="text-[14px] font-semibold text-aurora-700 dark:text-aurora-200">
                        Expected aid
                      </span>
                      <span className="font-mono text-[14px] font-semibold text-aurora-700 tabular-nums dark:text-aurora-200">
                        -{formatBdt(assessment.aidAnnualBdt)}
                      </span>
                    </li>
                  )}
                </ul>
                <p className="mt-4 text-[11px] text-ink-dim">
                  Converted at rates reviewed {assessment.fxAsOf}. Tuition ranges from{" "}
                  {assessment.tuitionRangeBdt
                    ? `${formatBdt(assessment.tuitionRangeBdt[0])} to ${formatBdt(assessment.tuitionRangeBdt[1])}`
                    : "n/a"}{" "}
                  for this tier - confirm against the university&apos;s own fee page.
                </p>
              </Card>

              {/* Awards */}
              {scholarships.length > 0 && (
                <Card className="p-6">
                  <h3 className="font-serif text-[17px] font-bold text-ink">
                    {assessment.gapAnnualBdt > 0
                      ? "Awards that would close the gap"
                      : "Awards worth applying for anyway"}
                  </h3>
                  <ul className="mt-4 space-y-3">
                    {scholarships.map((s) => (
                      <li
                        key={s.id}
                        className="rounded-xl border border-polaris-500/12 bg-paper-soft p-4 dark:bg-white/[0.03]"
                      >
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-[14px] font-semibold text-ink">{s.name}</span>
                          <CoverageTag coverage={s.coverage} />
                          {s.bangladeshEligible && (
                            <span className="rounded bg-polaris-500/12 px-1.5 py-0.5 text-[9.5px] font-bold uppercase tracking-[0.1em] text-polaris-700 dark:text-polaris-300">
                              BD eligible
                            </span>
                          )}
                        </div>
                        <div className="mt-1 text-[12px] text-ink-dim">{s.host} · {s.value}</div>
                        <p className="mt-2 text-[12.5px] leading-relaxed text-ink">{s.gapImpact}</p>
                        <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11.5px] text-ink-dim">
                          {s.typicalWindow && <span>{s.typicalWindow}</span>}
                          {s.officialUrl && (
                            <a
                              href={s.officialUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="font-medium text-polaris-700 hover:underline dark:text-polaris-300"
                            >
                              Official page ↗
                            </a>
                          )}
                        </div>
                      </li>
                    ))}
                  </ul>
                </Card>
              )}
            </>
          )}

          {!assessment && (
            <Card className="p-6">
              <p className="text-[13.5px] text-ink-dim">Working out the numbers…</p>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="mb-5 last:mb-0">
      <div className="mb-2 text-[12px] font-semibold text-ink">{label}</div>
      {children}
    </div>
  );
}

function CoverageTag({ coverage }: { coverage: Scholarship["coverage"] }) {
  const map = {
    full: { label: "Full cost", cls: "bg-aurora-500/14 text-aurora-700 dark:text-aurora-200" },
    substantial: { label: "Tuition", cls: "bg-polaris-500/14 text-polaris-700 dark:text-polaris-300" },
    partial: { label: "Partial", cls: "bg-ink/[0.06] text-ink-dim dark:bg-white/[0.08]" },
    unknown: { label: "Unstated", cls: "bg-ink/[0.06] text-ink-dim dark:bg-white/[0.08]" },
  }[coverage];
  return (
    <span className={cn("rounded px-1.5 py-0.5 text-[9.5px] font-bold uppercase tracking-[0.1em]", map.cls)}>
      {map.label}
    </span>
  );
}
