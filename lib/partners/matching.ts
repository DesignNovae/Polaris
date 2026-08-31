/**
 * Partner offer matching - profile-driven, free-first.
 *
 * Inputs come from the live system (roadmap doc branches/topics, logged
 * scores, education level, shortlist tier, upcoming deadline types) and every
 * match carries a human-readable reason. Free offers always outrank paid
 * ones at equal relevance; nothing is recommended without a reason.
 */

import { PARTNER_OFFERS, type PartnerOffer } from "./registry";
import type { EducationLevel } from "@/lib/roadmap/types";

export type MatchContext = {
  level: EducationLevel;
  /** Roadmap topic tags present in the student's branches. */
  roadmapTopics: string[];
  /** Recent weak scores: key + ratio (value/max). */
  weakScores: Array<{ key: string; label: string; ratio: number }>;
  /** Student shortlisted an elite/top-10 school. */
  aimsElite: boolean;
  /** Deadline types due in the next 30 days. */
  deadlineTypesSoon: string[];
};

export type MatchedOffer = {
  offer: PartnerOffer;
  score: number;
  reasons: string[];
};

const SCORE_TOPIC: Record<string, string[]> = {
  "sat-math": ["sat-math"], "sat-english": ["sat-reading", "sat-writing"], "sat-total": ["sat-math", "sat-reading"],
  "ielts-overall": ["ielts-writing", "ielts-speaking", "ielts-listening", "ielts-reading"],
  "ielts-listening": ["ielts-listening"], "ielts-reading": ["ielts-reading"],
  "ielts-writing": ["ielts-writing"], "ielts-speaking": ["ielts-speaking"],
  "mock-pct": ["board-prep", "study-skills"], "board-gpa": ["board-prep"],
  "olympiad-score": ["olympiad-math"],
};

export function matchOffers(ctx: MatchContext): MatchedOffer[] {
  const out: MatchedOffer[] = [];

  for (const offer of PARTNER_OFFERS) {
    if (offer.educationLevels && !offer.educationLevels.includes(ctx.level)) continue;

    let score = 0;
    const reasons: string[] = [];

    // Roadmap topic overlap.
    const topicHits = offer.topics.filter((t) => ctx.roadmapTopics.includes(t));
    if (topicHits.length) {
      score += 30 + topicHits.length * 10;
      reasons.push(`Matches your roadmap's ${topicHits[0].replace(/-/g, " ")} work`);
    }

    // Weak-score boosters.
    for (const w of ctx.weakScores) {
      const mapped = SCORE_TOPIC[w.key] ?? [];
      if (offer.topics.some((t) => mapped.includes(t))) {
        score += 40;
        reasons.push(`Your ${w.label} is below target - this directly targets that gap`);
        break;
      }
    }

    // Deadline helpers.
    if (ctx.deadlineTypesSoon.includes("test-exam") && (offer.category === "mock_test" || offer.category === "sat" || offer.category === "ielts")) {
      score += 25;
      reasons.push("You have a test deadline inside 30 days");
    }
    if (ctx.deadlineTypesSoon.includes("application") && (offer.category === "essay" || offer.category === "productivity")) {
      score += 20;
      reasons.push("An application deadline is approaching");
    }

    // Dream-tier fit boosters.
    if (ctx.aimsElite && (offer.topics.includes("portfolio") || offer.topics.includes("coding") || offer.category === "research")) {
      score += 18;
      reasons.push("Elite targets reward shipped projects - this strengthens your portfolio");
    }
    if (ctx.aimsElite && offer.category === "essay") {
      score += 12;
      reasons.push("Essay quality is decisive at your target tier");
    }

    // Young students: free + exploratory first, never SAT/IELTS pressure.
    const young = ctx.level === "early-school" || ctx.level === "middle-school";
    if (young && ["sat", "ielts", "mock_test", "essay"].includes(offer.category)) continue;
    if (young && (offer.category === "olympiad" || offer.topics.includes("science-fair") || offer.topics.includes("coding"))) {
      score += 20;
      reasons.push("Great fit for exploration at your level");
    }

    // Free-first bias.
    if (offer.offerType === "free_student_benefit") score += 14;
    if (offer.offerType === "curated_no_commission") score += 8;

    if (offer.status === "coming_soon") score = Math.min(score, 10);

    if (score > 0 || offer.status === "coming_soon") {
      if (!reasons.length) reasons.push("Broadly useful for your stage");
      out.push({ offer, score, reasons });
    }
  }

  return out.sort((a, b) => b.score - a.score);
}

/** Section builders for the tabs. */
export function sectionize(matches: MatchedOffer[]) {
  const active = matches.filter((m) => m.offer.status === "active");

  const categoryMap = {
    scoreBoost: ["sat", "ielts", "mock_test", "tutoring", "olympiad"],
    appBoost: ["essay", "portfolio", "coding", "research", "design", "productivity", "mentorship"],
    money: ["scholarship", "cloud", "books"],
  } as const;

  const inCategory = (offer: PartnerOffer, categories: readonly string[]) =>
    categories.includes(offer.category);

  return {
    matched: active.filter((m) => m.score >= 30).slice(0, 9),
    scoreBoost: active.filter((m) => inCategory(m.offer, categoryMap.scoreBoost)),
    appBoost: active.filter((m) => inCategory(m.offer, categoryMap.appBoost)),
    money: active.filter((m) => inCategory(m.offer, categoryMap.money)),
    free: active.filter((m) => m.offer.offerType === "free_student_benefit"),
    comingSoon: matches.filter((m) => m.offer.status === "coming_soon"),
  };
}

