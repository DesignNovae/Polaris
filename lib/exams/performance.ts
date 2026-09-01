/**
 * Read-only exam performance summaries for the Strategist.
 *
 * The Strategist advises on what to practise next; it never administers an
 * exam. This module therefore exposes results and trends only - no session
 * creation, no answer keys, no question text.
 */

import { getDb } from "@/lib/db/mongodb";
import type { DbExamResult, DomainResult, ExamMode } from "@/lib/exams/types";

const RESULTS = "exam_results";

export type ExamAttemptSummary = {
  mode: ExamMode;
  takenAt: string;
  scoreKind: DbExamResult["scoreKind"];
  correct: number;
  total: number;
  accuracy: number;
  unanswered: number;
  durationMinutes: number;
  averageSecondsPerQuestion: number;
  /** Weakest first, so the model reads the priority order directly. */
  domains: Array<{ domain: string; correct: number; total: number; accuracy: number }>;
  weakestDomains: string[];
  strongestDomains: string[];
  /** Present for writing/speaking modes. */
  writtenMetrics?: Array<{ label: string; wordCount: number; minimumWords: number; metMinimum: boolean }>;
  routes?: Array<{ section: string; route: string }>;
  /** Accuracy change vs. this student's previous attempt at the same mode. */
  accuracyDeltaFromPrevious?: number;
};

export type ExamPerformance = {
  attemptsFound: number;
  /** Latest attempt per mode, most recent first. */
  latestByMode: ExamAttemptSummary[];
  /** Weakest domains across every mode, worst first - the practice shortlist. */
  focusAreas: Array<{ mode: ExamMode; domain: string; accuracy: number; total: number }>;
  note: string;
};

function rankDomains(domains: DomainResult[]): DomainResult[] {
  // Domains with more questions are more trustworthy at equal accuracy, so a
  // tie breaks toward the larger sample rather than an arbitrary order.
  return [...domains].sort((a, b) => a.accuracy - b.accuracy || b.total - a.total);
}

function summarize(result: DbExamResult, previous?: DbExamResult): ExamAttemptSummary {
  const ranked = rankDomains(result.domains ?? []);
  const scored = ranked.filter((d) => d.total > 0);
  return {
    mode: result.mode,
    takenAt: result.createdAt.toISOString(),
    scoreKind: result.scoreKind,
    correct: result.correct,
    total: result.total,
    accuracy: result.accuracy,
    unanswered: result.unanswered,
    durationMinutes: Math.round(result.durationSeconds / 60),
    averageSecondsPerQuestion: result.averageSecondsPerQuestion,
    domains: ranked.map((d) => ({ domain: d.domain, correct: d.correct, total: d.total, accuracy: d.accuracy })),
    weakestDomains: scored.slice(0, 2).map((d) => d.domain),
    strongestDomains: scored.slice(-2).reverse().map((d) => d.domain),
    ...(result.writtenMetrics?.length
      ? {
          writtenMetrics: result.writtenMetrics.map((m) => ({
            label: m.label,
            wordCount: m.wordCount,
            minimumWords: m.minimumWords,
            metMinimum: m.metMinimum,
          })),
        }
      : {}),
    ...(result.routes?.length ? { routes: result.routes.map((r) => ({ section: r.section, route: r.route })) } : {}),
    ...(previous && result.total > 0 && previous.total > 0
      ? { accuracyDeltaFromPrevious: result.accuracy - previous.accuracy }
      : {}),
  };
}

/**
 * Latest attempt per exam mode plus a cross-mode weakness shortlist.
 *
 * Returns an explicit empty shape rather than throwing when the student has
 * not sat an exam yet, so the model can say so instead of guessing.
 */
export async function getExamPerformance(userId: string, maxModes = 6): Promise<ExamPerformance> {
  const db = await getDb();
  // Newest first, then keep the first two per mode: the latest attempt and the
  // one before it, which is all the delta needs.
  const rows = await db
    .collection<DbExamResult>(RESULTS)
    .find({ userId })
    .sort({ createdAt: -1 })
    .limit(40)
    .toArray();

  if (rows.length === 0) {
    return {
      attemptsFound: 0,
      latestByMode: [],
      focusAreas: [],
      note: "This student has not completed any Polaris mock exam yet. Recommend a diagnostic before prescribing practice.",
    };
  }

  const byMode = new Map<ExamMode, DbExamResult[]>();
  for (const row of rows) {
    const list = byMode.get(row.mode) ?? [];
    if (list.length < 2) list.push(row);
    byMode.set(row.mode, list);
  }

  const latestByMode = [...byMode.values()]
    .slice(0, maxModes)
    .map(([latest, previous]) => summarize(latest, previous))
    .sort((a, b) => b.takenAt.localeCompare(a.takenAt));

  const focusAreas = latestByMode
    .flatMap((attempt) =>
      attempt.domains
        .filter((d) => d.total > 0 && d.accuracy < 70)
        .map((d) => ({ mode: attempt.mode, domain: d.domain, accuracy: d.accuracy, total: d.total })),
    )
    .sort((a, b) => a.accuracy - b.accuracy)
    .slice(0, 5);

  return {
    attemptsFound: rows.length,
    latestByMode,
    focusAreas,
    note: focusAreas.length
      ? "Accuracy is unofficial Polaris practice, not an official score. Recommend which section to practise next; do not run the exam in chat."
      : "No domain is below 70% on the latest attempts. Recommend consolidation or a harder mode rather than remedial practice.",
  };
}
