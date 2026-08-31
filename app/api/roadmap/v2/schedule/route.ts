/**
 * POST /api/roadmap/v2/schedule
 *
 * Explicitly upgrades a legacy flat roadmap or expands one deferred unit/year.
 * Nothing is saved until the requested schedule has been fully built, so a
 * failed upgrade cannot damage the user's existing roadmap.
 */

import { NextResponse } from "next/server";
import { z } from "zod";
import { ok, fail, withErrorHandling, parseJson } from "@/lib/api/respond";
import { requireSession } from "@/lib/authz";
import { rateLimit, rateLimitHeaders } from "@/lib/ratelimit";
import { getProfile, getRoadmapV2, saveRoadmapV2 } from "@/lib/db/collections";
import { buildLegacySchedule, generateDeferredSchedule, generateDeferredUnit } from "@/lib/roadmap/schedule";
import { requestLanguage, BN_ERRORS } from "@/lib/i18n/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

const BodySchema = z.object({
  upgradeLegacy: z.boolean().optional(),
  yearIndex: z.number().int().min(1).max(9).optional(),
  unitIndex: z.number().int().min(0).max(364).optional(),
});

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

  const body = BodySchema.parse(await parseJson(req));
  const previous = await getRoadmapV2(session.id);
  if (!previous) return fail(404, "No roadmap yet");
  const profile = await getProfile(session.id);
  if (!profile) return fail(400, "Complete your profile before building a schedule");

  const next = body.upgradeLegacy
    ? await buildLegacySchedule(profile, previous, { userId: session.id, language })
    : body.unitIndex !== undefined
      ? await generateDeferredUnit(profile, previous, body.unitIndex, { userId: session.id, language })
      : await generateDeferredSchedule(profile, previous, body.yearIndex ?? 1, { userId: session.id, language });

  await saveRoadmapV2(session.id, next);
  return ok({ doc: next });
});
