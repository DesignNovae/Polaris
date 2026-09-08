import { z } from "zod";

export const liveJobSchema = z.object({
  id: z.string().regex(/^[a-f0-9]{32}$/),
  scope: z.discriminatedUnion("kind", [z.object({ kind: z.literal("lesson") }),
    z.object({ kind: z.literal("exam"), sessionId: z.string().regex(/^[a-f\d]{24}$/i), part: z.string().regex(/^part-[1-4]$/) })]),
  duration: z.number().min(0).max(7200), chunkSeconds: z.number().positive().max(12),
  phase: z.enum(["receiving", "queued", "downloading", "transcribing", "generating", "ready", "failed", "cancelled"]),
  error: z.string().nullable(), language: z.literal("ase"),
  chunks: z.record(z.string().regex(/^\d{1,3}$/), z.object({
    start: z.number().nonnegative(), end: z.number().positive(), frames: z.number().int().min(1).max(304),
    fps: z.number().min(20).max(60), seconds: z.number().nonnegative(), silence: z.boolean(),
    review: z.literal("unreviewed"),
  })),
});
export type LiveSigningJob = z.infer<typeof liveJobSchema>;
export type LiveSigningInput = { kind: "youtube"; videoId: string } | { kind: "job"; jobId: string };
export type MeshChunk = { index: number; start: number; end: number; frames: number; vertices: number; fps: number; positions: Float32Array };

export function parseMeshChunk(buffer: ArrayBuffer, index: number, start: number, end: number): MeshChunk {
  if (buffer.byteLength < 16) throw new Error("Incomplete signing animation");
  const header = new DataView(buffer);
  if (header.getUint32(0, true) !== 0x31534c50) throw new Error("Invalid signing animation format");
  const frames = header.getUint32(4, true), vertices = header.getUint32(8, true), fps = header.getUint32(12, true);
  if (vertices !== 10475 || frames < 1 || frames > 304 || fps !== 25 || buffer.byteLength !== 16 + frames * vertices * 12) {
    throw new Error("Invalid signing animation dimensions");
  }
  const positions = new Float32Array(buffer, 16);
  if (positions.some((value) => !Number.isFinite(value) || Math.abs(value) > 10)) throw new Error("Invalid signing geometry");
  return { index, start, end, frames, vertices, fps, positions };
}

export function signingChunkIndex(time: number, duration: number, seconds = 8) {
  return Math.min(Math.max(0, Math.floor(time / seconds)), Math.max(0, Math.ceil(duration / seconds) - 1));
}

export function youtubeVideoId(input: string): string | null {
  if (/^[\w-]{11}$/.test(input.trim())) return input.trim();
  try {
    const url = new URL(input);
    if (url.protocol !== "https:") return null;
    const host = url.hostname.replace(/^www\./, "");
    const value = host === "youtu.be" ? url.pathname.slice(1)
      : ["youtube.com", "m.youtube.com"].includes(host) ? (url.searchParams.get("v") || url.pathname.match(/^\/(?:shorts|embed)\/([\w-]{11})$/)?.[1]) : null;
    return value && /^[\w-]{11}$/.test(value) ? value : null;
  } catch { return null; }
}
