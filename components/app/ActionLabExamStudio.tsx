"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import {
  motion,
  useMotionTemplate,
  useMotionValue,
  useReducedMotion,
  useSpring,
  useTransform,
} from "framer-motion";
import { Card, Icon, Pill } from "@/components/app/ui";
import { ExamPreflight } from "@/components/exams/ExamPreflight";
import { cn } from "@/lib/cn";
import type { ExamCatalogAttempt, ExamCatalogEntry, ExamMode } from "@/lib/exams/types";

type StudioMode = "mock" | "practice";
type CatalogResponse = { available: ExamCatalogEntry[]; recent: ExamCatalogAttempt[] };

const AIPracticeStudio = dynamic(() => import("@/components/app/GemmaStudioPanels").then((module) => module.AIPracticeStudio), {
  loading: () => <div className="grid min-h-64 place-items-center rounded-2xl border border-ink-faint/15 bg-paper-card/60 text-[11px] text-ink-muted">Opening AI Practice…</div>,
});

const LABELS: Record<ExamMode, { exam: string; title: string; tone: "polaris" | "aurora" | "nova" }> = {
  "sat-full": { exam: "SAT-style", title: "Full Adaptive SAT", tone: "polaris" },
  "sat-math-module": { exam: "SAT-style", title: "Math Module", tone: "polaris" },
  "ielts-reading": { exam: "IELTS Academic", title: "Reading", tone: "aurora" },
  "ielts-listening": { exam: "IELTS", title: "Listening", tone: "aurora" },
  "ielts-writing": { exam: "IELTS Academic", title: "Writing", tone: "nova" },
  "ielts-speaking": { exam: "IELTS", title: "Speaking", tone: "nova" },
};

type ExamCardLabel = (typeof LABELS)[ExamMode];
type ExamGlyphName = "adaptive" | "headphones" | "math" | "pen" | "reading" | "speaking";

const EXAM_VISUALS: Record<ExamMode, { glyph: ExamGlyphName; halo: string; icon: string }> = {
  "sat-full": {
    glyph: "adaptive",
    halo: "bg-polaris-400/20",
    icon: "bg-polaris-500/15 text-polaris-600 dark:text-polaris-200",
  },
  "sat-math-module": {
    glyph: "math",
    halo: "bg-polaris-300/20",
    icon: "bg-polaris-500/15 text-polaris-600 dark:text-polaris-200",
  },
  "ielts-reading": {
    glyph: "reading",
    halo: "bg-aurora-400/20",
    icon: "bg-aurora-500/15 text-aurora-700 dark:text-aurora-200",
  },
  "ielts-listening": {
    glyph: "headphones",
    halo: "bg-aurora-400/20",
    icon: "bg-aurora-500/15 text-aurora-700 dark:text-aurora-200",
  },
  "ielts-writing": {
    glyph: "pen",
    halo: "bg-nova-400/20",
    icon: "bg-nova-500/15 text-nova-700 dark:text-nova-200",
  },
  "ielts-speaking": {
    glyph: "speaking",
    halo: "bg-rose-400/20",
    icon: "bg-rose-500/15 text-rose-700 dark:text-rose-200",
  },
};

/** Any attempt whose immutable form can be replayed, abandoned ones included. */
function restartableAttempt(entry: ExamCatalogEntry) {
  return entry.latestRestartableAttempt ?? entry.latestCompletedAttempt;
}

function coverageLabel(entry: ExamCatalogEntry): string {
  if (entry.activeAttempt) return "Resume";
  if (entry.coverage.estimatedFreshForms > 0) return "Ready";
  return restartableAttempt(entry) ? "Retake" : "Unavailable";
}

function ExamChoiceCard({
  entry,
  index,
  label,
  restartable,
  usable,
  onSelect,
}: {
  entry: ExamCatalogEntry;
  index: number;
  label: ExamCardLabel;
  restartable: boolean;
  usable: boolean;
  onSelect: () => void;
}) {
  const reduceMotion = useReducedMotion();
  const cardRef = useRef<HTMLButtonElement>(null);
  const visual = EXAM_VISUALS[entry.mode];
  const pointerX = useMotionValue(0);
  const pointerY = useMotionValue(0);
  const spring = { stiffness: 190, damping: 23, mass: 0.6 };
  const smoothX = useSpring(pointerX, spring);
  const smoothY = useSpring(pointerY, spring);
  const rotateY = useTransform(smoothX, [-0.5, 0.5], [-4.5, 4.5]);
  const rotateX = useTransform(smoothY, [-0.5, 0.5], [3.8, -3.8]);
  const glareX = useTransform(smoothX, [-0.5, 0.5], [32, 68]);
  const glareY = useTransform(smoothY, [-0.5, 0.5], [28, 72]);
  const glare = useMotionTemplate`radial-gradient(circle at ${glareX}% ${glareY}%, rgba(255,255,255,0.13), transparent 36%)`;

  const onPointerMove = useCallback((event: ReactPointerEvent<HTMLButtonElement>) => {
    if (reduceMotion) return;
    const box = cardRef.current?.getBoundingClientRect();
    if (!box) return;
    pointerX.set((event.clientX - box.left) / box.width - 0.5);
    pointerY.set((event.clientY - box.top) / box.height - 0.5);
  }, [pointerX, pointerY, reduceMotion]);

  const resetPointer = useCallback(() => {
    pointerX.set(0);
    pointerY.set(0);
  }, [pointerX, pointerY]);

  const footerCopy = entry.activeAttempt
    ? "Continue where you left off"
    : restartable && entry.status !== "available"
      ? "Take this exam again"
      : "Review format and timing";
  const statusTone = entry.coverage.estimatedFreshForms > 0 ? "aurora" : restartable ? "ink" : "rose";
  const statusDot = entry.activeAttempt
    ? "bg-rose-400"
    : entry.coverage.estimatedFreshForms > 0
      ? "bg-aurora-400"
      : restartable
        ? "bg-ink-muted"
        : "bg-rose-400";

  return (
    <div className="h-full [perspective:1000px]">
      <motion.button
        ref={cardRef}
        type="button"
        disabled={!usable}
        onClick={onSelect}
        onPointerMove={onPointerMove}
        onPointerLeave={resetPointer}
        aria-label={`${label.title}. ${entry.questionCount} questions, ${entry.durationMinutes} minutes, ${entry.sections}. View details.`}
        initial={reduceMotion ? false : { opacity: 0.82, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        whileHover={reduceMotion || !usable ? undefined : { y: -6, scale: 1.008 }}
        whileTap={reduceMotion || !usable ? undefined : { scale: 0.992 }}
        transition={{ duration: 0.4, delay: reduceMotion ? 0 : Math.min(index, 5) * 0.045, ease: [0.16, 1, 0.3, 1] }}
        style={{
          rotateX: reduceMotion ? 0 : rotateX,
          rotateY: reduceMotion ? 0 : rotateY,
          transformStyle: "preserve-3d",
        }}
        className="group relative flex min-h-[258px] w-full flex-col overflow-hidden rounded-2xl bg-paper-card p-5 text-left shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_16px_44px_-30px_rgba(0,0,0,0.62)] transition-shadow duration-300 hover:shadow-[inset_0_1px_0_rgba(255,255,255,0.09),0_28px_58px_-30px_rgba(0,0,0,0.72)] disabled:cursor-not-allowed disabled:opacity-55 disabled:hover:shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_16px_44px_-30px_rgba(0,0,0,0.62)]"
      >
        <span aria-hidden className={cn("pointer-events-none absolute -right-12 -top-16 h-48 w-48 rounded-full blur-3xl transition-opacity duration-300 group-hover:opacity-100", visual.halo)} />
        {!reduceMotion && (
          <motion.span
            aria-hidden
            className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100 group-focus-visible:opacity-100"
            style={{ backgroundImage: glare }}
          />
        )}

        <span className="relative flex items-center justify-between gap-3" style={{ transform: "translateZ(18px)" }}>
          <Pill tone={label.tone} className="whitespace-nowrap text-[10px]">{label.exam}</Pill>
          <Pill tone={statusTone} className="whitespace-nowrap text-[10px]">
            <span className={cn("h-1.5 w-1.5 rounded-full", statusDot)} />
            {coverageLabel(entry)}
          </Pill>
        </span>

        <span className="relative mt-7 flex items-start justify-between gap-5" style={{ transform: "translateZ(34px)" }}>
          <span className="font-serif text-[25px] font-bold leading-[1.08] tracking-[-0.02em] text-ink">
            {label.title}
          </span>
          <span className={cn("grid h-12 w-12 shrink-0 place-items-center rounded-xl", visual.icon)}>
            <ExamGlyph name={visual.glyph} />
          </span>
        </span>

        <span className="relative mt-7 grid grid-cols-2 gap-x-5 gap-y-3 border-t border-ink-faint/15 pt-4" style={{ transform: "translateZ(22px)" }}>
          <ExamFact value={entry.questionCount} label="questions" />
          <ExamFact value={entry.durationMinutes} label="minutes" />
          <span className="col-span-2 flex min-w-0 items-baseline justify-between gap-3 border-t border-ink-faint/10 pt-3">
            <span className="text-[11.5px] font-semibold leading-tight text-ink">{entry.sections}</span>
            <span className="shrink-0 text-[9px] uppercase tracking-[0.12em] text-ink-muted">format</span>
          </span>
        </span>

        <span className="relative mt-auto flex items-end justify-between gap-4 pt-6 text-[10.5px]" style={{ transform: "translateZ(28px)" }}>
          <span className="max-w-[15ch] leading-relaxed text-ink-muted">{footerCopy}</span>
          <span className="inline-flex shrink-0 items-center gap-1.5 font-semibold text-polaris-600 transition-colors group-hover:text-ink">
            View details
            <span className="transition-transform duration-200 group-hover:translate-x-1"><Icon.arrow size={12} /></span>
          </span>
        </span>
      </motion.button>
    </div>
  );
}

function ExamFact({ value, label }: { value: number | string; label: string }) {
  return (
    <span className="min-w-0">
      <span className="block text-[17px] font-semibold leading-tight text-ink tabular-nums">
        {value}
      </span>
      <span className="mt-1 block text-[9px] uppercase tracking-[0.12em] text-ink-muted">{label}</span>
    </span>
  );
}

function ExamChoiceSkeleton() {
  return (
    <div className="min-h-[258px] rounded-2xl bg-paper-card p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_16px_44px_-30px_rgba(0,0,0,0.62)]" aria-hidden>
      <div className="flex items-center justify-between">
        <span className="h-5 w-20 animate-pulse rounded-full bg-paper-deep motion-reduce:animate-none" />
        <span className="h-5 w-14 animate-pulse rounded-full bg-paper-deep motion-reduce:animate-none" />
      </div>
      <div className="mt-8 flex items-start justify-between gap-6">
        <span className="h-14 w-2/3 animate-pulse rounded-xl bg-paper-deep motion-reduce:animate-none" />
        <span className="h-12 w-12 animate-pulse rounded-xl bg-paper-soft motion-reduce:animate-none" />
      </div>
      <div className="mt-7 flex gap-4 border-t border-ink-faint/15 pt-4">
        <span className="h-9 w-12 animate-pulse rounded-lg bg-paper-soft motion-reduce:animate-none" />
        <span className="h-9 w-12 animate-pulse rounded-lg bg-paper-soft motion-reduce:animate-none" />
        <span className="h-9 flex-1 animate-pulse rounded-lg bg-paper-soft motion-reduce:animate-none" />
      </div>
    </div>
  );
}

function ExamGlyph({ name }: { name: ExamGlyphName }) {
  if (name === "adaptive") return <Icon.bolt size={22} />;
  if (name === "reading") return <Icon.book size={22} />;
  if (name === "speaking") return <Icon.mic size={22} />;

  if (name === "math") {
    return (
      <svg aria-hidden width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
        <rect x="4" y="3" width="16" height="18" rx="2.5" />
        <path d="M8 7h8M8 12h.01M12 12h.01M16 12h.01M8 16h.01M12 16h.01M16 16h.01" />
      </svg>
    );
  }

  if (name === "headphones") {
    return (
      <svg aria-hidden width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 14v-2a8 8 0 0 1 16 0v2" />
        <path d="M4 14a2 2 0 0 1 2-2h1v8H6a2 2 0 0 1-2-2v-4zM20 14a2 2 0 0 0-2-2h-1v8h1a2 2 0 0 0 2-2v-4z" />
      </svg>
    );
  }

  return (
    <svg aria-hidden width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 20l4.2-1 10.6-10.6a2.1 2.1 0 0 0-3-3L5.2 16 4 20zM14.5 6.7l2.8 2.8M4 20h6" />
    </svg>
  );
}

export function ActionLabExamStudio({ lang }: { lang: "en" | "bn" }) {
  const [mode, setMode] = useState<StudioMode>("mock");
  const [catalog, setCatalog] = useState<CatalogResponse | null>(null);
  const [selected, setSelected] = useState<ExamMode | null>(null);
  const [error, setError] = useState("");
  const [errorStatus, setErrorStatus] = useState<number | null>(null);
  const [flaggingId, setFlaggingId] = useState<string | null>(null);
  const bn = lang === "bn";

  const loadCatalog = useCallback(async () => {
    const response = await fetch("/api/exams/catalog", { cache: "no-store" });
    const data = await response.json() as CatalogResponse & { error?: string };
    if (!response.ok) {
      setErrorStatus(response.status);
      throw new Error(data.error || "The exam catalog could not be loaded.");
    }
    setCatalog(data);
    setError("");
    setErrorStatus(null);
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("practice") === "1") setMode("practice");
  }, []);

  useEffect(() => {
    let active = true;
    loadCatalog()
      .catch((cause) => active && setError(cause instanceof Error ? cause.message : "The exam catalog could not be loaded."));
    return () => { active = false; };
  }, [loadCatalog]);

  async function toggleReviewLater(attempt: ExamCatalogAttempt) {
    setFlaggingId(attempt.id);
    try {
      const response = await fetch(`/api/exams/sessions/${attempt.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "review-later", flagged: !attempt.reviewLater }),
      });
      const body = await response.json() as { error?: string };
      if (!response.ok) {
        setErrorStatus(response.status);
        throw new Error(body.error || "The Review Later flag could not be updated.");
      }
      await loadCatalog();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The Review Later flag could not be updated.");
    } finally {
      setFlaggingId(null);
    }
  }

  const selectedEntry = catalog?.available.find((entry) => entry.mode === selected);

  return (
    <div className="space-y-5">
      <div className="grid gap-3 md:grid-cols-2">
        <button type="button" aria-pressed={mode === "mock"} onClick={() => setMode("mock")} className={cn("rounded-2xl border p-5 text-left transition", mode === "mock" ? "border-polaris-500 bg-polaris-500/[0.08] shadow-card" : "border-ink-faint/20 bg-paper-card hover:border-polaris-500/45")}>
          <Pill tone="polaris"><Icon.check size={12} /> {bn ? "সময়ভিত্তিক অনুশীলন" : "Timed practice"}</Pill>
          <h2 className="mt-3 font-serif text-[24px] font-bold text-ink">{bn ? "মক পরীক্ষা" : "Mock Exams"}</h2>
          <p className="mt-2 text-[12px] leading-relaxed text-ink-dim">{bn ? "সময়ভিত্তিক পরীক্ষা, অটোসেভ, পুনরুদ্ধার এবং জমা দেওয়ার পর বিশ্লেষণ।" : "Timed exams with autosave, recovery, and clear performance analysis after submission."}</p>
        </button>
        <button type="button" aria-pressed={mode === "practice"} onClick={() => setMode("practice")} className={cn("rounded-2xl border p-5 text-left transition", mode === "practice" ? "border-nova-500 bg-nova-500/[0.08] shadow-card" : "border-ink-faint/20 bg-paper-card hover:border-nova-500/45")}>
          <Pill tone="nova"><Icon.spark size={12} /> Polaris AI</Pill>
          <h2 className="mt-3 font-serif text-[24px] font-bold text-ink">{bn ? "AI অনুশীলন" : "AI Practice"}</h2>
          <p className="mt-2 text-[12px] leading-relaxed text-ink-dim">{bn ? "Polaris AI পরিকল্পিত পূর্ণ বিভাগের প্রশ্নসেট ধাপে ধাপে তৈরি করে, সঙ্গে রচনা প্রতিক্রিয়া দেয়।" : "Polaris AI builds full section-length practice sets in reviewed batches, with focused writing feedback."}</p>
        </button>
      </div>

      {mode === "practice" ? <AIPracticeStudio lang={lang} /> : selected && selectedEntry ? (
        <ExamPreflight mode={selected} embedded catalogEntry={selectedEntry} onClose={() => setSelected(null)} onCatalogChanged={loadCatalog} />
      ) : (
        <div>
          <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
            <div><div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-ink-muted">Exam workspace</div><h2 className="mt-1 font-serif text-[28px] font-bold text-ink">Choose an exam</h2></div>
            <Pill tone="aurora">{catalog ? `${catalog.available.length} exams` : "Loading exams…"}</Pill>
          </div>
          {error && (
            <Card className="mb-4 border border-signal-rose/25 p-4">
              <p role="alert" className="text-[11px] text-signal-rose">
                {errorStatus === 401 ? "Your session has expired. Sign in again to load your exam catalog." : error}
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                {errorStatus === 401 ? (
                  <Link href={`/signin?callbackUrl=${encodeURIComponent("/action-lab#exam")}`} className="rounded-lg bg-ink px-3 py-2 text-[11px] font-semibold text-paper">
                    Sign in again
                  </Link>
                ) : null}
                <button type="button" onClick={() => void loadCatalog().catch((cause) => setError(cause instanceof Error ? cause.message : "The exam catalog could not be loaded."))} className="rounded-lg border border-ink-faint/25 px-3 py-2 text-[11px] font-semibold text-ink-dim transition hover:border-polaris-500/40 hover:text-ink">
                  Try again
                </button>
              </div>
            </Card>
          )}
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {(catalog?.available ?? []).map((entry, index) => {
              const label = LABELS[entry.mode];
              const restartable = restartableAttempt(entry);
              const usable = entry.status === "available" || Boolean(entry.activeAttempt || restartable);
              return (
                <ExamChoiceCard
                  key={entry.mode}
                  entry={entry}
                  index={index}
                  label={label}
                  restartable={Boolean(restartable)}
                  usable={usable}
                  onSelect={() => setSelected(entry.mode)}
                />
              );
            })}
            {!catalog && !error && Array.from({ length: 6 }, (_, index) => <ExamChoiceSkeleton key={index} />)}
          </div>
          {catalog?.recent.length ? (
            <Card className="mt-4 border border-ink-faint/15 p-5">
              <div className="flex items-end justify-between gap-3">
                <div><div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-ink-muted">Recent attempts</div><h3 className="mt-1 font-serif text-[20px] font-bold text-ink">Continue or review your work</h3></div>
                <span className="text-[10px] text-ink-muted">Newest first</span>
              </div>
              <div className="mt-4 grid gap-2 md:grid-cols-2">
                {catalog.recent.map((attempt) => {
                  const label = LABELS[attempt.mode];
                  const href = attempt.status === "completed" ? `/exams/${attempt.id}/results` : `/exams/${attempt.id}`;
                  return (
                    <div
                      key={attempt.id}
                      className={cn(
                        "rounded-xl border p-3 transition",
                        attempt.reviewLater
                          ? "border-nova-500/65 bg-nova-500/[0.10] shadow-[0_8px_24px_-18px_rgba(201,119,58,0.8)]"
                          : "border-ink-faint/15 bg-bg/35 hover:border-polaris-500/35",
                      )}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <span>
                          <span className="flex flex-wrap items-center gap-2 text-[11.5px] font-semibold text-ink">
                            {label.title}
                            {attempt.reviewLater ? <Pill tone="nova"><Icon.star size={10} /> Review later</Pill> : null}
                          </span>
                          <span className="mt-0.5 block text-[9.5px] text-ink-muted">
                            {new Date(attempt.startedAt).toLocaleDateString()} · {attempt.status === "completed" ? "Completed" : "In progress"}
                          </span>
                        </span>
                        <Link href={href} className="inline-flex shrink-0 items-center gap-1 text-[10.5px] font-semibold text-polaris-600">
                          {attempt.status === "completed" ? "Review" : "Resume"}<Icon.arrow size={11} />
                        </Link>
                      </div>
                      <button
                        type="button"
                        aria-pressed={attempt.reviewLater}
                        disabled={flaggingId !== null}
                        onClick={() => void toggleReviewLater(attempt)}
                        className={cn(
                          "mt-2.5 inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[10px] font-semibold transition disabled:opacity-50",
                          attempt.reviewLater
                            ? "border-nova-500/45 bg-nova-500/15 text-nova-700 dark:text-nova-100"
                            : "border-ink-faint/20 text-ink-dim hover:border-nova-500/45 hover:text-ink",
                        )}
                      >
                        <Icon.star size={10} />
                        {flaggingId === attempt.id
                          ? "Saving…"
                          : attempt.reviewLater
                            ? "Flagged for Review"
                            : "Flag for Review"}
                      </button>
                    </div>
                  );
                })}
              </div>
            </Card>
          ) : null}
        </div>
      )}
    </div>
  );
}
