import { getContent } from "@/lib/content";
import { SCHOLARSHIP_META } from "@/lib/resources/hub";
import { formatBdt } from "./model";

/**
 * Ranking scholarships against a specific funding gap.
 *
 * The resources hub already lists awards. What it cannot say is whether any of
 * them would actually close *this* family's shortfall, which is the only
 * question that matters once a gap has a number on it.
 *
 * Coverage is deliberately coarse - "full ride" versus "partial" - because the
 * underlying `value` strings are prose written by humans, and inventing a
 * precise taka figure from "Full tuition + stipend (~£18k/yr) + travel" would
 * be exactly the kind of unsupported number this product exists to catch.
 */

export type Coverage = "full" | "substantial" | "partial" | "unknown";

export type RankedScholarship = {
  id: string;
  name: string;
  host: string;
  value: string;
  eligibility: string;
  summary: string;
  tags: string[];
  coverage: Coverage;
  /** How much of the gap this plausibly closes, as a label not a figure. */
  gapImpact: string;
  bangladeshEligible: boolean;
  officialUrl?: string;
  typicalWindow?: string;
  difficulty?: string;
  score: number;
};

type RawScholarship = {
  id: string;
  name: string;
  host: string;
  level?: string;
  value: string;
  eligibility: string;
  summary: string;
  tags?: string[];
};

const FULL_MARKERS = ["full ride", "full tuition + stipend", "fully funded", "full cost"];
const SUBSTANTIAL_MARKERS = ["full tuition", "tuition + stipend", "covers tuition", "stipend"];
const PARTIAL_MARKERS = ["partial", "up to", "%", "contribution", "bursary"];

export function classifyCoverage(value: string): Coverage {
  const v = value.toLowerCase();
  if (FULL_MARKERS.some((m) => v.includes(m))) return "full";
  if (SUBSTANTIAL_MARKERS.some((m) => v.includes(m))) return "substantial";
  if (PARTIAL_MARKERS.some((m) => v.includes(m))) return "partial";
  return "unknown";
}

function isBangladeshEligible(s: RawScholarship): boolean {
  const haystack = `${s.tags?.join(" ") ?? ""} ${s.eligibility} ${s.summary}`.toLowerCase();
  return (
    haystack.includes("bangladesh") ||
    haystack.includes("international") ||
    haystack.includes("all nationalities")
  );
}

function matchesCountry(s: RawScholarship, country: string): boolean {
  const haystack = `${s.tags?.join(" ") ?? ""} ${s.host} ${s.summary}`.toLowerCase();
  return haystack.includes(country.toLowerCase());
}

function gapImpactLabel(coverage: Coverage, gapAnnualBdt: number): string {
  if (gapAnnualBdt <= 0) return "You are already covered without it.";
  const gap = formatBdt(gapAnnualBdt);
  switch (coverage) {
    case "full":
      return `Would close the whole ${gap} gap, and living costs with it.`;
    case "substantial":
      return `Covers tuition, which is the larger half of the ${gap} gap.`;
    case "partial":
      return `Reduces the ${gap} gap; plan on stacking it with another source.`;
    default:
      return `Award value is not published as a figure - check the official page before counting on it.`;
  }
}

/** Weight full-cost, Bangladesh-eligible, country-matched awards to the top. */
function score(s: RawScholarship, coverage: Coverage, country: string): number {
  let n = 0;
  n += { full: 5, substantial: 3.5, partial: 1.5, unknown: 0.5 }[coverage];
  if (isBangladeshEligible(s)) n += 3;
  if (matchesCountry(s, country)) n += 2;
  if (SCHOLARSHIP_META[s.id]?.officialUrl) n += 1; // verifiable beats plausible
  return n;
}

export async function rankScholarships(
  country: string,
  gapAnnualBdt: number,
  limit = 6,
): Promise<RankedScholarship[]> {
  const items = (await getContent("scholarships")) as unknown as RawScholarship[];

  return items
    .map((s) => {
      const coverage = classifyCoverage(s.value);
      const meta = SCHOLARSHIP_META[s.id];
      return {
        id: s.id,
        name: s.name,
        host: s.host,
        value: s.value,
        eligibility: s.eligibility,
        summary: s.summary,
        tags: s.tags ?? [],
        coverage,
        gapImpact: gapImpactLabel(coverage, gapAnnualBdt),
        bangladeshEligible: isBangladeshEligible(s),
        officialUrl: meta?.officialUrl,
        typicalWindow: meta?.typicalWindow,
        difficulty: meta?.difficulty,
        score: score(s, coverage, country),
      };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}
