import type { NextRequest } from "next/server";
import { z } from "zod";
import { ok, parseJson, withErrorHandling } from "@/lib/api/respond";
import { rateLimit, rateLimitHeaders } from "@/lib/ratelimit";
import { RoadmapConfigSchema, type EducationLevel } from "@/lib/roadmap/types";
import { generateRoadmap } from "@/lib/roadmap/generate";
import type { GradeLevel, StudentProfile } from "@/lib/profile";
import { BN_ERRORS, requestLanguage } from "@/lib/i18n/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 90;

const ProfileSeedSchema = z.object({
  country: z.enum(["Bangladesh", "India", "Pakistan", "Nepal", "Other South Asia", "Other"]).optional(),
  degree: z.enum(["undergrad", "masters", "phd", "undecided"]).optional(),
  targetTier: z.enum(["elite", "top50", "top200", "regional"]).optional(),
});
const LEVEL_TO_GRADE: Record<EducationLevel, GradeLevel> = {
  "early-school": "middle", "middle-school": "middle", ssc: "early-hs",
  hsc: "late-hs", "gap-applicant": "recent-grad",
};
function clientId(req: NextRequest) { return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || "public-roadmap"; }

export const POST = withErrorHandling(async (req) => {
  const language = requestLanguage(req);
  const limit = await rateLimit(clientId(req), "free", "public-gemma4-roadmap-v2");
  if (!limit.allowed) return Response.json({ error: language === "bn" ? BN_ERRORS.demoLimit : "Public generation limit reached. Please retry in a few minutes." }, { status: 429, headers: rateLimitHeaders(limit) });
  const body = (await parseJson(req)) as Record<string, unknown>;
  const config = RoadmapConfigSchema.parse(body);
  const seed = ProfileSeedSchema.parse(body.profileSeed ?? {});
  const profile: StudentProfile = {
    grade: LEVEL_TO_GRADE[config.educationLevel], country: seed.country ?? "Bangladesh",
    degree: seed.degree ?? "undergrad", gpa: 3.8, ecs: ["Community"],
    targetTier: seed.targetTier ?? "elite",
    testScores: {
      ...(typeof config.currentScores?.["sat-total"] === "number" ? { SAT: config.currentScores["sat-total"] } : {}),
      ...(typeof config.currentScores?.["ielts-overall"] === "number" ? { IELTS: config.currentScores["ielts-overall"] } : {}),
    },
  };
  const doc = await generateRoadmap(profile, config, { language });
  return Response.json({ doc }, { headers: rateLimitHeaders(limit) });
});

export const GET = withErrorHandling(async () => ok({ doc: null }));
export const DELETE = withErrorHandling(async () => ok({ doc: null }));
