import { summarizeProfile, type StudentProfile } from "@/lib/profile";
import { searchDocs } from "@/lib/rag/search";
import { generateRoadmap, hasGemmaKey } from "@/lib/llm/gemma";
import { buildFallbackRoadmap } from "@/lib/fallback-roadmap";
import { ok, withErrorHandling, parseJson } from "@/lib/api/respond";
import { requireSession } from "@/lib/authz";
import { roadmapBodySchema } from "@/lib/validation/schemas";
import {
  upsertProfile,
  saveRoadmap,
  getLatestRoadmap,
  toDbMilestones,
} from "@/lib/db/collections";
import type { Lang } from "@/lib/i18n/strings";
import { generationLanguageInstruction, requestLanguage } from "@/lib/i18n/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SYSTEM_PROMPT = `You are Polaris - an AI academic strategist trained on global admissions data and Bangladesh-context student journeys. You build pragmatic, reverse-engineered 6–18 month roadmaps.

Your roadmaps must be:
- specific, measurable, and time-bounded (quarter or month range per milestone)
- grounded in the retrieved knowledge base: reference specific universities, scholarships, or case-study patterns by name where relevant
- balanced across at least 3 of: Academics, Testing, Extracurriculars, Skills, Applications
- prioritized - flag the 2–3 highest-leverage moves with priority "high"
- frank about gaps - call out what successful applicants like this student had that they currently lack

Tone: confident, kind, action-oriented. Avoid generic platitudes. Every milestone must pass the test: "Could a 17-year-old in Dhaka start this on Monday morning?"`;

function buildUserPrompt(
  profile: StudentProfile,
  retrieved: Array<{ title: string; source: string; text: string }>,
  completedTitles?: string[],
  language: Lang = "en",
): string {
  const kb = retrieved
    .map((r, i) => `[${i + 1}] (${r.source}) ${r.title}\n${r.text}`)
    .join("\n\n");

  let prompt = `${generationLanguageInstruction(language)}

STUDENT PROFILE:
${summarizeProfile(profile)}

RETRIEVED KNOWLEDGE BASE (top matches by deterministic BM25 relevance):
${kb}

Generate a structured roadmap of 8–12 milestones for this student over the next 6–18 months. Reference specific universities or case studies from the KB by name in your rationales where it strengthens the argument.`;

  if (completedTitles && completedTitles.length > 0) {
    prompt += `\n\nPREVIOUSLY COMPLETED MILESTONES (adapt the new roadmap accordingly - build on progress, don't repeat):
${completedTitles.map((t) => `- ${t}`).join("\n")}`;
  }

  return prompt;
}

export const GET = withErrorHandling(async () => {
  const user = await requireSession();
  const roadmap = await getLatestRoadmap(user.id);
  if (!roadmap) {
    return ok({ roadmap: null });
  }
  return ok(roadmap);
});

export const POST = withErrorHandling(async (req) => {
  // Roadmap generation is part of the Free plan (matches the catalog +
  // the v2 engine, which is session-gated and rate-limited).
  const language = requestLanguage(req);
  const user = await requireSession();
  const { profile } = roadmapBodySchema.parse(await parseJson(req));

  await upsertProfile(user.id, profile);

  // Adaptive replanning (building on completed milestones) is Elite-only.
  let completedTitles: string[] = [];
  if (user.plan === "elite") {
    const prev = await getLatestRoadmap(user.id);
    if (prev) {
      completedTitles = prev.roadmap.milestones
        .filter((m) => m.status === "done")
        .map((m) => m.title);
    }
  }

  const profileSummary = summarizeProfile(profile);
  const hits = await searchDocs(profileSummary, null, 6);

  const retrievedMeta = hits.map(({ id, title, source, score }) => ({
    id,
    title,
    source,
    score,
  }));

  if (!hasGemmaKey()) {
    const roadmap = buildFallbackRoadmap(
      profile,
      hits.map((h) => h.title),
      language,
    );
    const result = {
      roadmap: { ...roadmap, milestones: toDbMilestones(roadmap.milestones) },
      retrieved: retrievedMeta,
      source: "fallback" as const,
    };
    await saveRoadmap(user.id, result);
    return ok(result);
  }

  const userPrompt = buildUserPrompt(profile, hits, completedTitles, language);
  let roadmap;
  try {
    roadmap = await generateRoadmap(
      `${SYSTEM_PROMPT}\n\n${generationLanguageInstruction(language)}`,
      userPrompt,
    );
  } catch {
    roadmap = null;
  }

  if (roadmap && (roadmap.milestones.length < 8 || roadmap.gaps.length < 3)) {
    const deterministic = buildFallbackRoadmap(
      profile,
      hits.map((hit) => hit.title),
      language,
    );
    roadmap = {
      ...roadmap,
      gaps: [...roadmap.gaps, ...deterministic.gaps].slice(0, 3),
      milestones: [
        ...roadmap.milestones,
        ...deterministic.milestones.filter(
          (item) => !roadmap!.milestones.some((generated: { title: string }) => generated.title === item.title),
        ),
      ].slice(0, 8),
    };
  }

  if (!roadmap) {
    const fb = buildFallbackRoadmap(
      profile,
      hits.map((h) => h.title),
      language,
    );
    const result = {
      roadmap: { ...fb, milestones: toDbMilestones(fb.milestones) },
      retrieved: retrievedMeta,
      source: "fallback" as const,
    };
    await saveRoadmap(user.id, result);
    return ok(result);
  }

  const result = {
    roadmap: { ...roadmap, milestones: toDbMilestones(roadmap.milestones) },
    retrieved: retrievedMeta,
    source: "gemma4" as const,
  };
  await saveRoadmap(user.id, result);
  return ok(result);
});

