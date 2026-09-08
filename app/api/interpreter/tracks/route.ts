import type { NextRequest } from "next/server";
import { z } from "zod";
import { requireSession } from "@/lib/authz";
import { HttpError, withErrorHandling } from "@/lib/api/respond";
import { findSigningAsset, signingAssetPath, signingVideoResponse } from "@/lib/interpreter/model/assets";
import { canReadExamSigning, signingLanguageSchema, type PreparedSigningTrack } from "@/lib/interpreter/model/manifest";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const querySchema = z.object({
  mediaId: z.string().min(1).max(120), language: signingLanguageSchema,
  sessionId: z.string().regex(/^[a-f\d]{24}$/i).optional(),
  asset: z.literal("1").optional(),
});

export const GET = withErrorHandling(async (req: NextRequest) => {
  const user = await requireSession();
  const query = querySchema.parse(Object.fromEntries(req.nextUrl.searchParams));
  // Authorize exam ids even when their manifest entry is absent.
  if (query.mediaId.startsWith("ielts-listening:")) {
    if (!query.sessionId) throw new HttpError(403, "Open this signing track inside its exam session.");
    const { getPublicExamSession } = await import("@/lib/exams/service");
    const session = await getPublicExamSession(user.id, query.sessionId);
    if (!canReadExamSigning(session, query.mediaId.split(":")[1], Boolean(query.asset))) {
      throw new HttpError(403, "This signing track is only available with its active listening recording.");
    }
  }
  const asset = await findSigningAsset(query.mediaId, query.language);
  if (!asset) return Response.json({ track: null }, { headers: { "Cache-Control": "private, no-store" } });
  if (query.asset) return signingVideoResponse(asset, req.headers.get("range"));
  await signingAssetPath(asset);
  const params = new URLSearchParams({ mediaId: asset.mediaId, language: asset.language, asset: "1" });
  if (query.sessionId) params.set("sessionId", query.sessionId);
  const track: PreparedSigningTrack = {
    id: asset.id, mediaId: asset.mediaId, language: asset.language, model: asset.model,
    duration: asset.duration, offset: asset.offset, review: asset.review,
    src: `/api/interpreter/tracks?${params}`,
  };
  return Response.json({ track }, { headers: { "Cache-Control": "private, no-store" } });
});
