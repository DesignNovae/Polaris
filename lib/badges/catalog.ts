/**
 * Evidence badges - the catalogue.
 *
 * A badge here is not a trophy. It is a claim Polaris is willing to make on a
 * student's behalf to a third party, on a page a recommender actually opens.
 * That constraint decides everything about the wording:
 *
 *   "Study Streak Champion"     - means nothing outside the app
 *   "Completed 10 timed practice exam sections"  - checkable, and worth
 *                                                  putting in front of a teacher
 *
 * So every badge states a countable fact, in the past tense, with no
 * adjectives. `claim` is the sentence that appears on the public passport;
 * `signal` says exactly what Polaris observed, and `gap` says what it does not
 * establish - the same honesty rule the passport already applies to
 * student-entered claims. A claim without its limits is marketing.
 *
 * Nothing here rewards a score. Every criterion counts work done, because a
 * badge for performing well would be worthless to a student who is still
 * improving, which is most of them.
 *
 * Pure data and pure predicates: no database, no clock. Awarding lives in
 * ./service.
 */

/** Counters the criteria read. Maintained by lib/progress/counters. */
export type ProgressCounters = {
  examSections: number;
  examsCompleted: number;
  lessonsCompleted: number;
  notesLogged: number;
  writingSubmitted: number;
  roadmapNodesDone: number;
  evidenceLogged: number;
  scoresLogged: number;
  replans: number;
  tasksCompleted: number;
  /**
   * Kept without a badge, deliberately. Planning a deadline is administration
   * rather than study, and a badge for it would point students at the cheapest
   * action in the app. The tally is still useful for product analytics.
   */
  deadlinesPlanned: number;
  /**
   * Also badge-less: `verified-claims-5` counts claims that carry a real
   * artifact, which is the harder and more meaningful number. Rewarding raw
   * claim count would reward typing.
   */
  passportClaims: number;
};

export const EMPTY_COUNTERS: ProgressCounters = {
  examSections: 0,
  examsCompleted: 0,
  lessonsCompleted: 0,
  notesLogged: 0,
  writingSubmitted: 0,
  roadmapNodesDone: 0,
  evidenceLogged: 0,
  scoresLogged: 0,
  replans: 0,
  tasksCompleted: 0,
  deadlinesPlanned: 0,
  passportClaims: 0,
};

/** Everything a criterion is allowed to see. */
export type BadgeContext = {
  counters: ProgressCounters;
  /** Longest run of consecutive active days, ever. */
  streakLongest: number;
  /** Student-entered passport claims that carry a real artifact link. */
  verifiedClaims: number;
};

/**
 * Tiers describe how much sustained work a badge represents, not rarity.
 * Deliberately not bronze/silver/gold - this page is read by adults deciding
 * whether to take a student seriously.
 */
export type BadgeTier = "foundation" | "sustained" | "distinguished";

export type BadgeDefinition = {
  id: string;
  /** Short label for the shelf. */
  title: string;
  /** The sentence that goes on the public passport. Past tense, countable. */
  claim: string;
  /** What Polaris actually observed. */
  signal: string;
  /** What this does NOT establish. Shown publicly, on purpose. */
  gap: string;
  tier: BadgeTier;
  /** How far along the student is, for the locked state. */
  progress: (ctx: BadgeContext) => { have: number; need: number };
};

/** The target a criterion counts toward, extracted so progress and the
 *  earned test can never disagree about the threshold. */
function counting(
  need: number,
  read: (ctx: BadgeContext) => number,
): BadgeDefinition["progress"] {
  return (ctx) => ({ have: Math.min(read(ctx), need), need });
}

export const BADGES: BadgeDefinition[] = [
  /* ── Exam practice ── */
  {
    id: "timed-sections-10",
    title: "Ten timed sections",
    claim: "Completed 10 practice exam sections under timed conditions",
    signal: "Ten separate sections started and submitted inside their time limit in Polaris.",
    gap: "Practice performance only. It is not an official score and does not predict one.",
    tier: "foundation",
    progress: counting(10, (c) => c.counters.examSections),
  },
  {
    id: "timed-sections-40",
    title: "Forty timed sections",
    claim: "Completed 40 practice exam sections under timed conditions",
    signal: "Forty separate timed sections submitted in Polaris, across the student's chosen exams.",
    gap: "Measures sustained practice volume, not accuracy or readiness.",
    tier: "distinguished",
    progress: counting(40, (c) => c.counters.examSections),
  },
  {
    id: "full-exams-3",
    title: "Three full papers",
    claim: "Sat 3 complete full-length practice examinations end to end",
    signal: "Three exams carried through every stage to submission, without abandoning the session.",
    gap: "Says nothing about the marks achieved.",
    tier: "sustained",
    progress: counting(3, (c) => c.counters.examsCompleted),
  },

  /* ── Consistency ── */
  {
    id: "streak-30",
    title: "Thirty days running",
    claim: "Studied on 30 consecutive days",
    signal: "Thirty unbroken days on which the student completed real planned work, recorded automatically.",
    gap: "Counts days with activity, not hours spent.",
    tier: "sustained",
    progress: counting(30, (ctx) => ctx.streakLongest),
  },
  {
    id: "streak-100",
    title: "A hundred days",
    claim: "Studied on 100 consecutive days",
    signal: "One hundred unbroken days of recorded work in Polaris.",
    gap: "Counts days with activity, not hours spent.",
    tier: "distinguished",
    progress: counting(100, (ctx) => ctx.streakLongest),
  },

  /* ── Planning and self-correction ── */
  {
    id: "roadmap-nodes-25",
    title: "Twenty-five milestones",
    claim: "Completed 25 milestones on a structured study roadmap",
    signal: "Twenty-five distinct roadmap nodes marked complete against a plan generated for this student's targets.",
    gap: "Completion is student-reported for milestones with no attached artifact.",
    tier: "sustained",
    progress: counting(25, (c) => c.counters.roadmapNodesDone),
  },
  {
    id: "evidence-15",
    title: "Fifteen pieces of evidence",
    claim: "Logged 15 pieces of evidence against a study plan",
    signal: "Fifteen separate artifacts or results attached to specific roadmap milestones.",
    gap: "Polaris records that evidence was attached; it does not audit the artifacts themselves.",
    tier: "foundation",
    progress: counting(15, (c) => c.counters.evidenceLogged),
  },
  {
    id: "replans-5",
    title: "Five course corrections",
    claim: "Revised the study plan 5 times in response to results",
    signal: "Five plan adaptations accepted after new scores or evidence changed the picture.",
    gap: "Shows responsiveness to feedback, not the quality of the resulting plan.",
    tier: "sustained",
    progress: counting(5, (c) => c.counters.replans),
  },

  /* ── Day-to-day discipline ── */
  {
    id: "tasks-50",
    title: "Fifty tasks done",
    claim: "Completed 50 planned study tasks",
    signal: "Fifty tasks from a generated study plan marked complete, one at a time, over weeks.",
    gap: "Completion is student-reported for tasks with no attached artifact.",
    tier: "sustained",
    progress: counting(50, (c) => c.counters.tasksCompleted),
  },
  {
    id: "scores-8",
    title: "Eight results tracked",
    claim: "Logged 8 practice results against a study plan",
    signal: "Eight practice results recorded and used to update the plan.",
    // Worth being explicit: this counts the habit of tracking, not the numbers
    // tracked. A student improving from a low base earns it exactly as fast.
    gap: "Counts that results were recorded, not what they were.",
    tier: "foundation",
    progress: counting(8, (c) => c.counters.scoresLogged),
  },

  /* ── Study library ── */
  {
    id: "lessons-25",
    title: "Twenty-five lessons",
    claim: "Completed 25 curated exam-preparation lessons",
    signal: "Twenty-five lessons from the Polaris library watched to completion, tracked against the student's account.",
    gap: "Records completion, not comprehension or any resulting score.",
    tier: "sustained",
    progress: counting(25, (c) => c.counters.lessonsCompleted),
  },
  {
    id: "writing-10",
    title: "Ten written responses",
    claim: "Submitted 10 timed written responses for assessment",
    signal: "Ten full-length writing tasks composed and submitted inside their time limit.",
    gap: "Counts submissions, not the quality of the writing.",
    tier: "sustained",
    progress: counting(10, (c) => c.counters.writingSubmitted),
  },
  {
    id: "notes-30",
    title: "Thirty research notes",
    claim: "Recorded 30 research notes while investigating universities and feedback",
    signal: "Thirty notes saved against universities, lessons, or coaching feedback.",
    gap: "Shows research activity, not the accuracy of what was recorded.",
    tier: "foundation",
    progress: counting(30, (c) => c.counters.notesLogged),
  },

  /* ── The record itself ── */
  {
    id: "verified-claims-5",
    title: "Five backed claims",
    claim: "Published 5 passport claims, each backed by a linked artifact",
    signal: "Five claims on this passport carry a working link to the work they describe.",
    gap: "Polaris checks that a link is present, not that the artifact is genuine.",
    tier: "foundation",
    progress: counting(5, (ctx) => ctx.verifiedClaims),
  },
];

export const BADGE_BY_ID = new Map(BADGES.map((b) => [b.id, b]));

/** True when the context satisfies a badge's threshold. */
export function isEarned(def: BadgeDefinition, ctx: BadgeContext): boolean {
  const { have, need } = def.progress(ctx);
  return have >= need;
}

/** Every badge id the context currently satisfies. */
export function earnedIds(ctx: BadgeContext): string[] {
  return BADGES.filter((def) => isEarned(def, ctx)).map((def) => def.id);
}

export const TIER_LABEL: Record<BadgeTier, string> = {
  foundation: "Foundation",
  sustained: "Sustained",
  distinguished: "Distinguished",
};

/** Ordering for display: earned first, then closest to earned. */
export const TIER_ORDER: Record<BadgeTier, number> = {
  foundation: 0,
  sustained: 1,
  distinguished: 2,
};
