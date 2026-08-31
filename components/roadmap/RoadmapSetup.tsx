"use client";

/**
 * RoadmapSetup - first-time setup flow for the roadmap tree.
 * 3 steps: (1) who you are, (2) the mission, (3) time + constraints.
 * Produces a RoadmapConfig and hands it to onGenerate.
 */

import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/cn";
import {
  EDUCATION_LEVELS, EDUCATION_LEVEL_LABELS, suggestTimelineMode,
  type EducationLevel, type TimelineMode, type RoadmapConfig,
} from "@/lib/roadmap/types";
import type { Country, Degree, Tier } from "@/lib/profile";

/** Profile answers collected during setup - saved server-side with the
 *  roadmap so onboarding and roadmap share one source of truth. */
export type ProfileSeed = {
  country: Country;
  degree: Degree;
  targetTier: Tier;
};

export type SetupInitialProfile = Partial<ProfileSeed> | null;

const COUNTRIES: Country[] = ["Bangladesh", "India", "Pakistan", "Nepal", "Other South Asia", "Other"];
const DEGREES: Array<{ v: Degree; label: string }> = [
  { v: "undergrad", label: "Bachelor's" },
  { v: "masters", label: "Master's" },
  { v: "phd", label: "PhD" },
  { v: "undecided", label: "Not sure yet" },
];
const TIERS: Array<{ v: Tier; label: string; hint: string }> = [
  { v: "elite", label: "Elite", hint: "Ivy / Oxbridge tier" },
  { v: "top50", label: "Top 50", hint: "World top 50" },
  { v: "top200", label: "Top 200", hint: "Strong global" },
  { v: "regional", label: "Regional", hint: "Best near home" },
];

const DURATIONS: Array<{ days: number; label: string; hint: string }> = [
  { days: 15, label: "15 days", hint: "Sprint" },
  { days: 45, label: "45 days", hint: "Compact" },
  { days: 56, label: "8 weeks", hint: "Focused" },
  { days: 90, label: "3 months", hint: "Builder" },
  { days: 180, label: "6 months", hint: "Hybrid" },
  { days: 365, label: "1 year", hint: "Full arc" },
  { days: 730, label: "2+ years", hint: "Multi-year" },
];

const EXAMS = ["SAT", "IELTS", "TOEFL", "board", "olympiad"] as const;
const EXAM_LABELS: Record<(typeof EXAMS)[number], string> = {
  SAT: "SAT", IELTS: "IELTS", TOEFL: "TOEFL", board: "Board exams", olympiad: "Olympiads",
};

export function RoadmapSetup({
  defaultLevel, initialProfile, onGenerate, busy, error,
}: {
  defaultLevel: EducationLevel;
  initialProfile?: SetupInitialProfile;
  onGenerate: (config: RoadmapConfig, seed: ProfileSeed) => void;
  busy: boolean;
  error: string | null;
}) {
  const [step, setStep] = useState(0);
  const [level, setLevel] = useState<EducationLevel>(defaultLevel);
  const [currentYear, setCurrentYear] = useState("");
  const [country, setCountry] = useState<Country>(initialProfile?.country ?? "Bangladesh");
  const [degree, setDegree] = useState<Degree>(initialProfile?.degree ?? "undergrad");
  const [tier, setTier] = useState<Tier>(initialProfile?.targetTier ?? "top200");
  const [targetGoal, setTargetGoal] = useState("");
  const [targetPortfolio, setTargetPortfolio] = useState("");
  const [academicTarget, setAcademicTarget] = useState("");
  const [exams, setExams] = useState<Array<(typeof EXAMS)[number]>>([]);
  const [durationDays, setDurationDays] = useState(90);
  const [timelineMode, setTimelineMode] = useState<TimelineMode | "auto">("auto");
  const [hours, setHours] = useState(10);
  const [weakAreas, setWeakAreas] = useState("");
  const [satScore, setSatScore] = useState("");
  const [ieltsScore, setIeltsScore] = useState("");
  const [generationStep, setGenerationStep] = useState(0);

  const resolvedMode: TimelineMode = timelineMode === "auto" ? suggestTimelineMode(durationDays) : timelineMode;

  useEffect(() => {
    if (!busy) {
      setGenerationStep(0);
      return;
    }
    const timer = window.setInterval(() => setGenerationStep((step) => Math.min(2, step + 1)), 6000);
    return () => window.clearInterval(timer);
  }, [busy]);

  const canNext = useMemo(() => {
    if (step === 0) return true;
    if (step === 1) return targetGoal.trim().length > 0;
    return true;
  }, [step, targetGoal]);

  function toggleExam(e: (typeof EXAMS)[number]) {
    setExams((cur) => (cur.includes(e) ? cur.filter((x) => x !== e) : [...cur, e]));
  }

  function submit() {
    const currentScores: Record<string, number> = {};
    const sat = parseInt(satScore, 10);
    if (Number.isFinite(sat) && sat >= 400) currentScores["sat-total"] = sat;
    const ielts = parseFloat(ieltsScore);
    if (Number.isFinite(ielts) && ielts >= 1) currentScores["ielts-overall"] = ielts;
    const targets = targetPortfolio
      .split(/[\n,]/)
      .map((value) => value.trim())
      .filter(Boolean)
      .slice(0, 12)
      .map((query, index) => ({ query, kind: "university" as const, priority: index === 0 ? "primary" as const : "secondary" as const }));

    onGenerate(
      {
        educationLevel: level,
        currentYear: currentYear.trim() || undefined,
        targetGoal: targetGoal.trim(),
        durationDays,
        timelineMode: resolvedMode,
        exams,
        availableHoursPerWeek: hours,
        weakAreas: weakAreas.trim() || undefined,
        academicTarget: academicTarget.trim() || undefined,
        ...(targets.length ? { targets } : {}),
        ...(Object.keys(currentScores).length ? { currentScores } : {}),
      },
      { country, degree, targetTier: tier },
    );
  }

  const steps = ["Your level", "The mission", "Time & reality"];

  if (busy) {
    const generationSteps = [
      { title: "Preparing your target context", detail: "Resolving targets and grounding the plan in the available evidence." },
      { title: "Building the roadmap spine", detail: "Creating the full timeline while keeping future periods ready to expand." },
      { title: "Opening your first period", detail: "Turning the first unit into concrete tasks you can start today." },
    ];
    return (
      <div className="min-h-[68vh] flex items-center justify-center px-6 py-16">
        <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-[560px] rounded-3xl bg-paper-card p-7 shadow-pop ring-1 ring-inset ring-polaris-500/15">
          <div className="flex items-center gap-3">
            <span className="relative flex h-11 w-11 items-center justify-center rounded-full bg-ink text-paper">
              <span className="absolute inset-0 rounded-full border-2 border-polaris-400/30 border-t-polaris-400 animate-spin" />
              <span className="font-serif text-lg">✦</span>
            </span>
            <div>
              <div className="text-[10px] uppercase tracking-[0.22em] text-ink-muted">Polaris is working</div>
              <h1 className="mt-1 font-serif text-[25px] font-bold text-ink">Growing your roadmap…</h1>
            </div>
          </div>
          <p className="mt-4 text-[13px] leading-relaxed text-ink-dim">Your roadmap is being generated progressively. You will start on the first period; later periods are already outlined and will expand when you open them.</p>
          <div className="mt-6 space-y-3">
            {generationSteps.map((item, index) => (
              <div key={item.title} className={cn("flex items-start gap-3 rounded-2xl px-3.5 py-3 transition-colors", index <= generationStep ? "bg-polaris-100/60 dark:bg-polaris-400/10" : "bg-paper-soft/60")}>
                <span className={cn("mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold ring-1 ring-inset", index < generationStep ? "bg-aurora-500 text-white ring-aurora-500" : index === generationStep ? "bg-ink text-paper ring-ink" : "text-ink-muted ring-polaris-500/15")}>{index < generationStep ? "✓" : index + 1}</span>
                <div><div className="text-[12.5px] font-semibold text-ink">{item.title}</div><div className="mt-0.5 text-[11px] text-ink-muted">{item.detail}</div></div>
              </div>
            ))}
          </div>
          <div className="mt-5 h-1.5 overflow-hidden rounded-full bg-paper-deep"><motion.div className="h-full rounded-full bg-gradient-to-r from-polaris-400 via-nova-400 to-aurora-400" animate={{ width: `${Math.min(92, 24 + generationStep * 30)}%` }} transition={{ duration: 0.5 }} /></div>
          <div className="mt-2 text-[10.5px] text-ink-muted">This can take a little longer when the AI provider is busy. Your setup is safe while it works.</div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="max-w-[680px] mx-auto px-6 py-10">
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}>
        <div className="text-[10.5px] uppercase tracking-[0.22em] text-ink-muted font-medium mb-1.5">Welcome to Polaris</div>
        <h1 className="font-serif text-[32px] leading-[1.05] font-bold tracking-tight text-ink">
          Let&apos;s build your <span className="grad-text">roadmap</span>
        </h1>
        <p className="text-[13.5px] text-ink-dim mt-2 leading-relaxed">
          Answer a few questions so Polaris can create your personalized plan -
          this is the only setup; everything else adapts from here.
        </p>

        {/* Stepper */}
        <div className="mt-6 flex items-center gap-2">
          {steps.map((s, i) => (
            <button
              key={s}
              onClick={() => i < step && setStep(i)}
              className={cn(
                "flex items-center gap-2 rounded-full px-3 py-1.5 text-[12px] font-medium ring-1 ring-inset transition-colors",
                i === step
                  ? "bg-ink text-paper ring-ink"
                  : i < step
                    ? "bg-aurora-100 text-aurora-700 ring-aurora-400/40 dark:bg-aurora-400/15 dark:text-aurora-100 cursor-pointer"
                    : "bg-paper-card text-ink-muted ring-polaris-500/15",
              )}
            >
              <span className="font-mono text-[10px]">{i + 1}</span> {s}
            </button>
          ))}
        </div>

        <AnimatePresence mode="wait">
          <motion.div
            key={step}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
            className="mt-6 app-glass rounded-2xl p-6"
          >
            {step === 0 && (
              <div className="space-y-5">
                <div>
                  <Label>Education level</Label>
                  <div className="grid sm:grid-cols-2 gap-2">
                    {EDUCATION_LEVELS.map((l) => (
                      <button
                        key={l}
                        onClick={() => setLevel(l)}
                        className={cn(
                          "rounded-xl border px-3.5 py-3 text-left transition-colors",
                          level === l
                            ? "bg-polaris-100 border-polaris-400 text-ink dark:bg-polaris-400/20 dark:border-polaris-400/60"
                            : "bg-paper-card border-polaris-200 text-ink-dim hover:border-polaris-300 dark:border-white/[0.12]",
                        )}
                      >
                        <div className="text-[13px] font-semibold">{EDUCATION_LEVEL_LABELS[l]}</div>
                        <div className="text-[11px] text-ink-muted mt-0.5">
                          {l === "early-school" ? "Exploration & foundations" :
                           l === "middle-school" ? "Excellence & early projects" :
                           l === "ssc" ? "Boards first, balanced extras" :
                           l === "hsc" ? "Full admission campaign" :
                           "Applications & final push"}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
                <Field label="Current class / year (optional)">
                  <input value={currentYear} onChange={(e) => setCurrentYear(e.target.value)} placeholder="e.g. Class 9, A2, Gap year" maxLength={40} className={inputCls} />
                </Field>
                <div>
                  <Label>Where are you studying from?</Label>
                  <div className="flex flex-wrap gap-2">
                    {COUNTRIES.map((c) => (
                      <button
                        key={c}
                        onClick={() => setCountry(c)}
                        className={cn(
                          "rounded-full px-3.5 py-1.5 text-[12.5px] font-medium ring-1 ring-inset transition-colors",
                          country === c
                            ? "bg-polaris-100 text-polaris-700 ring-polaris-300 dark:bg-polaris-400/25 dark:text-polaris-100 dark:ring-polaris-400/50"
                            : "bg-paper-card text-ink-dim ring-polaris-200 hover:ring-polaris-300 dark:ring-white/[0.15]",
                        )}
                      >
                        {c}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {step === 1 && (
              <div className="space-y-5">
                <Field label="Main goal" hint="What is this roadmap FOR?">
                  <input value={targetGoal} onChange={(e) => setTargetGoal(e.target.value)} placeholder="e.g. Get into a top US university for CS" maxLength={300} className={inputCls} />
                </Field>
                <Field label="Target universities or scholarships (optional)" hint="Separate multiple targets with commas or new lines. Polaris will match them against its verified local records.">
                  <textarea value={targetPortfolio} onChange={(e) => setTargetPortfolio(e.target.value)} placeholder="University, program, or scholarship name" maxLength={1600} rows={3} className={inputCls + " resize-y"} />
                </Field>
                <Field label="Academic target (optional)">
                  <input value={academicTarget} onChange={(e) => setAcademicTarget(e.target.value)} placeholder="e.g. GPA 5.0, 4 A*s" maxLength={120} className={inputCls} />
                </Field>
                <div className="grid sm:grid-cols-2 gap-5">
                  <div>
                    <Label>Target degree</Label>
                    <div className="flex flex-wrap gap-2">
                      {DEGREES.map((d) => (
                        <button
                          key={d.v}
                          onClick={() => setDegree(d.v)}
                          className={cn(
                            "rounded-full px-3.5 py-1.5 text-[12.5px] font-medium ring-1 ring-inset transition-colors",
                            degree === d.v
                              ? "bg-polaris-100 text-polaris-700 ring-polaris-300 dark:bg-polaris-400/25 dark:text-polaris-100 dark:ring-polaris-400/50"
                              : "bg-paper-card text-ink-dim ring-polaris-200 hover:ring-polaris-300 dark:ring-white/[0.15]",
                          )}
                        >
                          {d.label}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <Label>Dream university tier</Label>
                    <div className="flex flex-wrap gap-2">
                      {TIERS.map((t) => (
                        <button
                          key={t.v}
                          onClick={() => setTier(t.v)}
                          title={t.hint}
                          className={cn(
                            "rounded-full px-3.5 py-1.5 text-[12.5px] font-medium ring-1 ring-inset transition-colors",
                            tier === t.v
                              ? "bg-polaris-100 text-polaris-700 ring-polaris-300 dark:bg-polaris-400/25 dark:text-polaris-100 dark:ring-polaris-400/50"
                              : "bg-paper-card text-ink-dim ring-polaris-200 hover:ring-polaris-300 dark:ring-white/[0.15]",
                          )}
                        >
                          {t.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
                <div>
                  <Label>Exams in scope</Label>
                  <div className="flex flex-wrap gap-2">
                    {EXAMS.map((e) => (
                      <button
                        key={e}
                        onClick={() => toggleExam(e)}
                        className={cn(
                          "rounded-full px-3.5 py-1.5 text-[12.5px] font-medium ring-1 ring-inset transition-colors",
                          exams.includes(e)
                            ? "bg-polaris-100 text-polaris-700 ring-polaris-300 dark:bg-polaris-400/25 dark:text-polaris-100 dark:ring-polaris-400/50"
                            : "bg-paper-card text-ink-dim ring-polaris-200 hover:ring-polaris-300 dark:ring-white/[0.15]",
                        )}
                      >
                        {EXAM_LABELS[e]}
                      </button>
                    ))}
                  </div>
                  {level === "early-school" && exams.length > 0 && (
                    <p className="text-[11px] text-nova-600 dark:text-nova-200 mt-2">
                      Heads-up: at this level the plan keeps test prep playful, not heavy.
                    </p>
                  )}
                </div>
                <div className="grid sm:grid-cols-2 gap-4">
                  {exams.includes("SAT") && (
                    <Field label="Current SAT (optional)">
                      <input type="number" value={satScore} onChange={(e) => setSatScore(e.target.value)} placeholder="e.g. 1180" min={400} max={1600} className={inputCls} />
                    </Field>
                  )}
                  {(exams.includes("IELTS") || exams.includes("TOEFL")) && (
                    <Field label="Current IELTS band (optional)">
                      <input type="number" value={ieltsScore} onChange={(e) => setIeltsScore(e.target.value)} placeholder="e.g. 6.5" step={0.5} min={1} max={9} className={inputCls} />
                    </Field>
                  )}
                </div>
              </div>
            )}

            {step === 2 && (
              <div className="space-y-5">
                <div>
                  <Label>How long do you want this plan to run?</Label>
                  <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                    {DURATIONS.map((d) => (
                      <button
                        key={d.days}
                        onClick={() => setDurationDays(d.days)}
                        className={cn(
                          "rounded-xl border px-3 py-2.5 text-center transition-colors",
                          durationDays === d.days
                            ? "bg-polaris-100 border-polaris-400 text-ink dark:bg-polaris-400/20 dark:border-polaris-400/60"
                            : "bg-paper-card border-polaris-200 text-ink-dim hover:border-polaris-300 dark:border-white/[0.12]",
                        )}
                      >
                        <div className="text-[13px] font-bold">{d.label}</div>
                        <div className="text-[10px] font-mono text-ink-muted">{d.hint}</div>
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <Label>Timeline mode</Label>
                  <div className="flex flex-wrap gap-2">
                    {(["auto", "daily", "weekly", "monthly", "yearly"] as const).map((m) => (
                      <button
                        key={m}
                        onClick={() => setTimelineMode(m)}
                        className={cn(
                          "rounded-full px-3.5 py-1.5 text-[12.5px] font-medium ring-1 ring-inset capitalize transition-colors",
                          timelineMode === m
                            ? "bg-ink text-paper ring-ink"
                            : "bg-paper-card text-ink-dim ring-polaris-200 hover:ring-polaris-300 dark:ring-white/[0.15]",
                        )}
                      >
                        {m === "auto" ? `Auto (${suggestTimelineMode(durationDays)})` : m}
                      </button>
                    ))}
                  </div>
                </div>
                <Field label={`Available hours per week - ${hours}h`} hint="Be honest. The plan budgets inside this.">
                  <input
                    type="range" min={2} max={40} step={1} value={hours}
                    onChange={(e) => setHours(parseInt(e.target.value, 10))}
                    className="w-full accent-polaris-500"
                  />
                </Field>
                <Field label="Your biggest weakness right now (optional)">
                  <input value={weakAreas} onChange={(e) => setWeakAreas(e.target.value)} placeholder="e.g. SAT math word problems, essay writing, consistency" maxLength={300} className={inputCls} />
                </Field>
              </div>
            )}
          </motion.div>
        </AnimatePresence>

        {error && <div className="mt-3 text-[12.5px] text-rose-600 dark:text-rose-300">{error}</div>}

        <div className="mt-5 flex items-center justify-between">
          <button
            onClick={() => setStep((s) => Math.max(0, s - 1))}
            disabled={step === 0 || busy}
            className="text-[13px] text-ink-dim hover:text-ink px-3 py-2 transition-colors disabled:opacity-30"
          >
            ← Back
          </button>
          {step < 2 ? (
            <button
              onClick={() => setStep((s) => s + 1)}
              disabled={!canNext}
              className="rounded-full bg-ink text-paper px-5 py-2.5 text-[13px] font-semibold hover:bg-polaris-700 transition-colors disabled:opacity-40"
            >
              Continue →
            </button>
          ) : (
            <button
              onClick={submit}
              disabled={busy || !targetGoal.trim()}
              className="inline-flex items-center gap-2 rounded-full bg-ink text-paper px-5 py-2.5 text-[13px] font-semibold hover:bg-polaris-700 transition-colors disabled:opacity-60"
            >
              {busy ? (
                <>
                  <span className="h-3.5 w-3.5 rounded-full border-2 border-paper/30 border-t-paper animate-spin" />
                  Growing your tree…
                </>
              ) : (
                <>Generate my roadmap ✦</>
              )}
            </button>
          )}
        </div>
      </motion.div>
    </div>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return <div className="text-[12.5px] font-medium text-ink mb-2">{children}</div>;
}
function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <div className="text-[12.5px] font-medium text-ink mb-1">{label}</div>
      {hint && <div className="text-[11px] text-ink-muted mb-1.5">{hint}</div>}
      {children}
    </label>
  );
}
const inputCls =
  "w-full rounded-xl border border-polaris-200 bg-paper-card px-3 py-2 text-sm text-ink placeholder:text-ink-muted/60 focus:border-polaris-400 focus:outline-none transition-colors dark:border-white/[0.14] dark:bg-paper-deep";
