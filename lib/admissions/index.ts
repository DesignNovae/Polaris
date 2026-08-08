/**
 * Admissions data layer.
 *
 * Merges the university KB (data/universities.json via lib/content) with the
 * admissions enrichment dataset (data/university-admissions.json - official
 * links, application systems, deadline patterns, test policy, tuition, aid,
 * sources, lastUpdated) into one `UniProfile` the Universities page renders.
 *
 * Fit banding sits on the existing transparent probability engine
 * (lib/ml/probability) - five bands instead of fake percentages, always
 * labelled as an estimate, with an explanation derived from the engine's
 * real factor contributions.
 */

import admissionsJson from "@/data/university-admissions.json";
import type { UniversityForModel, ProbabilityInputs, Factor } from "@/lib/ml/probability";
import { scoreProbability } from "@/lib/ml/probability";

/* ─── enrichment types ─── */

export type UniDeadline = { label: string; month: number; day: number };

export type UniAdmissions = {
  officialWebsite: string;
  admissionsUrl: string;
  applicationSystems: string[];
  deadlines: UniDeadline[];
  testPolicy: string;
  english: string;
  tuitionIntl: string;
  aid: string;
  scholarships: string;
  typeTags: string[];
  sourceUrls: string[];
};

export type UniProfile = {
  id: string;
  name: string;
  country: string;
  city: string;
  tier: UniversityForModel["tier"];
  acceptanceRate: number;
  topPrograms: string[];
  requirements: {
    gpa?: string;
    tests?: string;
    essays?: string;
    recs?: string;
    differentiators?: string;
  };
  tags: string[];
  summary: string;
  admissions: UniAdmissions | null;
  lastUpdated: string;
  verifyNote: string;
};

type AdmissionsFile = {
  _meta: { lastUpdated: string; verifyNote: string };
} & Record<string, UniAdmissions | { lastUpdated: string; verifyNote: string; description?: string }>;

const FILE = admissionsJson as unknown as AdmissionsFile;

export function admissionsFor(id: string): UniAdmissions | null {
  const entry = FILE[id];
  if (!entry || id === "_meta") return null;
  return entry as UniAdmissions;
}

export function admissionsMeta() {
  return FILE._meta;
}

/** Merge a KB row (lib/content shape) with its enrichment. */
export function toUniProfile(raw: Record<string, unknown>): UniProfile {
  const id = String(raw.id ?? "");
  return {
    id,
    name: String(raw.name ?? ""),
    country: String(raw.country ?? ""),
    city: String(raw.city ?? ""),
    tier: raw.tier as UniversityForModel["tier"],
    acceptanceRate: Number(raw.acceptanceRate ?? 0.1),
    topPrograms: (raw.topPrograms as string[]) ?? [],
    requirements: (raw.requirements as UniProfile["requirements"]) ?? {},
    tags: (raw.tags as string[]) ?? [],
    summary: String(raw.summary ?? ""),
    admissions: admissionsFor(id),
    lastUpdated: FILE._meta.lastUpdated,
    verifyNote: FILE._meta.verifyNote,
  };
}

/* ─── deadline helpers (year-agnostic patterns → next occurrence) ─── */

/** Next occurrence of a month/day pattern from `from` (defaults today). */
export function nextOccurrence(d: UniDeadline, from = new Date()): Date {
  const year = from.getFullYear();
  const candidate = new Date(year, d.month - 1, d.day);
  if (candidate >= from) return candidate;
  return new Date(year + 1, d.month - 1, d.day);
}

export function daysUntil(date: Date, from = new Date()): number {
  const a = new Date(from.getFullYear(), from.getMonth(), from.getDate());
  const b = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  return Math.round((b.getTime() - a.getTime()) / 86_400_000);
}

/* ─── fit banding (on top of the real engine) ─── */

export type FitBand = "Reach" | "Competitive Reach" | "Target" | "Likely" | "Safety";

export type FitResult = {
  band: FitBand;
  /** Engine probability 0–1 - surfaced ONLY as a labelled estimate. */
  estimate: number;
  /** Why - from the engine's real factor contributions. */
  explanation: string;
  topDriver?: string;
  biggestGap?: string;
  /** Per-factor weights + contributions, so the UI can show its working. */
  factors: Factor[];
  /** The school's published admit rate, for context next to the estimate. */
  baseline: number;
};

export function fitBandOf(p: number): FitBand {
  if (p < 0.15) return "Reach";
  if (p < 0.30) return "Competitive Reach";
  if (p < 0.55) return "Target";
  if (p < 0.75) return "Likely";
  return "Safety";
}

export const FIT_TONES: Record<FitBand, "rose" | "nova" | "polaris" | "aurora"> = {
  "Reach": "rose",
  "Competitive Reach": "nova",
  "Target": "polaris",
  "Likely": "aurora",
  "Safety": "aurora",
};

export function computeFit(
  inputs: ProbabilityInputs,
  uni: { id: string; tier: UniversityForModel["tier"]; acceptanceRate: number },
): FitResult {
  const res = scoreProbability(inputs, uni);
  const factors = res.factors;
  const top = factors[0];
  const gap = factors[factors.length - 1];
  const band = fitBandOf(res.probability);

  const explanation =
    top && gap && top !== gap
      ? `${top.name} is your strongest signal here; ${gap.name.toLowerCase()} is the biggest gap for this school's admit profile.`
      : top
        ? `${top.name} carries most of your fit for this school.`
        : "Estimate derived from your academic profile against this school's selectivity.";

  return {
    band,
    estimate: res.probability,
    explanation,
    topDriver: top?.name,
    biggestGap: gap?.name,
    factors,
    baseline: res.baseline,
  };
}
