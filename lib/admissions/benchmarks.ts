import { getUniversities } from "@/lib/content";
import type { Tier } from "@/lib/profile";
import { satToPercentile, type UniversityForModel } from "@/lib/ml/probability";

type UniversityRow = {
  tier?: UniversityForModel["tier"];
  acceptanceRate?: unknown;
  requirements?: { gpa?: unknown; tests?: unknown };
};

export type TargetBenchmark = {
  tier: Tier;
  label: string;
  sampleSize: number;
  medianAcceptanceRate: number | null;
  gpaBenchmark: number | null;
  testingBenchmarkPercentile: number | null;
  gpaReference: string;
  testingReference: string;
  source: string;
};

const LABELS: Record<Tier, string> = {
  elite: "Elite-tier",
  top50: "Top-50",
  top200: "Top-200",
  regional: "Regional",
};

// These are data-tier mappings, not acceptance-rate assumptions. The bundled
// university records use finer ranks than the student profile does.
const DATA_TIERS: Record<Tier, UniversityForModel["tier"][]> = {
  elite: ["elite", "top10"],
  top50: ["top50"],
  top200: ["top100", "top200"],
  regional: ["regional"],
};

function median(values: number[]): number | null {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[middle - 1] + sorted[middle]) / 2
    : sorted[middle];
}

function gpaReference(rows: UniversityRow[]): string {
  // Only use a US-style 0-4 requirement when the source explicitly includes
  // one. Percent, A-level, IB, and local-scale requirements are not silently
  // converted into a fake 4.0 comparison.
  const gpas = rows.flatMap((row) => {
    const text = typeof row.requirements?.gpa === "string" ? row.requirements.gpa : "";
    return (text.match(/\b[3-4]\.\d{1,2}\b/g) ?? []).map(Number);
  });
  const value = median(gpas);
  return value === null ? "Published requirements vary" : `${value.toFixed(2)}+ typical`;
}

function gpaBenchmark(rows: UniversityRow[]): number | null {
  const gpas = rows.flatMap((row) => {
    const text = typeof row.requirements?.gpa === "string" ? row.requirements.gpa : "";
    return (text.match(/\b[3-4]\.\d{1,2}\b/g) ?? []).map(Number);
  });
  return median(gpas);
}

function testingReference(rows: UniversityRow[]): string {
  const sats = rows.flatMap((row) => {
    const text = typeof row.requirements?.tests === "string" ? row.requirements.tests : "";
    return (text.match(/\bSAT\s+(\d{3,4})/gi) ?? [])
      .map((match) => Number(match.replace(/[^0-9]/g, "")))
      .filter((score) => score >= 400 && score <= 1600);
  });
  const sat = median(sats);
  if (sat === null) return "Published tests vary";
  return `${Math.round(satToPercentile(sat))}%ile (SAT ${Math.round(sat)}+)`;
}

function testingBenchmarkPercentile(rows: UniversityRow[]): number | null {
  const sats = rows.flatMap((row) => {
    const text = typeof row.requirements?.tests === "string" ? row.requirements.tests : "";
    return (text.match(/\bSAT\s+(\d{3,4})/gi) ?? [])
      .map((match) => Number(match.replace(/[^0-9]/g, "")))
      .filter((score) => score >= 400 && score <= 1600);
  });
  const sat = median(sats);
  return sat === null ? null : satToPercentile(sat);
}

/**
 * Builds the Strategist's target context from the same university records the
 * Universities page and fit engine use. No target-tier acceptance rates or
 * admit medians are hardcoded here.
 */
export async function getTargetBenchmark(tier: Tier): Promise<TargetBenchmark> {
  const rows = (await getUniversities()) as UniversityRow[];
  const allowed = new Set(DATA_TIERS[tier]);
  const matching = rows.filter((row) => row.tier && allowed.has(row.tier));
  const rates = matching
    .map((row) => Number(row.acceptanceRate))
    .filter((rate) => Number.isFinite(rate) && rate > 0 && rate < 1);
  const sampleSize = matching.length;
  const medianAcceptanceRate = median(rates);

  return {
    tier,
    label: LABELS[tier],
    sampleSize,
    medianAcceptanceRate,
    gpaBenchmark: gpaBenchmark(matching),
    testingBenchmarkPercentile: testingBenchmarkPercentile(matching),
    gpaReference: gpaReference(matching),
    testingReference: testingReference(matching),
    source: `${sampleSize} published university record${sampleSize === 1 ? "" : "s"} in the Polaris dataset`,
  };
}
