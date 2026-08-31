import type { NextRequest } from "next/server";
import { buildFallbackRoadmap } from "@/lib/fallback-roadmap";
import {
  generateRoadmap,
  getGemmaModelId,
  hasGemmaKey,
} from "@/lib/llm/gemma";
import { summarizeProfile, type StudentProfile } from "@/lib/profile";
import { searchDocs } from "@/lib/rag/search";
import { rateLimit, rateLimitHeaders } from "@/lib/ratelimit";
import { fail, parseJson, withErrorHandling } from "@/lib/api/respond";
import { studentProfileSchema } from "@/lib/validation/schemas";
import type { Lang } from "@/lib/i18n/strings";
import { BN_ERRORS, generationLanguageInstruction, requestLanguage } from "@/lib/i18n/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SYSTEM_PROMPT = `You are Polaris, a Gemma 4 academic strategist for students in Bangladesh who want to compete for global university admission and scholarships.

Create a realistic 6-18 month plan. Be specific, measurable, and sensitive to limited budgets and local access. Ground recommendations in the supplied retrieved evidence. Cover at least three categories. Mark only the highest-leverage actions as high priority. Every action must be something a student can begin this week. Do not invent a source or claim guaranteed admission. Use original wording and paraphrase all evidence; never reproduce source passages.`;

function promptFor(
  profile: StudentProfile,
  evidence: Array<{ title: string; source: string; text: string }>,
  language: Lang,
): string {
  const context = evidence
    .map((item, index) =>
      `[${index + 1}] ${item.title} (${item.source})\n${item.text}`,
    )
    .join("\n\n");

  return `${generationLanguageInstruction(language)}\n\nSTUDENT PROFILE\n${summarizeProfile(profile)}\n\nRETRIEVED EVIDENCE\n${context}\n\nReturn a structured roadmap with 8-12 milestones, 3-5 honest profile gaps, measurable success criteria, and source-aware rationales. Keep JSON keys and enum values exactly as required, but write all human-readable content in the selected language.`;
}

function clientId(req: NextRequest): string {
  const forwarded = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded || req.headers.get("x-real-ip") || "public-demo";
}

export const POST = withErrorHandling(async (req) => {
  const language = requestLanguage(req);
  const limit = await rateLimit(clientId(req), "free", "public-gemma4-demo");
  if (!limit.allowed) {
    const response = fail(429, language === "bn" ? BN_ERRORS.demoLimit : "Demo limit reached. Please retry in a few minutes.");
    for (const [key, value] of Object.entries(rateLimitHeaders(limit))) {
      response.headers.set(key, value);
    }
    return response;
  }

  const profile = studentProfileSchema.parse(await parseJson(req));
  const hits = await searchDocs(summarizeProfile(profile), null, 6);
  const retrieved = hits.map(({ id, title, source, score }) => ({
    id,
    title,
    source,
    score: Number(score.toFixed(3)),
  }));

  let roadmap = null;
  if (hasGemmaKey()) {
    try {
      roadmap = await generateRoadmap(
        `${SYSTEM_PROMPT}\n\n${generationLanguageInstruction(language)}`,
        promptFor(profile, hits, language),
      );
    } catch (error) {
      console.error("[public-demo] Gemma 4 request failed", error);
    }
  }

  const fallback = buildFallbackRoadmap(profile, hits.map((hit) => hit.title), language);
  const generatedMilestones = roadmap?.milestones.length ?? 0;
  const finalRoadmap = roadmap
    ? {
        ...roadmap,
        gaps: [...roadmap.gaps, ...fallback.gaps].slice(0, 3),
        milestones: [
          ...roadmap.milestones,
          ...fallback.milestones.filter(
            (item) => !roadmap.milestones.some((generated) => generated.title === item.title),
          ),
        ].slice(0, 8),
      }
    : fallback;
  const source = roadmap
    ? generatedMilestones >= 8 ? "gemma4" : "gemma4-hybrid"
    : "deterministic-fallback";
  const response = Response.json({
    roadmap: finalRoadmap,
    retrieved,
    trace: {
      source,
      model: roadmap ? getGemmaModelId() : "none",
      modelPolicy: "Polaris AI assistance",
      retrieval: "BM25 over curated admissions evidence",
      thinking: roadmap ? "minimal" : "not-applicable",
      generatedMilestones,
      deterministicMilestones: roadmap
        ? Math.max(0, 8 - generatedMilestones)
        : finalRoadmap.milestones.length,
    },
  });
  for (const [key, value] of Object.entries(rateLimitHeaders(limit))) {
    response.headers.set(key, value);
  }
  return response;
});
