"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
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

/** Any attempt whose immutable form can be replayed, abandoned ones included. */
function restartableAttempt(entry: ExamCatalogEntry) {
  return entry.latestRestartableAttempt ?? entry.latestCompletedAttempt;
}

function coverageLabel(entry: ExamCatalogEntry): string {
  if (entry.activeAttempt) return "Resume";
  if (entry.coverage.estimatedFreshForms > 0) return "Ready";
  return restartableAttempt(entry) ? "Retake" : "Unavailable";
}

export function ActionLabExamStudio({ lang }: { lang: "en" | "bn" }) {
  const [mode, setMode] = useState<StudioMode>("mock");
  const [catalog, setCatalog] = useState<CatalogResponse | null>(null);
  const [selected, setSelected] = useState<ExamMode | null>(null);
  const [error, setError] = useState("");
  const bn = lang === "bn";

  const loadCatalog = useCallback(async () => {
    const response = await fetch("/api/exams/catalog", { cache: "no-store" });
    const data = await response.json() as CatalogResponse & { error?: string };
    if (!response.ok) throw new Error(data.error || "The exam catalog could not be loaded.");
    setCatalog(data);
    setError("");
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
          {error && <Card className="mb-4 border border-signal-rose/25 p-4"><p role="alert" className="text-[11px] text-signal-rose">{error}</p></Card>}
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {(catalog?.available ?? []).map((entry) => {
              const label = LABELS[entry.mode];
              const restartable = restartableAttempt(entry);
              const usable = entry.status === "available" || Boolean(entry.activeAttempt || restartable);
              return (
                <button key={entry.mode} type="button" disabled={!usable} onClick={() => setSelected(entry.mode)} className="text-left disabled:cursor-not-allowed disabled:opacity-60">
                  <Card className="group relative h-full overflow-hidden border border-ink-faint/20 p-5 transition hover:-translate-y-0.5 hover:border-polaris-500/40 hover:shadow-pop">
                    <div className="flex items-center justify-between gap-3"><Pill tone={label.tone}>{label.exam}</Pill><Pill tone={entry.coverage.estimatedFreshForms > 0 ? "aurora" : restartable ? "ink" : "rose"}>{coverageLabel(entry)}</Pill></div>
                    <h3 className="mt-4 font-serif text-[24px] font-bold text-ink">{label.title}</h3>
                    <p className="mt-2 min-h-10 text-[11.5px] leading-relaxed text-ink-dim">{entry.questionCount} questions · {entry.durationMinutes} minutes · {entry.sections}</p>
                    <div className="mt-4 flex items-center justify-between border-t border-ink-faint/15 pt-3 text-[10px] text-ink-muted">
                      <span>{entry.activeAttempt ? "Continue where you left off" : restartable && entry.status !== "available" ? "Take this exam again" : "Review format and timing"}</span>
                      <span className="inline-flex items-center gap-1 font-semibold text-polaris-600">View details <Icon.arrow size={11} /></span>
                    </div>
                  </Card>
                </button>
              );
            })}
            {!catalog && !error && Array.from({ length: 6 }, (_, index) => <div key={index} className="h-48 animate-pulse rounded-2xl border border-ink-faint/15 bg-paper-card/60" />)}
          </div>
          {catalog?.recent.length ? (
            <Card className="mt-4 border border-ink-faint/15 p-5">
              <div className="flex items-end justify-between gap-3">
                <div><div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-ink-muted">Recent attempts</div><h3 className="mt-1 font-serif text-[20px] font-bold text-ink">Continue or review your work</h3></div>
                <span className="text-[10px] text-ink-muted">Newest first</span>
              </div>
              <div className="mt-4 grid gap-2 md:grid-cols-2">
                {catalog.recent.slice(0, 4).map((attempt) => {
                  const label = LABELS[attempt.mode];
                  const href = attempt.status === "completed" ? `/exams/${attempt.id}/results` : `/exams/${attempt.id}`;
                  return (
                    <Link key={attempt.id} href={href} className="flex items-center justify-between rounded-xl border border-ink-faint/15 bg-bg/35 p-3 transition hover:border-polaris-500/35">
                      <span><span className="block text-[11.5px] font-semibold text-ink">{label.title}</span><span className="mt-0.5 block text-[9.5px] text-ink-muted">{new Date(attempt.startedAt).toLocaleDateString()} · {attempt.status === "completed" ? "Completed" : "In progress"}</span></span>
                      <span className="inline-flex items-center gap-1 text-[10.5px] font-semibold text-polaris-600">{attempt.status === "completed" ? "Review" : "Resume"}<Icon.arrow size={11} /></span>
                    </Link>
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
