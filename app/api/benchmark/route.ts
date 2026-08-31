import type { StudentProfile } from "@/lib/profile";
import { getCaseStudies } from "@/lib/content";
import { ok, withErrorHandling, parseJson } from "@/lib/api/respond";
import { requireSession } from "@/lib/authz";
import { benchmarkBodySchema } from "@/lib/validation/schemas";

export const dynamic = "force-dynamic";

type CaseStudy = {
  id: string;
  title: string;
  profile: {
    country: string;
    school: string;
    gpa: string;
    tests: string;
    ecs: string[];
    tier: string;
  };
  whatWorked: string;
  tags: string[];
};

function tierRank(tier: string): number {
  const map: Record<string, number> = { elite: 5, top10: 4, top50: 3, top100: 2, top200: 1, regional: 0 };
  return map[tier] ?? 0;
}

function matchScore(profile: StudentProfile, cs: CaseStudy): number {
  let score = 0;
  if (cs.profile.country === profile.country) score += 3;
  const targetRank = tierRank(profile.targetTier);
  const csRank = tierRank(cs.profile.tier);
  if (csRank >= targetRank) score += 2;
  if (Math.abs(csRank - targetRank) <= 1) score += 1;
  const csEcLower = cs.profile.ecs.map((e) => e.toLowerCase()).join(" ");
  for (const ec of profile.ecs) {
    if (csEcLower.includes(ec.toLowerCase())) score += 1;
  }
  return score;
}

export const POST = withErrorHandling(async (req) => {
  // Acceptance-rate benchmarks are part of the Free plan promise.
  await requireSession();
  const { profile } = benchmarkBodySchema.parse(await parseJson(req)) as {
    profile: StudentProfile;
  };

  const caseStudies = (await getCaseStudies()) as unknown as CaseStudy[];
  const scored = caseStudies
    .map((cs) => ({ ...cs, matchScore: matchScore(profile, cs) }))
    .sort((a, b) => b.matchScore - a.matchScore);

  const topMatches = scored.slice(0, 5);

  const yourEcs = new Set(profile.ecs.map((e) => e.toLowerCase()));
  const commonEcs = new Set<string>();
  const missingEcs = new Set<string>();

  for (const cs of topMatches) {
    for (const ec of cs.profile.ecs) {
      const lower = ec.toLowerCase();
      let found = false;
      for (const yourEc of yourEcs) {
        if (lower.includes(yourEc) || yourEc.includes(lower)) {
          found = true;
          commonEcs.add(ec);
          break;
        }
      }
      if (!found) missingEcs.add(ec);
    }
  }

  const insights = [];

  if (missingEcs.size > 0) {
    const top = Array.from(missingEcs).slice(0, 5);
    insights.push({
      type: "gap" as const,
      title: "What accepted students had that you don't (yet)",
      items: top,
    });
  }

  if (commonEcs.size > 0) {
    insights.push({
      type: "strength" as const,
      title: "Where you already match accepted students",
      items: Array.from(commonEcs).slice(0, 5),
    });
  }

  const avgGpa = topMatches.reduce((sum, cs) => {
    const match = cs.profile.gpa.match(/([\d.]+)/);
    return sum + (match ? parseFloat(match[1]) : 0);
  }, 0) / topMatches.length;

  insights.push({
    type: "stat" as const,
    title: "Avg GPA of similar accepted students",
    items: [avgGpa.toFixed(2)],
  });

  return ok({
    topMatches: topMatches.map(({ id, title, profile: p, whatWorked, tags, matchScore: ms }) => ({
      id,
      title,
      profile: p,
      whatWorked,
      tags,
      matchScore: ms,
    })),
    insights,
  });
});

