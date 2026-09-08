import { z } from "zod";

/** Prepared motion is a different artifact from the procedural SVG preview. */
export const signingLanguageSchema = z.enum(["ase", "bfi", "ins"]);
const hash = z.string().regex(/^[a-f0-9]{64}$/);

export const signingAssetSchema = z.object({
  id: hash,
  mediaId: z.string().min(1).max(120),
  language: signingLanguageSchema,
  scope: z.enum(["lesson", "exam"]),
  model: z.string().min(1).max(80),
  checkpoint: z.string().min(1).max(160),
  // Hash the source audio for an exam, or the approved timed transcript for a lesson.
  sourceHash: hash,
  sourceOrigin: z.enum(["verbatim", "published-captions"]),
  duration: z.number().positive().max(7200),
  fps: z.number().min(20).max(60),
  offset: z.number().min(-60).max(60).default(0),
  includes: z.object({ hands: z.literal(true), body: z.literal(true), face: z.literal(true) }),
  review: z.discriminatedUnion("status", [
    z.object({ status: z.literal("unreviewed") }),
    z.object({
      status: z.literal("reviewed"),
      reviewer: z.string().min(2).max(120),
      reviewedAt: z.string().datetime(),
    }),
  ]),
}).strict().superRefine((asset, ctx) => {
  const examId = /^ielts-listening:part-[1-4]$/.test(asset.mediaId);
  if ((asset.scope === "exam") !== examId || (asset.scope === "lesson" && asset.mediaId.startsWith("exam-listening:"))) {
    ctx.addIssue({ code: "custom", message: "Exam tracks require an IELTS part id and exam scope" });
  }
  if (asset.scope === "exam" && asset.sourceOrigin !== "verbatim") {
    ctx.addIssue({ code: "custom", message: "Exam tracks must use the exact recording script" });
  }
});

export const signingManifestSchema = z.object({
  version: z.literal(1),
  tracks: z.array(signingAssetSchema).max(5000),
}).strict().superRefine(({ tracks }, ctx) => {
  const keys = new Set<string>();
  for (const track of tracks) {
    const key = `${track.mediaId}:${track.language}`;
    if (keys.has(key)) ctx.addIssue({ code: "custom", message: `Duplicate signing track: ${key}` });
    keys.add(key);
  }
});

export type SigningAsset = z.infer<typeof signingAssetSchema>;
export type PreparedSigningTrack = Pick<SigningAsset, "id" | "mediaId" | "language" | "model" | "duration" | "offset" | "review"> & { src: string };

/** Parse one HTTP byte range. Multi-range requests are deliberately unsupported. */
export function parseVideoRange(header: string | null, size: number): { start: number; end: number } | null | "invalid" {
  if (!header) return null;
  const match = /^bytes=(\d*)-(\d*)$/.exec(header);
  if (!match || (!match[1] && !match[2]) || size <= 0) return "invalid";
  const start = match[1] ? Number(match[1]) : Math.max(0, size - Number(match[2]));
  const end = match[1] && match[2] ? Math.min(size - 1, Number(match[2])) : size - 1;
  if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start > end || start >= size || (!match[1] && Number(match[2]) <= 0)) return "invalid";
  return { start, end };
}

/** Pure access policy; the caller must first load the session for the signed-in owner. */
export function canReadExamSigning(session: {
  mode: string; status: string; expiresAt: string; playedAudioParts: string[];
  items: Array<{ stimulus?: { mediaUrl?: string } | null }>;
}, part: string, assetRequest: boolean, now = Date.now()): boolean {
  return /^part-[1-4]$/.test(part)
    && session.mode === "ielts-listening"
    && session.status === "in_progress"
    && new Date(session.expiresAt).getTime() > now
    && session.items.some((item) => item.stimulus?.mediaUrl === part)
    && (!assetRequest || session.playedAudioParts.includes(part));
}
