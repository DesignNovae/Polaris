"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Card, Icon, Pill } from "@/components/app/ui";
import { cn } from "@/lib/cn";
import type { ExamCatalogEntry, ExamMode, ExamStartPolicy } from "@/lib/exams/types";

type PreflightConfig = {
  mode: ExamMode;
  eyebrow: string;
  title: string;
  description: string;
  duration: string;
  questions: string;
  sections: string;
  details: Array<[string, string]>;
  note: string;
};

export const EXAM_PREFLIGHTS: Record<ExamMode, PreflightConfig> = {
  "sat-math-module": {
    mode: "sat-math-module", eyebrow: "SAT-style Math", title: "Math Module Practice",
    description: "A timed Polaris practice exam with 22 original questions. It does not produce a College Board score.",
    duration: "35 min", questions: "22", sections: "1 module",
    details: [["Navigation", "Move freely and flag questions inside the module."], ["Scoring", "Exact accuracy and four-domain analysis."], ["Recovery", "Every answer is saved to your authenticated session."]],
    note: "Set aside the full 35 minutes. The server timer starts when the immutable exam form is created.",
  },
  "sat-full": {
    mode: "sat-full", eyebrow: "Adaptive SAT-style", title: "Full Adaptive SAT-Style Mock",
    description: "A complete unofficial digital SAT-style exam. Module 1 performance selects a standard or advanced Module 2 separately for Reading and Writing and Math.",
    duration: "2h 24m", questions: "98", sections: "4 modules + break",
    details: [["Reading and Writing", "Two 32-minute modules with 27 questions each."], ["Break", "A timed 10-minute break between sections."], ["Math", "Two 35-minute modules with 22 questions each."]],
    note: "You cannot return to a completed module. Routing is based only on your Module 1 accuracy and is shown in the final practice report.",
  },
  "ielts-reading": {
    mode: "ielts-reading", eyebrow: "IELTS Academic", title: "Reading Practice",
    description: "Three original academic passages with 40 questions in a persistent side-by-side workspace.",
    duration: "60 min", questions: "40", sections: "3 passages",
    details: [["Workspace", "Keep the relevant passage visible beside each question."], ["Question types", "True, False, and Not Given statements."], ["Results", "Exact answer review grouped by reading skill."]],
    note: "This is unofficial Polaris practice and does not calculate an official IELTS band.",
  },
  "ielts-listening": {
    mode: "ielts-listening", eyebrow: "IELTS", title: "Listening Practice",
    description: "Four original recordings and 40 questions covering everyday and academic communication.",
    duration: "40 min", questions: "40", sections: "4 parts",
    details: [["Audio", "Each part uses an immutable Polaris recording."], ["Autosave", "Short answers save as you move through the test."], ["Review", "Transcripts remain hidden until submission."]],
    note: "Use headphones and test your device volume before starting. This practice is not an official IELTS test.",
  },
  "ielts-writing": {
    mode: "ielts-writing", eyebrow: "IELTS Academic", title: "Writing Practice",
    description: "Complete Academic Task 1 and Task 2 in one timed workspace with autosaved drafts and live word counts.",
    duration: "60 min", questions: "2 tasks", sections: "Task 1 + Task 2",
    details: [["Task 1", "Summarise original visual information in at least 150 words."], ["Task 2", "Develop and support a position in at least 250 words."], ["Feedback", "Transparent completion metrics; no fabricated official band."]],
    note: "Suggested allocation: 20 minutes for Task 1 and 40 minutes for Task 2.",
  },
  "ielts-speaking": {
    mode: "ielts-speaking", eyebrow: "IELTS", title: "Speaking Practice",
    description: "Record all three speaking parts, add or edit a transcript, and replay your saved response after submission.",
    duration: "14 min", questions: "3 parts", sections: "Interview + long turn + discussion",
    details: [["Part 1", "Short personal and study questions."], ["Part 2", "One-minute preparation followed by a long turn."], ["Part 3", "A more abstract discussion related to Part 2."]],
    note: "Your browser will request microphone permission. Recordings are private to your authenticated account; transcript-only practice remains available if recording is unsupported or denied.",
  },
};

export function ExamPreflight({
  mode = "sat-math-module",
  embedded = false,
  catalogEntry,
  onClose,
  onCatalogChanged,
}: {
  mode?: ExamMode;
  embedded?: boolean;
  catalogEntry?: ExamCatalogEntry;
  onClose?: () => void;
  onCatalogChanged?: () => void | Promise<void>;
}) {
  const router = useRouter();
  const config = EXAM_PREFLIGHTS[mode];
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [standaloneEntry, setStandaloneEntry] = useState<ExamCatalogEntry | undefined>();
  const [catalogLoading, setCatalogLoading] = useState(!embedded && !catalogEntry);
  const [confirmRestart, setConfirmRestart] = useState(false);

  useEffect(() => {
    if (embedded || catalogEntry) return;
    let active = true;
    void fetch("/api/exams/catalog", { cache: "no-store" })
      .then(async (response) => {
        const body = await response.json() as { available?: ExamCatalogEntry[]; error?: string };
        if (!response.ok) throw new Error(body.error || "Exam availability could not be loaded.");
        if (active) setStandaloneEntry(body.available?.find((entry) => entry.mode === mode));
      })
      .catch((cause) => {
        if (active) setError(cause instanceof Error ? cause.message : "Exam availability could not be loaded.");
      })
      .finally(() => {
        if (active) setCatalogLoading(false);
      });
    return () => { active = false; };
  }, [catalogEntry, embedded, mode]);

  const start = async (policy: ExamStartPolicy, sourceSessionId?: string) => {
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/exams/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode, policy, sourceSessionId }),
      });
      const data = await response.json() as { id?: string; error?: string };
      if (!response.ok || !data.id) throw new Error(data.error || "The exam could not be started.");
      router.push(`/exams/${data.id}`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The exam could not be started.");
      setBusy(false);
    }
  };

  const abandon = async (startOver: boolean) => {
    if (!active) return;
    setBusy(true);
    setError("");
    try {
      const response = await fetch(`/api/exams/sessions/${active.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "abandon" }),
      });
      const data = await response.json() as { error?: string };
      if (!response.ok) throw new Error(data.error || "The active attempt could not be closed.");
      await onCatalogChanged?.();
      if (startOver) {
        const next = await fetch("/api/exams/sessions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ mode, policy: "same-form", sourceSessionId: active.id }),
        });
        const created = await next.json() as { id?: string; error?: string };
        if (!next.ok || !created.id) throw new Error(created.error || "The exam could not be restarted.");
        router.push(`/exams/${created.id}`);
        return;
      }
      setConfirmRestart(false);
      onClose?.();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The active attempt could not be closed.");
      setBusy(false);
    }
  };

  const resolvedEntry = catalogEntry ?? standaloneEntry;
  const freshAvailable = Boolean(resolvedEntry?.coverage.estimatedFreshForms);
  const active = resolvedEntry?.activeAttempt;
  const completed = resolvedEntry?.latestCompletedAttempt;
  // Falls back to an abandoned attempt so a mode whose bank is exhausted is
  // never a dead end.
  const restartable = resolvedEntry?.latestRestartableAttempt ?? completed;
  const Root = embedded ? "section" : "main";
  const Heading = embedded ? "h2" : "h1";

  return (
    <Root className={cn("mx-auto max-w-5xl", embedded ? "py-1" : "h-full overflow-y-auto px-4 py-8 sm:px-6 md:py-12")}>
      {embedded && (
        <div className="mb-3 flex items-center justify-between">
          <button type="button" onClick={onClose} className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-ink-dim hover:text-ink">
            <span aria-hidden>←</span> All exams
          </button>
          <Pill tone={active || freshAvailable || restartable ? "aurora" : "rose"}>
            {active ? "Continue available" : freshAvailable ? "Ready to start" : restartable ? "Retake available" : "Currently unavailable"}
          </Pill>
        </div>
      )}
      <div className="grid gap-5 lg:grid-cols-[1.15fr_0.85fr]">
        <Card className="relative overflow-hidden border border-polaris-500/25 p-6 sm:p-8">
          <div className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-polaris-500/15 blur-3xl" />
          <div className="relative">
            <div className="flex flex-wrap items-center gap-2"><Pill tone="polaris">{config.eyebrow}</Pill><Pill tone={active || freshAvailable || restartable ? "aurora" : catalogLoading ? "ink" : "rose"}>{catalogLoading ? "Checking availability" : active ? "Continue" : freshAvailable ? "Ready" : restartable ? "Retake" : "Unavailable"}</Pill></div>
            <Heading className="mt-5 max-w-2xl font-serif text-[34px] font-bold leading-[1.05] tracking-tight text-ink sm:text-[43px]">{config.title}</Heading>
            <p className="mt-4 max-w-2xl text-[13px] leading-relaxed text-ink-dim">{config.description}</p>
            <div className="mt-7 grid grid-cols-2 gap-2 sm:grid-cols-3">
              {[[config.duration, "duration"], [config.questions, "questions"], [config.sections, "structure"]].map(([value, label], index) => (
                <div key={label} className={cn("rounded-xl border border-ink-faint/20 bg-bg/40 p-3", index === 2 && "col-span-2 sm:col-span-1")}>
                  <div className="font-serif text-[20px] font-bold text-ink">{value}</div>
                  <div className="mt-1 text-[9px] uppercase tracking-wider text-ink-muted">{label}</div>
                </div>
              ))}
            </div>
            <div className="mt-7 flex flex-wrap gap-2">
              {catalogLoading && <div className="inline-flex h-12 items-center gap-2 rounded-lg border border-ink-faint/20 px-5 text-[12px] text-ink-muted"><span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-polaris-500 border-t-transparent" /> Checking your attempts…</div>}
              {active && (
                <>
                  <button type="button" onClick={() => void start("resume")} disabled={busy} className="inline-flex h-12 items-center justify-center gap-2 rounded-lg bg-polaris-500 px-6 text-[13px] font-semibold text-white transition hover:bg-polaris-600 disabled:opacity-60">
                    {busy ? "Opening attempt…" : "Resume active attempt"} {!busy && <Icon.arrow size={14} />}
                  </button>
                  <button type="button" onClick={() => setConfirmRestart(true)} disabled={busy} className="inline-flex h-12 items-center justify-center rounded-lg border border-ink-faint/25 px-5 text-[12px] font-semibold text-ink-dim transition hover:bg-paper-deep disabled:opacity-60">Start over</button>
                  <button type="button" onClick={() => void abandon(false)} disabled={busy} className="inline-flex h-12 items-center justify-center px-3 text-[11px] font-semibold text-ink-muted transition hover:text-signal-rose disabled:opacity-60">Abandon and choose another exam</button>
                </>
              )}
              {!active && freshAvailable && (
                <button type="button" onClick={() => void start("fresh")} disabled={busy} className="inline-flex h-12 items-center justify-center gap-2 rounded-lg bg-polaris-500 px-6 text-[13px] font-semibold text-white transition hover:bg-polaris-600 disabled:opacity-60">
                  {busy ? "Preparing exam…" : "Start exam"} {!busy && <Icon.arrow size={14} />}
                </button>
              )}
              {!active && !freshAvailable && restartable && (
                <button type="button" onClick={() => void start("same-form", restartable.id)} disabled={busy} className="inline-flex h-12 items-center justify-center gap-2 rounded-lg bg-polaris-500 px-6 text-[13px] font-semibold text-white transition hover:bg-polaris-600 disabled:opacity-60">
                  {busy ? "Preparing retake…" : "Retake exam"} {!busy && <Icon.arrow size={14} />}
                </button>
              )}
              {completed?.resultId && (
                <Link href={`/exams/${completed.id}/results`} className="inline-flex h-12 items-center justify-center rounded-lg border border-ink-faint/25 px-5 text-[12px] font-semibold text-ink-dim hover:bg-paper-deep">
                  Review last result
                </Link>
              )}
            </div>
            {active && confirmRestart && (
              <div className="mt-4 rounded-xl border border-nova-500/25 bg-nova-500/[0.06] p-4">
                <p className="text-[11.5px] font-semibold text-ink">Start this exam over from question one?</p>
                <p className="mt-1 text-[10.5px] leading-relaxed text-ink-muted">Your current answers will remain in history as an abandoned attempt. The same immutable form restarts with a clean timer and blank answers.</p>
                <div className="mt-3 flex gap-2"><button type="button" disabled={busy} onClick={() => void abandon(true)} className="rounded-lg bg-polaris-500 px-4 py-2 text-[11px] font-semibold text-white disabled:opacity-60">{busy ? "Starting over…" : "Yes, restart exam"}</button><button type="button" disabled={busy} onClick={() => setConfirmRestart(false)} className="rounded-lg border border-ink-faint/20 px-4 py-2 text-[11px] font-semibold text-ink-dim">Keep current attempt</button></div>
              </div>
            )}
            {!active && !freshAvailable && !restartable && (
              <p className="mt-5 rounded-xl border border-signal-rose/25 bg-signal-rose/[0.06] p-3 text-[11px] leading-relaxed text-ink-dim">
                This exam is not available right now. Please choose another exam or return later.
              </p>
            )}
            {error && <p role="alert" className="mt-3 text-[11px] text-signal-rose">{error}</p>}
          </div>
        </Card>
        <div className="space-y-4">
          <Card className="border border-polaris-500/20 bg-polaris-500/[0.04] p-5">
            <div className="flex items-center justify-between gap-3"><div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-ink-muted">Difficulty profile</div><Pill tone="polaris">Exam-standard</Pill></div>
            <p className="mt-2 text-[11px] leading-relaxed text-ink-dim">Mock exams preserve their real section blueprint, including its intended mix of easier and harder items. Choose Foundation, Medium, or Advanced in AI Practice when you want a controlled difficulty set.</p>
          </Card>
          <Card className="border border-ink-faint/20 p-5">
            <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-ink-muted">What to expect</div>
            <div className="mt-4 space-y-3">
              {config.details.map(([title, detail]) => (
                <div key={title} className="rounded-xl border border-ink-faint/15 bg-bg/35 p-3.5">
                  <div className="text-[12px] font-semibold text-ink">{title}</div>
                  <p className="mt-1 text-[10.5px] leading-relaxed text-ink-muted">{detail}</p>
                </div>
              ))}
            </div>
          </Card>
          <Card className="border border-nova-500/20 bg-nova-500/[0.05] p-5">
            <div className="text-[11px] font-semibold text-nova-600">Before you start</div>
            <p className="mt-2 text-[11.5px] leading-relaxed text-ink-dim">{config.note}</p>
          </Card>
        </div>
      </div>
    </Root>
  );
}
