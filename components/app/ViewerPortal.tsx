"use client";

/**
 * The linked-viewer portal.
 *
 * One screen serving parents, partners and teachers, differing only by the
 * scope the server returned. Sections render when the scope allows them and are
 * absent otherwise - and the header says which role the viewer holds, so it is
 * never ambiguous why something is missing.
 *
 * For teachers this is the whole product: evidence they can check, and the
 * dates that constrain the letter they have been asked to write.
 */

import { useCallback, useEffect, useState } from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/cn";

type Student = {
  studentId: string;
  studentName: string;
  relationship: "parent" | "partner" | "teacher";
  note?: string;
};

type View = {
  scope: {
    relationship: "parent" | "partner" | "teacher";
    evidence: boolean; deadlines: boolean; progress: boolean; academics: boolean;
  };
  studentName: string;
  evidence: {
    headline: string; summary: string;
    verified: {
      claim: string; proofType: string; proofUrl?: string;
      verifiedSignal?: string; gap?: string; verifiedAt?: string;
    }[];
    unevidencedCount: number;
    coverage: number;
  } | null;
  deadlines: {
    date: string; title: string; universityName?: string;
    priority: string; daysAway: number;
  }[];
  academics: {
    grade?: string; curriculum?: string; targetTier?: string;
    country?: string; testScores?: Record<string, number>;
  } | null;
  progress: { total: number; done: number; percent: number } | null;
};

const ROLE_COPY: Record<Student["relationship"], string> = {
  parent: "You can see academics, evidence, progress and deadlines.",
  partner: "You can see progress and deadlines.",
  teacher: "You can see the evidence behind each claim, the academic record, and upcoming deadlines - the things a recommendation rests on.",
};

export function ViewerPortal() {
  const [students, setStudents] = useState<Student[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [view, setView] = useState<View | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/monitor/view", { cache: "no-store" });
        const d = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(d.error || "Could not load your students");
        setStudents(d.students ?? []);
        if (d.students?.[0]) setActiveId(d.students[0].studentId);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Something went wrong");
      } finally {
        setBusy(false);
      }
    })();
  }, []);

  const loadView = useCallback(async (studentId: string) => {
    setBusy(true);
    setError("");
    try {
      const res = await fetch(`/api/monitor/view?studentId=${encodeURIComponent(studentId)}`, {
        cache: "no-store",
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.error || "Could not load this student");
      setView(d.view);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
      setView(null);
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => {
    if (activeId) void loadView(activeId);
  }, [activeId, loadView]);

  if (!busy && students.length === 0) {
    return (
      <div className="mx-auto max-w-2xl px-6 py-20 text-center">
        <h1 className="font-serif text-3xl font-bold text-ink">Nothing shared with you yet</h1>
        <p className="mx-auto mt-3 max-w-md text-[14.5px] leading-relaxed text-ink-dim">
          When a student invites you as a parent, partner or teacher and you
          accept, their shared view appears here.
        </p>
      </div>
    );
  }

  const active = students.find((s) => s.studentId === activeId);

  return (
    <main className="mx-auto max-w-4xl px-5 py-10 sm:px-8">
      {/* Student picker - only when there is a choice to make. */}
      {students.length > 1 && (
        <div className="mb-6 flex flex-wrap gap-2">
          {students.map((s) => (
            <button
              key={s.studentId}
              type="button"
              onClick={() => setActiveId(s.studentId)}
              className={cn(
                "rounded-full px-3.5 py-1.5 text-[13px] font-medium transition-colors",
                s.studentId === activeId
                  ? "bg-ink text-paper"
                  : "bg-paper-soft text-ink-dim hover:text-ink",
              )}
            >
              {s.studentName}
            </button>
          ))}
        </div>
      )}

      {error && <p className="mb-4 text-[13px] text-rose-600">{error}</p>}

      {view && (
        <>
          <header className="border-b border-polaris-500/12 pb-6">
            <div className="flex flex-wrap items-center gap-2.5">
              <span className="rounded-full bg-polaris-500/12 px-2.5 py-0.5 text-[10.5px] font-bold uppercase tracking-[0.14em] text-polaris-700 dark:text-polaris-300">
                {view.scope.relationship} view
              </span>
              {active?.note && (
                <span className="text-[12px] text-ink-dim">{active.note}</span>
              )}
            </div>
            <h1 className="mt-3 font-serif text-3xl font-bold text-ink sm:text-4xl">
              {view.studentName}
            </h1>
            {view.evidence?.headline && (
              <p className="mt-2 text-[15px] text-ink-dim">{view.evidence.headline}</p>
            )}
            <p className="mt-3 max-w-xl text-[12.5px] leading-relaxed text-ink-dim">
              {ROLE_COPY[view.scope.relationship]} Strategist conversations are
              never shared with anyone.
            </p>
          </header>

          {/* ── Evidence ── */}
          {view.scope.evidence && view.evidence && (
            <section className="mt-8">
              <div className="flex flex-wrap items-baseline justify-between gap-3">
                <h2 className="font-serif text-[21px] font-bold text-ink">
                  Verified claims
                </h2>
                <span className="text-[12.5px] text-ink-dim tabular-nums">
                  {view.evidence.verified.length} evidenced · {view.evidence.coverage}% coverage
                </span>
              </div>

              {view.evidence.verified.length === 0 ? (
                <p className="mt-3 text-[14px] text-ink-dim">
                  Nothing has been evidenced yet.
                </p>
              ) : (
                <ul className="mt-4 space-y-3">
                  {view.evidence.verified.map((c, i) => (
                    <motion.li
                      key={`${c.claim}-${i}`}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.35, delay: i * 0.04 }}
                      className="rounded-2xl border border-aurora-500/25 bg-aurora-500/[0.04] p-5"
                    >
                      <p className="text-[15.5px] font-semibold leading-snug text-ink">
                        {c.claim}
                      </p>
                      {c.verifiedSignal && (
                        <p className="mt-2 text-[13.5px] leading-relaxed text-ink-dim">
                          <span className="font-medium text-ink">Signal:</span> {c.verifiedSignal}
                        </p>
                      )}
                      {c.gap && (
                        <p className="mt-1.5 text-[13.5px] leading-relaxed text-ink-dim">
                          <span className="font-medium text-ink">Does not establish:</span> {c.gap}
                        </p>
                      )}
                      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[12px] text-ink-dim">
                        <span className="rounded bg-ink/[0.06] px-2 py-0.5">{c.proofType}</span>
                        {c.proofUrl && (
                          <a
                            href={c.proofUrl}
                            target="_blank"
                            rel="noopener noreferrer nofollow"
                            className="font-semibold text-polaris-700 hover:underline dark:text-polaris-300"
                          >
                            Check the artifact ↗
                          </a>
                        )}
                      </div>
                    </motion.li>
                  ))}
                </ul>
              )}

              {view.evidence.unevidencedCount > 0 && (
                <p className="mt-3 text-[12.5px] text-ink-dim">
                  {view.evidence.unevidencedCount} further claim
                  {view.evidence.unevidencedCount === 1 ? " has" : "s have"} no artifact
                  attached yet and {view.evidence.unevidencedCount === 1 ? "is" : "are"} not
                  listed above.
                </p>
              )}
            </section>
          )}

          {/* ── Academics ── */}
          {view.scope.academics && view.academics && (
            <section className="mt-10">
              <h2 className="font-serif text-[21px] font-bold text-ink">Academic record</h2>
              <dl className="mt-4 grid gap-3 sm:grid-cols-2">
                {[
                  ["Level", view.academics.grade],
                  ["Curriculum", view.academics.curriculum],
                  ["Target tier", view.academics.targetTier],
                  ["Country", view.academics.country],
                ]
                  .filter(([, v]) => Boolean(v))
                  .map(([k, v]) => (
                    <div key={k as string} className="rounded-xl bg-paper-soft p-3.5 dark:bg-white/[0.04]">
                      <dt className="text-[11px] uppercase tracking-[0.14em] text-ink-dim">{k}</dt>
                      <dd className="mt-1 text-[14px] font-semibold text-ink">{v}</dd>
                    </div>
                  ))}
                {view.academics.testScores &&
                  Object.entries(view.academics.testScores).map(([test, score]) => (
                    <div key={test} className="rounded-xl bg-paper-soft p-3.5 dark:bg-white/[0.04]">
                      <dt className="text-[11px] uppercase tracking-[0.14em] text-ink-dim">{test}</dt>
                      <dd className="mt-1 font-mono text-[14px] font-semibold text-ink tabular-nums">
                        {score}
                      </dd>
                    </div>
                  ))}
              </dl>
            </section>
          )}

          {/* ── Progress ── */}
          {view.scope.progress && view.progress && (
            <section className="mt-10">
              <h2 className="font-serif text-[21px] font-bold text-ink">Progress</h2>
              <div className="mt-3 flex items-center gap-4">
                <div className="h-2 flex-1 overflow-hidden rounded-full bg-paper-deep dark:bg-white/[0.07]">
                  <motion.div
                    className="h-full rounded-full bg-gradient-to-r from-polaris-400 to-aurora-400"
                    initial={{ width: 0 }}
                    animate={{ width: `${view.progress.percent}%` }}
                    transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
                  />
                </div>
                <span className="shrink-0 text-[13px] font-semibold text-ink tabular-nums">
                  {view.progress.done}/{view.progress.total}
                </span>
              </div>
            </section>
          )}

          {/* ── Deadlines ── */}
          {view.scope.deadlines && (
            <section className="mt-10">
              <h2 className="font-serif text-[21px] font-bold text-ink">
                What is coming up
              </h2>
              {view.deadlines.length === 0 ? (
                <p className="mt-3 text-[14px] text-ink-dim">Nothing scheduled.</p>
              ) : (
                <ul className="mt-4 divide-y divide-polaris-500/10">
                  {view.deadlines.map((d, i) => (
                    <li key={`${d.date}-${i}`} className="flex items-center gap-4 py-3">
                      <span
                        className={cn(
                          "w-14 shrink-0 text-center font-mono text-[13px] font-bold tabular-nums",
                          d.daysAway <= 7 ? "text-rose-600" : d.daysAway <= 21 ? "text-polaris-700 dark:text-polaris-300" : "text-ink-dim",
                        )}
                      >
                        {d.daysAway <= 0 ? "today" : `${d.daysAway}d`}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-[14px] font-medium text-ink">{d.title}</div>
                        {d.universityName && (
                          <div className="text-[12px] text-ink-dim">{d.universityName}</div>
                        )}
                      </div>
                      <span className="shrink-0 font-mono text-[11.5px] text-ink-dim">{d.date}</span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          )}

          <p className="mt-12 border-t border-polaris-500/12 pt-5 text-[11.5px] leading-relaxed text-ink-dim">
            Claims and artifacts are supplied by the student. Polaris records what
            was attached and when; it does not independently audit the artifact.
            This view is read-only and the student can revoke it at any time.
          </p>
        </>
      )}

      {busy && !view && (
        <p className="text-[13.5px] text-ink-dim">Loading…</p>
      )}
    </main>
  );
}
