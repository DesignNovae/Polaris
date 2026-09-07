/**
 * Progress counters.
 *
 * Badge criteria need to know "how many timed sections has this student
 * completed", and answering that by scanning six collections on every award
 * would make the cheapest write in the app the most expensive. Instead the
 * mutation sites increment a single per-user document, and badge evaluation
 * reads that one row.
 *
 * These are monotonic tallies, not a ledger: they only ever go up, and they
 * are not the source of truth for anything a student is shown as data. Losing
 * one would cost a badge, not a record.
 */

import { getDb } from "@/lib/db/mongodb";
import { EMPTY_COUNTERS, type ProgressCounters } from "@/lib/badges/catalog";

export type DbCounters = ProgressCounters & {
  userId: string;
  updatedAt: Date;
};

export type CounterKey = keyof ProgressCounters;

async function counters() {
  const db = await getDb();
  return db.collection<DbCounters>("progress_counters");
}

/**
 * Add to one or more counters. Upserts, so a student's first action creates
 * the row. Never throws: a missed tally must not fail the work that caused it.
 */
export async function bumpCounters(
  userId: string,
  deltas: Partial<Record<CounterKey, number>>,
): Promise<void> {
  const inc: Record<string, number> = {};
  for (const [key, value] of Object.entries(deltas)) {
    if (typeof value === "number" && value !== 0) inc[key] = value;
  }
  if (Object.keys(inc).length === 0) return;

  try {
    const col = await counters();
    await col.updateOne(
      { userId },
      { $inc: inc, $set: { updatedAt: new Date() }, $setOnInsert: { userId } },
      { upsert: true },
    );
  } catch (err) {
    console.error("[counters] bump failed for", userId, err);
  }
}

/** Current tallies, with every key present so criteria never read undefined. */
export async function getCounters(userId: string): Promise<ProgressCounters> {
  try {
    const col = await counters();
    const row = await col.findOne({ userId });
    if (!row) return { ...EMPTY_COUNTERS };
    // Spread the defaults first: a counter added after this row was written
    // must read 0 rather than undefined.
    return {
      ...EMPTY_COUNTERS,
      examSections: row.examSections ?? 0,
      examsCompleted: row.examsCompleted ?? 0,
      lessonsCompleted: row.lessonsCompleted ?? 0,
      notesLogged: row.notesLogged ?? 0,
      writingSubmitted: row.writingSubmitted ?? 0,
      roadmapNodesDone: row.roadmapNodesDone ?? 0,
      evidenceLogged: row.evidenceLogged ?? 0,
      scoresLogged: row.scoresLogged ?? 0,
      replans: row.replans ?? 0,
      tasksCompleted: row.tasksCompleted ?? 0,
      deadlinesPlanned: row.deadlinesPlanned ?? 0,
      passportClaims: row.passportClaims ?? 0,
    };
  } catch (err) {
    console.error("[counters] read failed for", userId, err);
    return { ...EMPTY_COUNTERS };
  }
}
