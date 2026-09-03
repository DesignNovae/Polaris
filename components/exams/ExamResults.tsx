"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Card, Icon, Pill, Progress, RingMini } from "@/components/app/ui";
import { cn } from "@/lib/cn";
import { gemmaHeaders } from "@/lib/gemma/browser-key";
import type { PublicExamResult } from "@/lib/exams/types";
import { ExamReplanPanel } from "./ExamReplanPanel";

const SAT_MATH_DOMAINS = new Set(["Algebra", "Advanced Math", "Problem-Solving and Data Analysis", "Geometry and Trigonometry"]);

async function getResult(sessionId: string): Promise<PublicExamResult> {
  const response = await fetch(`/api/exams/sessions/${sessionId}/results`, { cache: "no-store" });
  const body = await response.json().catch(() => ({})) as PublicExamResult & { error?: string };
  if (!response.ok) throw new Error(body.error || "The result could not be loaded.");
  return body;
}

function duration(seconds: number) {
  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;
  return `${minutes}m ${remainder}s`;
}

function signed(value: number, suffix = "") {
  if (value === 0) return "No change";
  return `${value > 0 ? "+" : ""}${value}${suffix}`;
}

export function ExamResults({ sessionId }: { sessionId: string }) {
  const [result, setResult] = useState<PublicExamResult | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [coaching, setCoaching] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setResult(await getResult(sessionId));
      setError("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The result could not be loaded.");
    } finally {
      setLoading(false);
    }
  }, [sessionId]);

  useEffect(() => { void load(); }, [load]);

  if (loading) return <main className="grid h-full place-items-center"><div className="text-center"><div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-aurora-500 border-t-transparent" /><p className="mt-3 text-[12px] text-ink-muted">Building deterministic analytics…</p></div></main>;
  if (!result) return <main className="grid h-full place-items-center p-8 text-center"><div className="max-w-xl"><h1 className="font-serif text-[28px] font-bold">Result unavailable</h1><p className="mt-3 text-sm text-signal-rose">{error}</p><button onClick={() => void load()} className="mt-5 rounded-lg bg-ink px-4 py-2 text-sm text-paper">Try again</button></div></main>;

  const orderedDomains = [...result.domains].sort((a, b) => {
    const left = a.total ? a.correct / a.total : 0;
    const right = b.total ? b.correct / b.total : 0;
    return left - right || b.total - a.total;
  });
  const weakest = orderedDomains[0];
  const strongest = orderedDomains[orderedDomains.length - 1];
  const routeByMode = {
    "sat-math-module": "/exams/sat-math",
    "sat-full": "/exams/sat-full",
    "ielts-reading": "/exams/ielts-reading",
    "ielts-listening": "/exams/ielts-listening",
    "ielts-writing": "/exams/ielts-writing",
    "ielts-speaking": "/exams/ielts-speaking",
  } as const;
  const isObjective = result.scoreKind === "objective" || result.scoreKind === "mixed";
  const previous = result.previousAttempt;
  const accuracyDelta = previous && isObjective ? result.accuracy - previous.accuracy : null;
  const timeDelta = previous ? result.durationSeconds - previous.durationSeconds : null;
  const incompleteWriting = result.writtenMetrics?.find((metric) => !metric.metMinimum);
  const recommendation = weakest ? {
    title: `Strengthen ${weakest.domain}`,
    body: `You answered ${weakest.correct} of ${weakest.total} correctly here (${weakest.accuracy}%). Review those missed skills first, then return for another timed attempt.`,
  } : incompleteWriting ? {
    title: `Develop ${incompleteWriting.label}`,
    body: `Your response reached ${incompleteWriting.wordCount} words${incompleteWriting.minimumWords ? ` against the ${incompleteWriting.minimumWords}-word practice minimum` : ""}. Build a clearer plan, supporting detail, and a complete final response next.`,
  } : result.unanswered > 0 ? {
    title: "Finish every response",
    body: `${result.unanswered} prompt${result.unanswered === 1 ? " was" : "s were"} left incomplete. Use the navigator and reserve the final minutes for a completion pass.`,
  } : {
    title: "Repeat under timed conditions",
    body: "You completed the full attempt. Repeat this exam mode and compare consistency, pacing, and response quality.",
  };
  const practiceSectionByMode = {
    "sat-math-module": "Math",
    "sat-full": "Reading and Writing",
    "ielts-reading": "Reading",
    "ielts-listening": "Listening",
    "ielts-writing": "Writing",
    "ielts-speaking": "Speaking",
  } as const;
  const recommendedSkill = weakest?.domain || incompleteWriting?.label || "Timed completion";
  const recommendedSection = result.mode === "sat-full" && weakest && SAT_MATH_DOMAINS.has(weakest.domain)
    ? "Math"
    : practiceSectionByMode[result.mode];
  const supportsTargetedSet = result.mode !== "ielts-writing" && result.mode !== "ielts-speaking";
  const recommendedPracticeHref = supportsTargetedSet
    ? `/action-lab?practice=1&exam=${result.exam}&section=${encodeURIComponent(recommendedSection)}&skill=${encodeURIComponent(recommendedSkill)}&source=${result.sessionId}#exam`
    : routeByMode[result.mode];

  const requestCoaching = async () => {
    setCoaching(true);
    setError("");
    try {
      const response = await fetch(`/api/exams/sessions/${sessionId}/coach`, {
        method: "POST",
        headers: gemmaHeaders(),
      });
      const body = await response.json() as { error?: string };
      if (!response.ok) throw new Error(body.error || "Coaching could not be generated.");
      setResult((value) => value ? { ...value, coachFeedback: body as PublicExamResult["coachFeedback"] } : value);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Coaching could not be generated.");
    } finally {
      setCoaching(false);
    }
  };

  return (
    <main className="h-full overflow-y-auto">
      <div className="mx-auto max-w-6xl px-4 py-7 sm:px-6 md:py-10">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <Pill tone="aurora"><Icon.check size={11} /> Exam complete</Pill>
          <h1 className="mt-3 font-serif text-[34px] font-bold tracking-tight text-ink sm:text-[42px]">Your practice report</h1>
          <p className="mt-2 text-[12px] text-ink-muted">Unofficial Polaris practice · No official SAT score or IELTS band is calculated</p>
        </div>
        <div className="flex gap-2">
          <Link href="/action-lab#exam" className="inline-flex h-10 items-center rounded-lg border border-ink-faint/25 px-4 text-[12px] font-semibold text-ink">Back to Exam Lab</Link>
          <Link href={routeByMode[result.mode]} className="inline-flex h-10 items-center gap-2 rounded-lg bg-polaris-500 px-4 text-[12px] font-semibold text-white">New exam <Icon.arrow size={12} /></Link>
        </div>
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-[0.75fr_1.25fr]">
        <Card className="border border-aurora-500/25 bg-aurora-500/[0.05] p-6 text-center">
          <RingMini value={isObjective ? result.accuracy : 100} size={128} stroke={9} tone="aurora" label={<span className="font-serif text-[24px] font-bold text-ink">{isObjective ? `${result.correct}/${result.total}` : <Icon.check size={25} />}</span>} />
          <div className="mt-4 text-[10px] font-semibold uppercase tracking-[0.2em] text-ink-muted">{result.label}</div>
          <div className="mt-2 font-serif text-[30px] font-bold text-ink">{isObjective ? `${result.accuracy}%` : "Completed"}</div>
          <p className="mt-2 text-[11px] leading-relaxed text-ink-dim">{isObjective ? "Exact performance on this immutable Polaris form." : "Completion and language-production evidence from this practice session."} This is not an official score or band.</p>
          <div className="mt-5 grid grid-cols-2 gap-2 text-left">
            {[
              [duration(result.durationSeconds), "Time used"],
              [`${result.averageSecondsPerQuestion}s`, "Average / question"],
              [String(result.unanswered), "Unanswered"],
              [String(result.flagged), "Flagged"],
            ].map(([value, label]) => (
              <div key={label} className="rounded-xl border border-ink-faint/15 bg-paper-card/60 p-3">
                <div className="font-serif text-[18px] font-bold text-ink">{value}</div>
                <div className="mt-1 text-[9px] uppercase tracking-wider text-ink-muted">{label}</div>
              </div>
            ))}
          </div>
        </Card>

        <Card className="border border-ink-faint/20 p-6">
          <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-ink-muted">Domain analysis</div>
          <h2 className="mt-2 font-serif text-[25px] font-bold text-ink">{result.domains.length ? "Where the result came from" : "Response completion evidence"}</h2>
          {result.domains.length ? <div className="mt-5 space-y-4">
            {result.domains.map((domain) => (
              <div key={domain.domain}>
                <div className="mb-2 flex items-center justify-between gap-4">
                  <span className="text-[12px] font-semibold text-ink">{domain.domain}</span>
                  <span className="text-[10.5px] text-ink-muted">{domain.correct}/{domain.total} · {domain.accuracy}%</span>
                </div>
                <Progress value={domain.accuracy} tone={domain.accuracy >= 70 ? "aurora" : domain.accuracy >= 45 ? "nova" : "rose"} height="h-2" />
              </div>
            ))}
          </div> : <div className="mt-5 space-y-3">
            {result.writtenMetrics?.map((metric) => (
              <div key={metric.itemId} className="rounded-xl border border-ink-faint/15 bg-bg/35 p-4">
                <div className="flex items-center justify-between gap-3"><span className="text-[12px] font-semibold text-ink">{metric.label}</span><Pill tone={metric.metMinimum ? "aurora" : "nova"}>{metric.wordCount} words</Pill></div>
                <p className="mt-2 text-[10.5px] text-ink-muted">{metric.minimumWords ? `Practice minimum: ${metric.minimumWords} words` : "Transcript word count; fluency and pronunciation require human or AI review."}</p>
              </div>
            ))}
          </div>}
          {strongest && weakest && <div className="mt-6 grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl border border-aurora-500/20 bg-aurora-500/[0.06] p-4">
              <div className="text-[9.5px] font-semibold uppercase tracking-wider text-aurora-700 dark:text-aurora-100">{strongest.accuracy >= 70 ? "Strongest area" : "Relative strength"}</div>
              <div className="mt-2 text-[12px] font-semibold text-ink">{strongest.domain}</div>
              <p className="mt-1 text-[10.5px] leading-relaxed text-ink-muted">{strongest.correct}/{strongest.total} correct ({strongest.accuracy}%). {strongest.accuracy >= 70 ? "Keep this skill warm." : "This is the highest-performing assessed area, but it still needs review."}</p>
            </div>
            <div className="rounded-xl border border-nova-500/20 bg-nova-500/[0.06] p-4">
              <div className="text-[9.5px] font-semibold uppercase tracking-wider text-nova-600">Priority area</div>
              <div className="mt-2 text-[12px] font-semibold text-ink">{weakest.domain}</div>
              <p className="mt-1 text-[10.5px] leading-relaxed text-ink-muted">{weakest.total - weakest.correct} missed out of {weakest.total} ({weakest.accuracy}%). Start with these errors before taking another timed set.</p>
            </div>
          </div>}
          {result.routes?.length ? <div className="mt-5 rounded-xl border border-polaris-500/20 bg-polaris-500/[0.06] p-4">
            <div className="text-[9.5px] font-semibold uppercase tracking-wider text-polaris-600">Adaptive routes</div>
            <div className="mt-2 flex flex-wrap gap-2">{result.routes.map((route) => <Pill key={route.section} tone="polaris">{route.section}: {route.route}</Pill>)}</div>
          </div> : null}
        </Card>
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <Card className="border border-ink-faint/20 p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-ink-muted">Attempt comparison</div>
              <h2 className="mt-2 font-serif text-[24px] font-bold text-ink">Progress since your last attempt</h2>
            </div>
            {previous && <div className="mt-3 inline-flex max-w-full flex-wrap items-center gap-x-2 gap-y-1 rounded-xl border border-ink-faint/20 bg-bg/35 px-3 py-2 text-[10.5px] text-ink-muted"><span className="font-semibold text-ink-dim">Compared with previous attempt</span><time dateTime={previous.createdAt}>{new Date(previous.createdAt).toLocaleDateString()}</time></div>}
          </div>
          {previous ? (
            <div className="mt-5 grid grid-cols-1 gap-2 sm:grid-cols-3">
              <div className="rounded-xl border border-ink-faint/15 bg-bg/35 p-4">
                <div className="font-serif text-[20px] font-bold text-ink">{isObjective ? signed(accuracyDelta ?? 0, " pts") : signed(previous.unanswered - result.unanswered)}</div>
                <div className="mt-1 text-[9px] uppercase tracking-wider text-ink-muted">{isObjective ? "Accuracy" : "More completed"}</div>
              </div>
              <div className="rounded-xl border border-ink-faint/15 bg-bg/35 p-4">
                <div className="font-serif text-[20px] font-bold text-ink">{timeDelta === 0 ? "Same" : `${duration(Math.abs(timeDelta ?? 0))} ${Number(timeDelta) < 0 ? "faster" : "longer"}`}</div>
                <div className="mt-1 text-[9px] uppercase tracking-wider text-ink-muted">Pacing</div>
              </div>
              <div className="rounded-xl border border-ink-faint/15 bg-bg/35 p-4">
                <div className="font-serif text-[20px] font-bold text-ink">{signed(previous.unanswered - result.unanswered)}</div>
                <div className="mt-1 text-[9px] uppercase tracking-wider text-ink-muted">More answered</div>
              </div>
            </div>
          ) : (
            <div className="mt-5 rounded-xl border border-dashed border-ink-faint/25 bg-bg/25 p-5">
              <div className="text-[12px] font-semibold text-ink">This is your first completed attempt in this exam mode.</div>
              <p className="mt-2 text-[11px] leading-relaxed text-ink-muted">Your next report will compare accuracy or completion, pacing, and unanswered prompts against this result.</p>
            </div>
          )}
        </Card>

        <Card className="border border-nova-500/25 bg-nova-500/[0.05] p-6">
          <div className="flex h-full flex-col">
            <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-nova-600">Recommended next practice</div>
            <h2 className="mt-2 font-serif text-[24px] font-bold text-ink">{recommendation.title}</h2>
            <p className="mt-3 flex-1 text-[11.5px] leading-relaxed text-ink-dim">{recommendation.body}</p>
            <div className="mt-5 flex flex-wrap items-center gap-3">
              <Link href={recommendedPracticeHref} className="inline-flex h-10 items-center gap-2 rounded-lg bg-polaris-500 px-4 text-[12px] font-semibold text-white">{supportsTargetedSet ? "Build targeted practice" : "Open focused practice"} <Icon.arrow size={12} /></Link>
              {weakest && <Pill tone="nova">Based on this attempt</Pill>}
            </div>
          </div>
        </Card>
      </div>

      <Card className="mt-6 border border-polaris-500/20 bg-polaris-500/[0.05] p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-polaris-600">Post-exam coaching</div>
            <h2 className="mt-2 font-serif text-[24px] font-bold text-ink">Turn this result into the next practice move</h2>
            <p className="mt-2 max-w-3xl text-[11.5px] leading-relaxed text-ink-dim">Gemma appears only after the deterministic exam is complete. If it is unavailable, Polaris still provides evidence-based fallback guidance.</p>
          </div>
          {!result.coachFeedback && <button type="button" onClick={() => void requestCoaching()} disabled={coaching} className="h-10 shrink-0 rounded-lg bg-polaris-500 px-4 text-[12px] font-semibold text-white disabled:opacity-60">{coaching ? "Reviewing evidence…" : "Get AI coaching"}</button>}
        </div>
        {result.coachFeedback && <div className="mt-5 border-t border-polaris-500/15 pt-5">
          <div className="flex flex-wrap items-center gap-2"><Pill tone={result.coachFeedback.source === "gemma-4" ? "polaris" : "ink"}>{result.coachFeedback.source === "gemma-4" ? "Gemma 4" : "Deterministic guidance"}</Pill><span className="text-[10px] text-ink-muted">{result.coachFeedback.model}</span></div>
          <p className="mt-3 text-[12.5px] leading-relaxed text-ink">{result.coachFeedback.summary}</p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl border border-aurora-500/20 bg-aurora-500/[0.06] p-4"><div className="text-[10px] font-semibold uppercase tracking-wider text-aurora-700">Strengths</div><ul className="mt-2 space-y-1 text-[11px] text-ink-dim">{result.coachFeedback.strengths.map((value) => <li key={value}>• {value}</li>)}</ul></div>
            <div className="rounded-xl border border-nova-500/20 bg-nova-500/[0.06] p-4"><div className="text-[10px] font-semibold uppercase tracking-wider text-nova-600">Priorities</div><ul className="mt-2 space-y-1 text-[11px] text-ink-dim">{result.coachFeedback.priorities.map((value) => <li key={value}>• {value}</li>)}</ul></div>
          </div>
          <p className="mt-4 rounded-xl border border-ink-faint/15 bg-bg/35 p-4 text-[11.5px] leading-relaxed text-ink-dim"><span className="font-semibold text-ink">Next practice:</span> {result.coachFeedback.nextPractice}</p>
        </div>}
        {error && <p role="alert" className="mt-3 text-[11px] text-signal-rose">{error}</p>}
      </Card>

      {/* The result is only useful if it changes what happens next week. */}
      <div className="mt-6">
        <ExamReplanPanel sessionId={sessionId} />
      </div>

      <section className="mt-6">
        <div className="mb-4">
          <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-ink-muted">Answer review</div>
          <h2 className="mt-1 font-serif text-[27px] font-bold text-ink">Question-by-question evidence</h2>
        </div>
        <div className="space-y-3">
          {result.review.map((item) => (
            <details key={item.itemId} className={cn("group overflow-hidden rounded-2xl border bg-paper-card transition-colors", item.correct === undefined ? "border-ink-faint/20" : item.correct ? "border-aurora-500/20" : "border-signal-rose/20")}>
              <summary className="cursor-pointer list-none p-4 sm:p-5">
                <div className="flex items-start gap-3">
                  <span className={cn("grid h-7 w-7 shrink-0 place-items-center rounded-full text-[11px] font-bold text-white", item.correct === undefined ? "bg-polaris-500" : item.correct ? "bg-aurora-500" : "bg-signal-rose")}>{item.correct === undefined ? "•" : item.correct ? "✓" : "×"}</span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2"><span className="text-[12px] font-semibold text-ink">Question {item.number}</span><Pill tone="ink">{item.domain}</Pill><span className={cn("text-[10px] font-semibold", item.correct === undefined ? "text-polaris-600" : item.correct ? "text-aurora-700" : "text-signal-rose")}>{item.correct === undefined ? "Not scored" : item.correct ? "Correct" : "Needs review"}</span></div>
                    <p className="mt-1 line-clamp-2 text-[11px] leading-relaxed text-ink-dim">{item.prompt}</p>
                  </div>
                  <span className="mt-1 shrink-0 text-ink-muted transition-transform group-open:rotate-180"><Icon.chevDown size={13} /></span>
                </div>
              </summary>
              <div className="border-t border-ink-faint/15 px-4 pb-5 pt-4 sm:px-5 sm:pb-6 sm:pl-16">
                <div className="rounded-xl border border-ink-faint/15 bg-bg/35 p-4">
                  <div className="text-[9.5px] font-semibold uppercase tracking-[0.16em] text-ink-muted">Question</div>
                  <p className="mt-2 text-[12px] leading-relaxed text-ink">{item.prompt}</p>
                </div>
                <div className={cn("grid gap-3", item.correctAnswer && "sm:grid-cols-2")}>
                  <div className="mt-3 rounded-xl border border-ink-faint/15 bg-bg/45 p-3.5 text-[11px]"><div className="text-[9.5px] font-semibold uppercase tracking-wider text-ink-muted">Your answer</div><div className="mt-1.5 text-ink-dim">{item.submittedAnswer || "Blank"}</div></div>
                  {item.correctAnswer && <div className="mt-3 rounded-xl border border-aurora-500/20 bg-aurora-500/[0.07] p-3.5 text-[11px]"><div className="text-[9.5px] font-semibold uppercase tracking-wider text-aurora-700 dark:text-aurora-100">Correct answer</div><div className="mt-1.5 text-ink-dim">{item.correctAnswer}</div></div>}
                </div>
                <p className="mt-3 text-[11.5px] leading-relaxed text-ink-dim"><span className="font-semibold text-ink">Why:</span> {item.explanation}</p>
                {result.mode === "ielts-speaking" && item.hasRecording && <audio className="mt-4 w-full" controls preload="metadata" src={`/api/exams/sessions/${sessionId}/recording?itemId=${item.itemId}`} />}
              </div>
            </details>
          ))}
        </div>
      </section>
      </div>
    </main>
  );
}
