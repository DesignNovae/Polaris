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
