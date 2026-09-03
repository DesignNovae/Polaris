import { getDb } from "@/lib/db/mongodb";
import { listWeeklyTasks, type DbWeeklyTask } from "@/lib/db/collections";
import { getPublicExamResult } from "@/lib/exams/service";
import type { DomainResult } from "@/lib/exams/types";
import { randomBytes } from "crypto";

/**
 * Exam results rewriting the plan.
 *
 * Both halves of this already existed and never met: Exam Lab produced a
 * per-domain breakdown, and the weekly planner produced blocks. Finishing a mock
 * changed nothing about next week, so "the plan adapts as you improve" was true
 * of the roadmap engine but not of the thing a student actually does.
 *
 * Design decisions worth stating:
 *
 *   • This is deterministic. No model call - the mapping from "40% on Heart of
 *     Algebra" to "add two practice blocks" is arithmetic, and a student
 *     re-opening the same result must see the same proposal.
 *   • It proposes, it does not apply. The output is a diff the student accepts
 *     or rejects, because silently rewriting someone's week is hostile even
 *     when the rewrite is correct.
 *   • Weak is relative to the student's own average on that attempt, not an
 *     absolute threshold - otherwise a strong student sees "everything is fine"
 *     and a struggling one sees "everything is broken".
 */

/** A domain must be at least this far below the attempt average to count. */
const RELATIVE_MARGIN = 0.08;
/** ...and never proposed when the student is already this accurate. */
const STRONG_ENOUGH = 0.85;
/** Domains at or above this are candidates for freeing up time. */
const MASTERED = 0.9;
/** Never propose more than this many additions - a week has finite hours. */
const MAX_ADDITIONS = 3;

export type PlanChange =
  | {
      kind: "add";
      /** Stable id so accepting twice cannot duplicate the task. */
      id: string;
      domain: string;
      title: string;
      summary: string;
      practice: string;
      priority: "high" | "medium";
      reason: string;
    }
  | {
      kind: "deprioritise";
      /** The existing weekly task's own id. */
      taskId: string;
      title: string;
      from: "high" | "medium" | "low";
      to: "medium" | "low";
      reason: string;
    };

export type ReplanProposal = {
  sessionId: string;
  exam: string;
  accuracy: number;
  weakDomains: { domain: string; accuracy: number; delta: number }[];
  strongDomains: { domain: string; accuracy: number }[];
  changes: PlanChange[];
  /** The week the additions land in. */
  targetWeek: number;
  /** True when the attempt gives no actionable signal. */
  noop: boolean;
  rationale: string;
};

function pct(n: number): string {
  return `${Math.round(n * 100)}%`;
}

/** Domains where the student underperformed their own average on this attempt. */
function findWeak(domains: DomainResult[], average: number) {
  return domains
    .filter((d) => d.total >= 3) // too few questions to conclude anything
    .filter((d) => d.accuracy < STRONG_ENOUGH)
    .filter((d) => d.accuracy <= average - RELATIVE_MARGIN)
    .map((d) => ({ domain: d.domain, accuracy: d.accuracy, delta: average - d.accuracy }))
    .sort((a, b) => b.delta - a.delta);
}

function findStrong(domains: DomainResult[]) {
  return domains
    .filter((d) => d.total >= 3 && d.accuracy >= MASTERED)
    .map((d) => ({ domain: d.domain, accuracy: d.accuracy }))
    .sort((a, b) => b.accuracy - a.accuracy);
}

/**
 * Match an existing weekly task to a domain by name overlap.
 * Deliberately conservative: a false match would deprioritise the wrong work.
 */
function taskMatchesDomain(task: DbWeeklyTask, domain: string): boolean {
  const needle = domain.toLowerCase();
  const haystack = `${task.title} ${task.summary} ${task.category}`.toLowerCase();
  if (haystack.includes(needle)) return true;
  // Also match on the domain's distinctive words, ignoring filler.
  const words = needle.split(/\s+/).filter((w) => w.length > 4);
  return words.length > 0 && words.every((w) => haystack.includes(w));
}

export async function buildReplanProposal(
  userId: string,
  sessionId: string,
): Promise<ReplanProposal> {
  const result = await getPublicExamResult(userId, sessionId);
  const domains = result.domains ?? [];
  const average = result.accuracy;

  const weak = findWeak(domains, average).slice(0, MAX_ADDITIONS);
  const strong = findStrong(domains);

  const tasks = await listWeeklyTasks(userId);
  // Land additions in the earliest week that still has unfinished work, so the
  // change is actionable now rather than in a month.
  const openWeeks = tasks.filter((t) => t.status !== "done").map((t) => t.week);
  const targetWeek = openWeeks.length ? Math.min(...openWeeks) : 1;

  const changes: PlanChange[] = [];

  for (const w of weak) {
    changes.push({
      kind: "add",
      id: randomBytes(6).toString("hex"),
      domain: w.domain,
      title: `${w.domain} - targeted practice`,
      summary:
        `You scored ${pct(w.accuracy)} on ${w.domain}, ${Math.round(w.delta * 100)} points below ` +
        `your ${pct(average)} average on this attempt. Two focused sessions on this domain before the next mock.`,
      practice:
        `Work 20 ${w.domain} questions untimed, then 10 timed. Write down the rule you got wrong ` +
        `for each miss - the list is the revision sheet.`,
      priority: w.delta > 0.2 ? "high" : "medium",
      reason: `${pct(w.accuracy)} on ${w.domain} vs ${pct(average)} overall`,
    });
  }

  // Free up time by stepping down work on domains already mastered - but only
  // where an existing task clearly maps to one, and never below "low".
  for (const s of strong) {
    const match = tasks.find(
      (t) =>
        t.status !== "done" &&
        t.priority !== "low" &&
        taskMatchesDomain(t, s.domain),
    );
    if (!match) continue;
    changes.push({
      kind: "deprioritise",
      taskId: match.id,
      title: match.title,
      from: match.priority,
      to: match.priority === "high" ? "medium" : "low",
      reason: `${pct(s.accuracy)} on ${s.domain} - this is not where the next point comes from`,
    });
    if (changes.filter((c) => c.kind === "deprioritise").length >= 2) break;
  }

  const noop = changes.length === 0;
  const rationale = noop
    ? domains.length === 0
      ? "This attempt has no per-domain breakdown, so there is nothing specific to act on."
      : `No domain fell meaningfully below your ${pct(average)} average. The plan already matches where you are.`
    : `${weak.length} weak domain${weak.length === 1 ? "" : "s"} against a ${pct(average)} average on this attempt.`;

  return {
    sessionId,
    exam: result.exam,
    accuracy: average,
    weakDomains: weak,
    strongDomains: strong,
    changes,
    targetWeek,
    noop,
    rationale,
  };
}

/**
 * Apply the accepted subset of a proposal.
 *
 * Rebuilds the proposal server-side rather than trusting the client's copy: a
 * posted `changes` array would let anyone write arbitrary tasks into their own
 * plan with fabricated reasons attached, and the reasons are the reason this
 * feature is trustworthy.
 */
export async function applyReplanProposal(
  userId: string,
  sessionId: string,
  acceptedIds: string[],
): Promise<{ added: number; deprioritised: number }> {
  const proposal = await buildReplanProposal(userId, sessionId);
  const accepted = new Set(acceptedIds);
  const db = await getDb();
  const col = db.collection<DbWeeklyTask>("weekly_tasks");

  let added = 0;
  let deprioritised = 0;

  for (const change of proposal.changes) {
    if (change.kind === "add") {
      if (!accepted.has(change.id)) continue;
      // Idempotent: accepting the same proposal twice must not duplicate.
      const exists = await col.findOne({ userId, sourceExamChangeId: change.id });
      if (exists) continue;

      await col.insertOne({
        userId,
        week: proposal.targetWeek,
        weekTheme: `${proposal.exam} follow-up`,
        id: randomBytes(6).toString("hex"),
        title: change.title,
        summary: change.summary,
        practice: change.practice,
        category: "Exam prep",
        priority: change.priority,
        status: "pending",
        progress: 0,
        notes: [],
        // Provenance: this task came from a specific attempt, and the UI says so.
        sourceExamSessionId: sessionId,
        sourceExamChangeId: change.id,
        createdAt: new Date(),
        updatedAt: new Date(),
      } as unknown as DbWeeklyTask);
      added++;
    } else {
      if (!accepted.has(change.taskId)) continue;
      await col.updateOne(
        { userId, id: change.taskId },
        { $set: { priority: change.to, updatedAt: new Date() } },
      );
      deprioritised++;
    }
  }

  return { added, deprioritised };
}
