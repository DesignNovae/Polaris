import { getDb } from "@/lib/db/mongodb";
import { deriveEngineGpa, type StudentProfile, type Tier } from "@/lib/profile";
import { profileToInputs, satToPercentile } from "@/lib/ml/probability";

/**
 * Cohort benchmarking.
 *
 * "Students like me, targeting the same places" is the most-asked question in
 * admissions, and Polaris is one of very few products that can answer it
 * honestly - because it holds the longitudinal profile data rather than
 * scraping a forum.
 *
 * Privacy is the constraint that shapes the whole module:
 *
 *   • A cohort under `MIN_COHORT` never renders. Not blurred, not approximated -
 *     the API returns `suppressed` and the UI says why. With small cohorts,
 *     percentiles are re-identifying: in a group of three, "you are 67th
 *     percentile" tells you someone else's score.
 *   • Nothing that identifies a person leaves this module. The aggregation
 *     projects four numbers per profile and no ids, names or emails.
 *   • Buckets are coarse and counts are returned per bucket, never per student.
 *
 * The caller's own profile is included in the cohort - excluding it would make
 * the percentile subtly wrong and leak whether they are in it.
 */

/** Below this, no statistics are returned at all. */
export const MIN_COHORT = 20;

/** Bound the scan. Beyond this the sample is already statistically ample. */
const MAX_SAMPLE = 5000;

export type Metric = "gpa" | "testPercentile" | "ecCount" | "research";

export type MetricSummary = {
  metric: Metric;
  label: string;
  /** The requesting student's own value. */
  you: number;
  /** Percentile of `you` within the cohort, 0-100. */
  percentile: number;
  median: number;
  /** 25th and 75th percentile of the cohort. */
  quartiles: [number, number];
  /** Histogram: [bucketLabel, count]. Counts only - never members. */
  buckets: { label: string; count: number; contains: boolean }[];
};

export type CohortResult =
  | { suppressed: true; cohortSize: number; minimum: number; tier: Tier; country: string | null }
  | {
      suppressed: false;
      cohortSize: number;
      tier: Tier;
      country: string | null;
      metrics: MetricSummary[];
    };

type Row = { gpa: number; testPercentile: number; ecCount: number; research: number };

const METRIC_LABEL: Record<Metric, string> = {
  gpa: "GPA (4.0 scale)",
  testPercentile: "Test percentile",
  ecCount: "Activity count",
  research: "Research signal",
};

const BUCKETS: Record<Metric, { edges: number[]; format: (a: number, b: number) => string }> = {
  gpa: { edges: [0, 2.5, 3.0, 3.4, 3.7, 4.0], format: (a, b) => `${a.toFixed(1)}-${b.toFixed(1)}` },
  testPercentile: { edges: [0, 25, 50, 75, 90, 100], format: (a, b) => `${a}-${b}` },
  ecCount: { edges: [0, 2, 4, 6, 8, 10], format: (a, b) => `${a}-${b}` },
  research: { edges: [0, 2, 4, 6, 8, 10], format: (a, b) => `${a}-${b}` },
};

/** Exported for tests - the statistics are the privacy-sensitive part. */
export function quantile(sorted: number[], q: number): number {
  if (sorted.length === 0) return 0;
  const pos = (sorted.length - 1) * q;
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  if (lo === hi) return sorted[lo];
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (pos - lo);
}

/** Share of the cohort at or below `value`, as a percentage. */
export function percentileOf(sorted: number[], value: number): number {
  if (sorted.length === 0) return 0;
  let count = 0;
  for (const v of sorted) {
    if (v <= value) count++;
    else break; // sorted ascending
  }
  return Math.round((count / sorted.length) * 100);
}

export function summarise(metric: Metric, values: number[], you: number): MetricSummary {
  const sorted = [...values].sort((a, b) => a - b);
  const { edges, format } = BUCKETS[metric];

  const buckets = edges.slice(0, -1).map((lo, i) => {
    const hi = edges[i + 1];
    const isLast = i === edges.length - 2;
    const inRange = (v: number) => (isLast ? v >= lo && v <= hi : v >= lo && v < hi);
    return {
      label: format(lo, hi),
      count: sorted.filter(inRange).length,
      contains: inRange(you),
    };
  });

  return {
    metric,
    label: METRIC_LABEL[metric],
    you: Number(you.toFixed(2)),
    percentile: percentileOf(sorted, you),
    median: Number(quantile(sorted, 0.5).toFixed(2)),
    quartiles: [
      Number(quantile(sorted, 0.25).toFixed(2)),
      Number(quantile(sorted, 0.75).toFixed(2)),
    ],
    buckets,
  };
}

/**
 * Reduce a stored profile to the four comparable numbers.
 * Mirrors `profileToInputs` so the cohort is measured on exactly the same basis
 * as the acceptance model - two different definitions of "GPA" across one
 * product would make both meaningless.
 */
function toRow(profile: StudentProfile): Row {
  const inputs = profileToInputs(profile);
  return {
    gpa: deriveEngineGpa(profile),
    testPercentile:
      profile.testPercentile ??
      (profile.testScores?.SAT !== undefined
        ? satToPercentile(profile.testScores.SAT)
        : inputs.testPercentile),
    ecCount: inputs.ecCount,
    research: inputs.research,
  };
}

export async function buildCohort(
  profile: StudentProfile,
  options: { matchCountry: boolean },
): Promise<CohortResult> {
  const db = await getDb();
  const tier = profile.targetTier;
  const country = options.matchCountry ? profile.country : null;

  const match: Record<string, unknown> = { targetTier: tier };
  if (country) match.country = country;

  // Project only what the statistics need. No userId, no name, no email - the
  // rows that leave this query cannot be attributed to anyone.
  const docs = await db
    .collection("profiles")
    .find(match, {
      projection: {
        _id: 0, userId: 0, preferences: 0, updatedAt: 0,
      },
      limit: MAX_SAMPLE,
    })
    .toArray();

  const rows = docs
    .map((d) => {
      try {
        return toRow(d as unknown as StudentProfile);
      } catch {
        return null; // a malformed profile must not break the cohort
      }
    })
    .filter((r): r is Row => r !== null);

  if (rows.length < MIN_COHORT) {
    return {
      suppressed: true,
      cohortSize: rows.length,
      minimum: MIN_COHORT,
      tier,
      country,
    };
  }

  const you = toRow(profile);
  const metrics: Metric[] = ["gpa", "testPercentile", "ecCount", "research"];

  return {
    suppressed: false,
    cohortSize: rows.length,
    tier,
    country,
    metrics: metrics.map((m) => summarise(m, rows.map((r) => r[m]), you[m])),
  };
}
