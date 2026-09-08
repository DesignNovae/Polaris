/**
 * Seed data for the three surfaces added to the workspace nav.
 *
 * The public demo has no database, so each of these stands in for what a real
 * account would compute. They are shaped exactly like the live payloads so the
 * same components render both, and the figures are plausible rather than
 * flattering - a demo that shows a perfect student teaches nothing.
 */

import type { PassportClaim } from "@/lib/passport/service";

/* ── Passport ── */

const claim = (
  c: Omit<PassportClaim, "addedAt" | "verifiedAt"> & { daysAgo: number },
) => {
  const { daysAgo, ...rest } = c;
  const at = new Date(Date.now() - daysAgo * 86_400_000).toISOString();
  return { ...rest, addedAt: at, verifiedAt: rest.status === "verified" ? at : undefined };
};

export const DEMO_PASSPORT = {
  slug: "priya-sharma-demo",
  published: true,
  displayName: "Priya Sharma",
  headline: "HSC 2027 · targeting computer science in the US and Germany",
  summary:
    "Building toward a CS degree with a focus on robotics. Everything below links to the artifact behind it; the unevidenced list is shown deliberately.",
  showUnevidenced: true,
  views: 47,
  claims: [
    claim({
      id: "d1", status: "verified", daysAgo: 12,
      claim: "Led a six-person robotics team to the national final",
      proofType: "Award letter",
      proofUrl: "https://example.org/robotics-national-2026/results",
      verifiedSignal: "Placed 2nd of 41 teams, listed on the official results page as team captain.",
      gap: "Does not establish which subsystems I personally built.",
    }),
    claim({
      id: "d2", status: "verified", daysAgo: 30,
      claim: "SAT 1480 (Math 780, EBRW 700)",
      proofType: "Score report",
      proofUrl: "https://example.org/scores/sat-2026-03",
      verifiedSignal: "Official College Board report, March 2026 sitting.",
    }),
    claim({
      id: "d3", status: "verified", daysAgo: 58,
      claim: "Published an open-source line-following robot controller",
      proofType: "Repository",
      proofUrl: "https://example.org/priya/line-follower",
      verifiedSignal: "94 commits over 7 months, 31 stars, MIT licensed.",
      gap: "Popularity is not peer review.",
    }),
    claim({
      id: "d4", status: "unevidenced", daysAgo: 5,
      claim: "Tutored 15 students in physics through a school programme",
      proofType: "Reference letter",
    }),
    claim({
      id: "d5", status: "unevidenced", daysAgo: 3,
      claim: "Ran the school science fair logistics",
      proofType: "Reference letter",
    }),
  ],
};

/* ── Cohort ── */

/** A believable spread: the demo student is strong but not top of every metric. */
export const DEMO_COHORT = {
  suppressed: false as const,
  cohortSize: 148,
  tier: "top50",
  country: null,
  metrics: [
    {
      metric: "gpa", label: "GPA (4.0 scale)", you: 3.72, percentile: 71,
      median: 3.55, quartiles: [3.28, 3.81] as [number, number],
      buckets: [
        { label: "0.0-2.5", count: 6, contains: false },
        { label: "2.5-3.0", count: 19, contains: false },
        { label: "3.0-3.4", count: 38, contains: false },
        { label: "3.4-3.7", count: 44, contains: false },
        { label: "3.7-4.0", count: 41, contains: true },
      ],
    },
    {
      metric: "testPercentile", label: "Test percentile", you: 94, percentile: 88,
      median: 74, quartiles: [58, 90] as [number, number],
      buckets: [
        { label: "0-25", count: 11, contains: false },
        { label: "25-50", count: 24, contains: false },
        { label: "50-75", count: 41, contains: false },
        { label: "75-90", count: 46, contains: false },
        { label: "90-100", count: 26, contains: true },
      ],
    },
    {
      metric: "ecCount", label: "Activity count", you: 4, percentile: 52,
      median: 4, quartiles: [3, 6] as [number, number],
      buckets: [
        { label: "0-2", count: 21, contains: false },
        { label: "2-4", count: 43, contains: false },
        { label: "4-6", count: 47, contains: true },
        { label: "6-8", count: 27, contains: false },
        { label: "8-10", count: 10, contains: false },
      ],
    },
    {
      metric: "research", label: "Research signal", you: 3, percentile: 39,
      median: 4, quartiles: [3, 6] as [number, number],
      buckets: [
        { label: "0-2", count: 26, contains: false },
        { label: "2-4", count: 51, contains: true },
        { label: "4-6", count: 39, contains: false },
        { label: "6-8", count: 22, contains: false },
        { label: "8-10", count: 10, contains: false },
      ],
    },
  ],
};

/* ── Affordability ── */

export const DEMO_SCHOLARSHIPS = [
  {
    id: "daad", name: "DAAD Scholarships", host: "German universities",
    value: "Full tuition waiver + monthly stipend", eligibility: "Strong academic record; programme-specific",
    summary: "Germany's public universities charge no tuition; DAAD adds a living stipend.",
    coverage: "full" as const,
    gapImpact: "Would close the whole gap, and living costs with it.",
    bangladeshEligible: true,
    officialUrl: "https://www.daad.de/en/studying-in-germany/scholarships/",
    typicalWindow: "Most programmes close Oct-Nov", difficulty: "high",
  },
  {
    id: "chevening", name: "Chevening Scholarship", host: "UK universities",
    value: "Full tuition + stipend + flights", eligibility: "2+ years work experience, leadership potential",
    summary: "UK government scholarship with a strong Bangladeshi cohort each year.",
    coverage: "full" as const,
    gapImpact: "Would close the whole gap, and living costs with it.",
    bangladeshEligible: true,
    officialUrl: "https://www.chevening.org/apply/",
    typicalWindow: "Opens Aug · closes early Nov", difficulty: "high",
  },
  {
    id: "nus-asean", name: "NUS Global Merit", host: "National University of Singapore",
    value: "Full tuition + living allowance", eligibility: "Outstanding academic and leadership record",
    summary: "Awarded with admission; no separate application in most years.",
    coverage: "substantial" as const,
    gapImpact: "Covers tuition, which is the larger half of the gap.",
    bangladeshEligible: true,
    officialUrl: "https://www.nus.edu.sg/oam/scholarships",
    typicalWindow: "With admission app · Nov-Mar", difficulty: "high",
  },
];

/* ── Achievements ─────────────────────────────────────────────────────────
   A mid-journey student: enough earned that the shelf has something to show,
   enough locked that the progress rings are visible. Numbers are consistent
   with each other - the level matches the total, the week sums to the week
   figure - because a demo that does not add up is worse than no demo. */

export const DEMO_XP = {
  total: 1240,
  today: 65,
  dailyCap: 150,
  week: 355,
  weeklyGoal: 400,
  weekPercent: 89,
  weekDays: [
    { day: "2026-09-07", earned: 90 },
    { day: "2026-09-08", earned: 65 },
    { day: "2026-09-09", earned: 150 },
    { day: "2026-09-10", earned: 0 },
    { day: "2026-09-11", earned: 50 },
    { day: "2026-09-12", earned: 0 },
    { day: "2026-09-13", earned: 0 },
  ],
  level: {
    level: 4,
    name: "Open water",
    floor: 800,
    ceiling: 1400,
    into: 440,
    remaining: 160,
    percent: 73,
  },
};

export const DEMO_BADGES = [
  {
    id: "timed-sections-10",
    title: "Ten timed sections",
    claim: "Completed 10 practice exam sections under timed conditions",
    signal: "Ten separate sections started and submitted inside their time limit in Polaris.",
    gap: "Practice performance only. It is not an official score and does not predict one.",
    tier: "foundation" as const,
    earnedAt: "2026-08-21T09:12:00.000Z",
  },
  {
    id: "evidence-15",
    title: "Fifteen pieces of evidence",
    claim: "Logged 15 pieces of evidence against a study plan",
    signal: "Fifteen separate artifacts or results attached to specific roadmap milestones.",
    gap: "Polaris records that evidence was attached; it does not audit the artifacts themselves.",
    tier: "foundation" as const,
    earnedAt: "2026-08-29T16:40:00.000Z",
  },
  {
    id: "scores-8",
    title: "Eight results tracked",
    claim: "Logged 8 practice results against a study plan",
    signal: "Eight practice results recorded and used to update the plan.",
    gap: "Counts that results were recorded, not what they were.",
    tier: "foundation" as const,
    earnedAt: "2026-09-02T11:05:00.000Z",
  },
  {
    id: "full-exams-3",
    title: "Three full papers",
    claim: "Sat 3 complete full-length practice examinations end to end",
    signal: "Three exams carried through every stage to submission, without abandoning the session.",
    gap: "Says nothing about the marks achieved.",
    tier: "sustained" as const,
    earnedAt: "2026-09-05T14:22:00.000Z",
  },
  {
    id: "streak-30",
    title: "Thirty days running",
    claim: "Studied on 30 consecutive days",
    signal: "Thirty unbroken days on which the student completed real planned work, recorded automatically.",
    gap: "Counts days with activity, not hours spent.",
    tier: "sustained" as const,
    earnedAt: null, have: 22, need: 30,
  },
  {
    id: "roadmap-nodes-25",
    title: "Twenty-five milestones",
    claim: "Completed 25 milestones on a structured study roadmap",
    signal: "Twenty-five distinct roadmap nodes marked complete against a plan generated for this student's targets.",
    gap: "Completion is student-reported for milestones with no attached artifact.",
    tier: "sustained" as const,
    earnedAt: null, have: 18, need: 25,
  },
  {
    id: "tasks-50",
    title: "Fifty tasks done",
    claim: "Completed 50 planned study tasks",
    signal: "Fifty tasks from a generated study plan marked complete, one at a time, over weeks.",
    gap: "Completion is student-reported for tasks with no attached artifact.",
    tier: "sustained" as const,
    earnedAt: null, have: 31, need: 50,
  },
  {
    id: "replans-5",
    title: "Five course corrections",
    claim: "Revised the study plan 5 times in response to results",
    signal: "Five plan adaptations accepted after new scores or evidence changed the picture.",
    gap: "Shows responsiveness to feedback, not the quality of the resulting plan.",
    tier: "sustained" as const,
    earnedAt: null, have: 3, need: 5,
  },
  {
    id: "verified-claims-5",
    title: "Five backed claims",
    claim: "Published 5 passport claims, each backed by a linked artifact",
    signal: "Five claims on this passport carry a working link to the work they describe.",
    gap: "Polaris checks that a link is present, not that the artifact is genuine.",
    tier: "foundation" as const,
    earnedAt: null, have: 2, need: 5,
  },
  {
    id: "timed-sections-40",
    title: "Forty timed sections",
    claim: "Completed 40 practice exam sections under timed conditions",
    signal: "Forty separate timed sections submitted in Polaris, across the student's chosen exams.",
    gap: "Measures sustained practice volume, not accuracy or readiness.",
    tier: "distinguished" as const,
    earnedAt: null, have: 17, need: 40,
  },
  {
    id: "streak-100",
    title: "A hundred days",
    claim: "Studied on 100 consecutive days",
    signal: "One hundred unbroken days of recorded work in Polaris.",
    gap: "Counts days with activity, not hours spent.",
    tier: "distinguished" as const,
    earnedAt: null, have: 22, need: 100,
  },
];

/* A wallet mid-journey: enough to afford a freeze, not an accent, so the demo
   shows both an available purchase and a blocked one. */
export const DEMO_WALLET = {
  balance: 49,
  lifetime: 49,
  owned: [] as string[],
  activeAccent: null as string | null,
  purchasedFreezes: 0,
  toNextCoin: 15,
  shop: [
    {
      id: "freeze",
      kind: "freeze" as const,
      name: "Streak freeze",
      description:
        "Banks one more freeze. A missed day spends it instead of resetting your streak.",
      cost: 30,
      repeatable: true,
      owned: false,
      blocked: null as string | null,
    },
    {
      id: "accent-oxblood",
      kind: "accent" as const,
      name: "Oxblood passport",
      description:
        "Changes the accent on your public passport - the page a recommender opens.",
      cost: 60,
      repeatable: false,
      owned: false,
      blocked: "You need 11 more coins." as string | null,
      accent: { ink: "#7C2B2B", wash: "rgba(124,43,43,0.08)", label: "Oxblood" },
    },
    {
      id: "accent-verdigris",
      kind: "accent" as const,
      name: "Verdigris passport",
      description:
        "Changes the accent on your public passport - the page a recommender opens.",
      cost: 60,
      repeatable: false,
      owned: false,
      blocked: "You need 11 more coins." as string | null,
      accent: { ink: "#2F5E55", wash: "rgba(47,94,85,0.08)", label: "Verdigris" },
    },
    {
      id: "accent-indigo",
      kind: "accent" as const,
      name: "Indigo passport",
      description:
        "Changes the accent on your public passport - the page a recommender opens.",
      cost: 60,
      repeatable: false,
      owned: false,
      blocked: "You need 11 more coins." as string | null,
      accent: { ink: "#2E3D6B", wash: "rgba(46,61,107,0.08)", label: "Indigo" },
    },
  ],
};

/** The top-bar summary for the demo shell. Derived from DEMO_XP/DEMO_WALLET so
    the bar and the achievements page can never show different numbers. */
export const DEMO_PROGRESS = {
  level: DEMO_XP.level.level,
  levelName: DEMO_XP.level.name,
  levelPercent: DEMO_XP.level.percent,
  points: DEMO_XP.total,
  today: DEMO_XP.today,
  dailyCap: DEMO_XP.dailyCap,
  coins: DEMO_WALLET.balance,
};
