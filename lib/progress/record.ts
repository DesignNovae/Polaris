/**
 * One call for "the student did something real".
 *
 * Progress now feeds four systems - the day streak, effort points, the badge
 * counters, and badge evaluation - and wiring them separately at every call
 * site is how they drift apart. The streak already proved that: it shipped
 * connected to two routes while its own documentation claimed five, so sitting
 * a three-hour mock exam counted for nothing while nudging a deadline counted
 * for a day.
 *
 * So there is exactly one function, it takes a named event, and the event
 * table below is the only place that decides what an event is worth. Adding a
 * surface means adding an event here, which forces the decision to be made
 * once, visibly, instead of six times by accident.
 *
 * Ordering matters: counters and the streak are written before badges are
 * evaluated, so a badge that trips on this very action is awarded on this
 * call rather than the next one.
 *
 * Nothing here throws. A points or badge failure must never fail the work that
 * earned it.
 */

import { recordStreakActivity } from "@/lib/streak/service";
import { awardXp } from "@/lib/xp/service";
import { bumpCounters, type CounterKey } from "./counters";
import { evaluateBadges } from "@/lib/badges/service";
import type { BadgeDefinition } from "@/lib/badges/catalog";
import type { XpSource } from "@/lib/xp/rules";

/** Every event that counts as progress. Keys match the XP weight table. */
export type ProgressEvent = XpSource;

type EventSpec = {
  /** Shown in the streak widget's "what earned today". */
  label: string;
  /** Tallies to advance, for badge criteria. */
  counters?: Partial<Record<CounterKey, number>>;
};

const EVENTS: Record<ProgressEvent, EventSpec> = {
  "deadline-planned": {
    label: "Planned a deadline",
    counters: { deadlinesPlanned: 1 },
  },
  "deadline-updated": { label: "Updated a deadline" },

  "task-progress": { label: "Worked on a task" },
  "task-done": { label: "Completed a task", counters: { tasksCompleted: 1 } },

  "weekly-task-progress": { label: "Worked on a weekly task" },
  "weekly-task-done": {
    label: "Completed a weekly task",
    counters: { tasksCompleted: 1 },
  },

  "passport-updated": { label: "Updated the passport" },
  "passport-claim": {
    label: "Added a passport claim",
    counters: { passportClaims: 1 },
  },

  "roadmap-evidence": {
    label: "Added roadmap evidence",
    counters: { evidenceLogged: 1 },
  },
  "roadmap-score": { label: "Logged a score", counters: { scoresLogged: 1 } },
  "roadmap-node-done": {
    label: "Completed a roadmap node",
    counters: { roadmapNodesDone: 1 },
  },
  "roadmap-replan": {
    label: "Replanned the roadmap",
    counters: { replans: 1 },
  },

  "exam-replan": {
    label: "Replanned after an exam",
    counters: { replans: 1 },
  },
  // Sitting the paper earns; the mark on it never does.
  "exam-section": {
    label: "Completed a timed exam section",
    counters: { examSections: 1 },
  },
  "exam-complete": {
    label: "Completed a practice exam",
    counters: { examsCompleted: 1 },
  },

  /* ── Learning library ── */
  "lesson-progress": { label: "Worked through a lesson" },
  "lesson-complete": {
    label: "Finished a lesson",
    counters: { lessonsCompleted: 1 },
  },

  /* ── Planning surfaces ── */
  "milestone-progress": { label: "Moved a milestone forward" },
  "milestone-done": {
    label: "Completed a milestone",
    counters: { roadmapNodesDone: 1 },
  },
  "schedule-built": { label: "Scheduled study blocks" },
  "week-replanned": { label: "Replanned the week", counters: { replans: 1 } },
  "roadmap-generated": { label: "Generated a roadmap" },

  /* ── Research and record-keeping ── */
  "note-saved": { label: "Saved a note", counters: { notesLogged: 1 } },
  "writing-submitted": {
    label: "Submitted a writing task",
    counters: { writingSubmitted: 1 },
  },
  "booking-made": { label: "Booked a consultant session" },
};

export type ProgressResult = {
  /** Points that landed after the daily cap. Zero once the day is full. */
  granted: number;
  /** The day's running total. */
  dayTotal: number;
  /** Badges this action earned, for the caller to celebrate. */
  newBadges: BadgeDefinition[];
};

const NOTHING: ProgressResult = { granted: 0, dayTotal: 0, newBadges: [] };

/**
 * Record one unit of real student work.
 *
 * Call it after the mutation has succeeded, never before: a student whose save
 * failed should not be told they earned something.
 */
export async function recordProgress(
  userId: string,
  event: ProgressEvent,
): Promise<ProgressResult> {
  const spec = EVENTS[event];
  if (!spec) {
    console.error("[progress] unknown event", event);
    return NOTHING;
  }

  try {
    // Streak and counters first, so a badge tripped by this action - a
    // thirtieth consecutive day, a tenth timed section - is awarded now.
    const [, award] = await Promise.all([
      recordStreakActivity(userId, spec.label),
      awardXp(userId, event),
      spec.counters ? bumpCounters(userId, spec.counters) : Promise.resolve(),
    ]);

    const newBadges = await evaluateBadges(userId);
    return { granted: award.granted, dayTotal: award.dayTotal, newBadges };
  } catch (err) {
    console.error("[progress] record failed for", userId, event, err);
    return NOTHING;
  }
}

/** The event table, for tests and for the settings surface that explains it. */
export function progressEventLabel(event: ProgressEvent): string {
  return EVENTS[event]?.label ?? event;
}

export const PROGRESS_EVENTS = Object.keys(EVENTS) as ProgressEvent[];
