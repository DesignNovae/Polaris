/**
 * Consultant matching - explainable recommendations from the student's real
 * state: roadmap config (goal, exams, weak areas), deadline pressure, and
 * profile (country, level). Never random advertising: every match carries
 * human-readable reasons, free resources are surfaced first, and matching
 * is identical for every plan.
 */

import type { StudentProfile } from "@/lib/profile";
import type { RoadmapDoc } from "@/lib/roadmap/types";
import type { DbConsultant } from "./service";
import { SERVICE_META, type ServiceKey } from "./registry";

export type MatchContext = {
  profile: StudentProfile | null;
  roadmap: RoadmapDoc | null;
  /** Upcoming deadline titles within ~45 days. */
  upcomingDeadlines: string[];
};

export type ConsultantMatch = {
  consultantId: string;
  score: number;
  reasons: string[];
};

const COUNTRY_HINTS: Record<string, string[]> = {
  USA: ["usa", "us ", "states", "american", "ivy", "mit", "stanford"],
  Canada: ["canada", "toronto", "ubc", "mcgill", "waterloo"],
  Germany: ["germany", "german", "tu munich", "berlin", "daad", "uni-assist"],
  UK: ["uk", "united kingdom", "britain", "oxford", "cambridge", "ucas", "manchester"],
  Australia: ["australia", "sydney", "melbourne"],
  Ireland: ["ireland", "dublin"],
};

function wantedServices(ctx: MatchContext): Array<{ service: ServiceKey; reason: string; weight: number }> {
  const wants: Array<{ service: ServiceKey; reason: string; weight: number }> = [];
  const goal = (ctx.roadmap?.config.targetGoal ?? "").toLowerCase();
  const weak = (ctx.roadmap?.config.weakAreas ?? "").toLowerCase();
  const exams = ctx.roadmap?.config.exams ?? [];
  const deadlineBlob = ctx.upcomingDeadlines.join(" · ").toLowerCase();

  // Visa pressure: visa-ish deadlines or post-offer phrasing.
  if (/visa|interview|embassy|i-20|cas|sds/.test(deadlineBlob)) {
    wants.push({
      service: "visa-interview",
      reason: "You have a visa-related deadline coming up and interview prep is time-boxed",
      weight: 40,
    });
    wants.push({
      service: "offer-guidance",
      reason: "Post-offer steps (deposits, documents) pair with visa timelines",
      weight: 18,
    });
  }

  // Test coaching from declared exams + weak areas.
  if (exams.includes("IELTS") || exams.includes("TOEFL") || /ielts|toefl|writing|speaking/.test(weak)) {
    wants.push({
      service: "ielts-coaching",
      reason: exams.includes("IELTS")
        ? "IELTS is in your roadmap scope - targeted coaching beats generic prep"
        : "Your roadmap lists language-test work as a weak area",
      weight: 34,
    });
  }

  // Essay/SOP from weak areas or goal phrasing.
  if (/essay|sop|statement|writing/.test(weak) || /essay|sop/.test(goal)) {
    wants.push({
      service: "sop-review",
      reason: "Your roadmap flags essays/SOP as a weak area",
      weight: 32,
    });
  }

  // Scholarship interest.
  if (/scholarship|funding|aid/.test(goal + " " + deadlineBlob)) {
    wants.push({
      service: "scholarship-decision",
      reason: "Scholarships appear in your goal or deadlines - aid letters are negotiable",
      weight: 26,
    });
  }

  // Country-specific guidance from goal text.
  for (const [country, hints] of Object.entries(COUNTRY_HINTS)) {
    if (hints.some((h) => goal.includes(h))) {
      wants.push({
        service: "country-guidance",
        reason: `Your goal mentions ${country} - first-hand guidance saves agency fees`,
        weight: 28,
      });
      break;
    }
  }

  // Younger students → parent consultations are usually the real unlock.
  if (ctx.profile?.grade === "middle" || ctx.roadmap?.config.educationLevel === "early-school" || ctx.roadmap?.config.educationLevel === "middle-school") {
    wants.push({
      service: "parent-consultation",
      reason: "At your level, a guardian session is often the most useful first step",
      weight: 24,
    });
  }

  // Default: general admission strategy when nothing specific surfaced.
  if (wants.length === 0) {
    wants.push({
      service: "admission-strategy",
      reason: "A general strategy session maps your next two months",
      weight: 15,
    });
    wants.push({
      service: "university-selection",
      reason: "Most students start with a shortlist sanity-check",
      weight: 12,
    });
  }

  return wants;
}

export function matchConsultants(ctx: MatchContext, consultants: DbConsultant[]): ConsultantMatch[] {
  const wants = wantedServices(ctx);
  const goalCountry = Object.entries(COUNTRY_HINTS).find(([, hints]) =>
    hints.some((h) => (ctx.roadmap?.config.targetGoal ?? "").toLowerCase().includes(h)),
  )?.[0];

  const matches: ConsultantMatch[] = [];
  for (const c of consultants) {
    if (c.verification !== "verified" && c.verification !== "featured") continue;
    let score = 0;
    const reasons: string[] = [];

    for (const w of wants) {
      if (c.services.includes(w.service)) {
        score += w.weight;
        reasons.push(w.reason);
      }
    }
    if (goalCountry && c.countries.includes(goalCountry)) {
      score += 16;
      reasons.push(`Knows ${goalCountry} first-hand`);
    }
    if (c.freeFirstSession) score += 8; // free-first bias, mirrors partners
    if (c.verification === "featured") score += 4;

    if (score > 0 && reasons.length > 0) {
      matches.push({ consultantId: c.id, score, reasons: [...new Set(reasons)].slice(0, 2) });
    }
  }

  matches.sort((a, b) => b.score - a.score);
  return matches.slice(0, 3);
}

export function serviceLabel(s: ServiceKey): string {
  return SERVICE_META[s].label;
}


