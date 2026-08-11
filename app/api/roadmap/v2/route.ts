/**
 * /api/roadmap/v2
 *
 * GET    - the user's live roadmap doc, or { doc: null } → setup needed.
 * POST   - body = RoadmapConfig (+ optional profileSeed) → generate + save.
 *          The roadmap setup IS the onboarding: when no profile exists yet,
 *          one is created here from the setup answers, so new users never
 *          see a separate intake form. When a profile exists, the seed
 *          fields the user just confirmed are merged in (single source of
 *          truth - no duplicate questions later).
 * DELETE - wipe the roadmap (back to setup).
 */

import { NextResponse } from "next/server";
import { z } from "zod";
import { ok, withErrorHandling, parseJson } from "@/lib/api/respond";
import { requireSession } from "@/lib/authz";
import { rateLimit, rateLimitHeaders } from "@/lib/ratelimit";
import { getProfile, upsertProfile, getRoadmapV2, saveRoadmapV2, deleteRoadmapV2 } from "@/lib/db/collections";
import { RoadmapConfigSchema, type RoadmapConfig, type EducationLevel } from "@/lib/roadmap/types";
import { generateRoadmap } from "@/lib/roadmap/generate";
import { repairRoadmapCategories } from "@/lib/roadmap/schedule";
import type { StudentProfile, GradeLevel } from "@/lib/profile";
import { BN_ERRORS, requestLanguage } from "@/lib/i18n/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// A new roadmap may include a master call plus bounded expansion calls.
export const maxDuration = 300;

export const GET = withErrorHandling(async () => {
  const session = await requireSession();
  const saved = await getRoadmapV2(session.id);
  if (!saved) return ok({ doc: null });
  const repaired = repairRoadmapCategories(saved);
  if (repaired.changed) await saveRoadmapV2(session.id, repaired.doc);
  return ok({ doc: repaired.doc });
});

/** Profile fields the setup flow collects alongside the roadmap config. */
const ProfileSeedSchema = z.object({
  country: z.enum(["Bangladesh", "India", "Pakistan", "Nepal", "Other South Asia", "Other"]).optional(),
  degree: z.enum(["undergrad", "masters", "phd", "undecided"]).optional(),
  targetTier: z.enum(["elite", "top50", "top200", "regional"]).optional(),
});
type ProfileSeed = z.infer<typeof ProfileSeedSchema>;

const LEVEL_TO_GRADE: Record<EducationLevel, GradeLevel> = {
  "early-school": "middle",
  "middle-school": "middle",
  "ssc": "early-hs",
  "hsc": "late-hs",
  "gap-applicant": "recent-grad",
};

/** Map setup score keys to the profile's testScores convention. */
function seedTestScores(config: RoadmapConfig): Record<string, number> | undefined {
  const scores = config.currentScores ?? {};
  const out: Record<string, number> = {};
  if (typeof scores["sat-total"] === "number") out.SAT = scores["sat-total"];
  if (typeof scores["ielts-overall"] === "number") out.IELTS = scores["ielts-overall"];
  return Object.keys(out).length ? out : undefined;
}

export const POST = withErrorHandling(async (req) => {
  const language = requestLanguage(req);
  const session = await requireSession();

  const rl = await rateLimit(session.id, session.plan, "strategist");
  if (!rl.allowed) {
    return NextResponse.json(
      { error: language === "bn" ? BN_ERRORS.rateLimit : "Rate limit reached - try again in a few minutes." },
      { status: 429, headers: rateLimitHeaders(rl) },
    );
  }

  const body = (await parseJson(req)) as Record<string, unknown>;
  const config = RoadmapConfigSchema.parse(body);
  const seed: ProfileSeed = ProfileSeedSchema.parse(body.profileSeed ?? {});

  const existing = await getProfile(session.id);
  const tests = seedTestScores(config);

  // First roadmap doubles as onboarding: create (or refresh) the profile from
  // what the user just answered, so the rest of the app has its data.
  const profile: StudentProfile = existing
    ? {
        ...existing,
        grade: LEVEL_TO_GRADE[config.educationLevel] ?? existing.grade,
        country: seed.country ?? existing.country,
        degree: seed.degree ?? existing.degree,
        targetTier: seed.targetTier ?? existing.targetTier,
        testScores: { ...(existing.testScores ?? {}), ...(tests ?? {}) },
      }
    : {
        grade: LEVEL_TO_GRADE[config.educationLevel] ?? "late-hs",
        country: seed.country ?? "Bangladesh",
        degree: seed.degree ?? "undergrad",
        gpa: 3.5, // neutral default - refined on the account page
        ecs: [],
        targetTier: seed.targetTier ?? "top200",
        ...(tests ? { testScores: tests } : {}),
      };

  await upsertProfile(session.id, profile);

  const doc = await generateRoadmap(profile, config, { userId: session.id, language });
  await saveRoadmapV2(session.id, doc);
  return ok({ doc });
});

export const DELETE = withErrorHandling(async () => {
  const session = await requireSession();
  await deleteRoadmapV2(session.id);
  return ok({ doc: null });
});
