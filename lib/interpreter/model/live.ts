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
export type LiveSigningInput = { kind: "youtube"; videoId: string } | { kind: "job"; jobId: string }
  /** Signing generated in advance (lib/interpreter/model/pregenerated.ts); no worker involved. */
  | { kind: "static"; mediaId: string };
export type MeshChunk = { index: number; start: number; end: number; frames: number; vertices: number; fps: number; positions: Float32Array };

const PLS1 = 0x31534c50, PLS2 = 0x32534c50;

// PLS1 is raw float32 vertices. PLS2 (services/signing/compact.py) is the hosted transport:
// 0.2 mm grid positions predicted from the two previous frames and the preceding vertex,
// stored as 16-bit residuals in byte planes, zlib-compressed.
export async function parseMeshChunk(buffer: ArrayBuffer, index: number, start: number, end: number): Promise<MeshChunk> {
  if (buffer.byteLength < 16) throw new Error("Incomplete signing animation");
  const header = new DataView(buffer);
  const magic = header.getUint32(0, true);
  if (magic !== PLS1 && magic !== PLS2) throw new Error("Invalid signing animation format");
  const frames = header.getUint32(4, true), vertices = header.getUint32(8, true), fps = header.getUint32(12, true);
  if (vertices !== 10475 || frames < 1 || frames > 304 || fps !== 25) throw new Error("Invalid signing animation dimensions");
  const count = frames * vertices * 3;
  let positions: Float32Array;
  if (magic === PLS1) {
    if (buffer.byteLength !== 16 + count * 4) throw new Error("Invalid signing animation dimensions");
    positions = new Float32Array(buffer, 16);
  } else {
    if (buffer.byteLength < 40) throw new Error("Incomplete signing animation");
    const low = [0, 1, 2].map((axis) => header.getFloat32(16 + axis * 4, true));
    const step = [0, 1, 2].map((axis) => header.getFloat32(28 + axis * 4, true));
    const planes = await inflate(new Uint8Array(buffer, 40));
    if (planes.length !== count * 2) throw new Error("Invalid signing animation dimensions");
    positions = new Float32Array(count);
    // Int16Array stores wrap at 16 bits exactly like the encoder's arithmetic.
    const perFrame = vertices * 3, second = new Int16Array(perFrame), first = new Int16Array(perFrame), value = new Int16Array(perFrame);
    for (let frame = 0, k = 0; frame < frames; frame++) {
      for (let i = 0; i < perFrame; i++, k++) {
        const residual = ((planes[k] | (planes[count + k] << 8)) << 16) >> 16;
        second[i] = i >= 3 ? residual + second[i - 3] : residual;
        first[i] = frame >= 2 ? second[i] + first[i] : second[i];
        value[i] = frame >= 1 ? first[i] + value[i] : first[i];
        positions[k] = low[i % 3] + (value[i] + 32768) * step[i % 3];
      }
    }
  }
  if (positions.some((value) => !Number.isFinite(value) || Math.abs(value) > 10)) throw new Error("Invalid signing geometry");
  return { index, start, end, frames, vertices, fps, positions };
}

async function inflate(bytes: Uint8Array<ArrayBuffer>) {
  try {
    const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream("deflate"));
    return new Uint8Array(await new Response(stream).arrayBuffer());
  } catch {
    throw new Error("Invalid signing animation format");
  }
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
