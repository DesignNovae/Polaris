import manifest from "@/data/interpreter/pregenerated.json";
import type { LiveSigningJob } from "./live";

/**
 * Lessons whose ASL signing was generated in advance by services/signing/export_static.py.
 *
 * Hosted demos have no GPU worker, so these play from static PLS2 files and every
 * other video says plainly that signing is not prepared. Set NEXT_PUBLIC_SIGNING_LIVE=1
 * where a signing worker is reachable to keep live generation for everything else.
 */
type Section = [start: number, end: number, frames: number, silence: boolean];
type Entry = { youtubeId: string; duration: number; chunkSeconds: number; steps: number; generatedAt: string; sections: Section[];
  /** The English each section was signed from, by section index; "" for silence. */
  captions?: string[] };

// JSON imports type tuples loosely; the export script is the source of this shape.
const videos: Record<string, Entry> = (manifest as unknown as { videos?: Record<string, Entry> }).videos ?? {};

export const LIVE_SIGNING_ENABLED = process.env.NEXT_PUBLIC_SIGNING_LIVE === "1";
export const PREGENERATED_SIGNING_IDS: ReadonlySet<string> = new Set(Object.keys(videos));
const base = (process.env.NEXT_PUBLIC_SIGNING_ASSET_BASE || "/signing").replace(/\/+$/, "");

export function hasPregeneratedSigning(mediaId: string) {
  return PREGENERATED_SIGNING_IDS.has(mediaId);
}

/** A ready job with every section available, in the shape the live player already consumes. */
export function pregeneratedJob(mediaId: string): LiveSigningJob | null {
  const entry = videos[mediaId];
  if (!entry) return null;
  return {
    id: "0".repeat(32), scope: { kind: "lesson" }, duration: entry.duration, chunkSeconds: entry.chunkSeconds,
    phase: "ready", error: null, language: "ase",
    chunks: Object.fromEntries(entry.sections.map(([start, end, frames, silence], index) =>
      [String(index), { start, end, frames, fps: 25, seconds: 0, silence, review: "unreviewed" as const }])),
  };
}

export function pregeneratedCaptions(mediaId: string): readonly string[] | null {
  return videos[mediaId]?.captions ?? null;
}

export function pregeneratedAssetUrl(mediaId: string, asset: string) {
  return asset === "topology" ? `${base}/topology.bin` : `${base}/${encodeURIComponent(mediaId)}/${asset}.pls2`;
}
