/**
 * Transcript stage of the interpreter pipeline.
 *
 *   Video -> [Transcript] -> Alignment -> Segmentation -> Translation -> Gestures -> Renderer
 *
 * A transcript is the only text the pipeline ever sees. Nothing downstream knows
 * where it came from - a caption file, a Polaris-authored companion track, a live
 * speech-synthesis boundary stream, or a model. That is what lets a real caption
 * API replace a provider without touching translation, sync, or rendering.
 */

/** Where the words in a track actually came from. Drives what we are allowed to claim in the UI. */
export type TranscriptOrigin =
  /** Verbatim text Polaris owns and plays itself (e.g. exam listening scripts). Word-accurate. */
  | "verbatim"
  /** Published caption/subtitle track fetched from the media host. Word-accurate. */
  | "published-captions"
  /** Editorially written companion track aligned to the lesson timeline. Not verbatim speech. */
  | "authored-companion"
  /** Model-generated. Useful, never authoritative. */
  | "ai-generated";

/** A single timed unit of text. The atom the whole pipeline is built on. */
export type TranscriptSegment = {
  id: string;
  /** Seconds from media start. */
  startTime: number;
  /** Seconds from media start. Always > startTime. */
  endTime: number;
  text: string;
  /** BCP-47 tag of the spoken language, e.g. "en-GB". */
  language?: string;
  /** Optional speaker label for multi-voice lessons. */
  speaker?: string;
  /**
   * 0-1 confidence in this segment's *timing*, not its wording.
   * Live sources emit low confidence until a boundary event confirms them.
   */
  confidence?: number;
};

/** A complete timed text track for one piece of media. */
export type TranscriptTrack = {
  /** Stable id of the media this track describes. */
  mediaId: string;
  origin: TranscriptOrigin;
  /** BCP-47 tag of the track as a whole. */
  language: string;
  segments: TranscriptSegment[];
  /** Total media duration in seconds when known. Used for progress and preloading. */
  duration?: number;
  /** Id of the provider that produced this track, for diagnostics and provenance display. */
  providerId: string;
  /** True when segments arrive incrementally and the track is not yet complete. */
  streaming?: boolean;
};

/** What a transcript provider is asked for. */
export type TranscriptRequest = {
  mediaId: string;
  /** Preferred spoken language as a BCP-47 tag. Providers may return a near match. */
  language?: string;
  /** Media duration in seconds when the caller already knows it. */
  duration?: number;
  /** Aborts in-flight fetches when the user switches lesson mid-load. */
  signal?: AbortSignal;
};

/** Why a provider declined, so the panel can render the right fallback instead of a generic error. */
export type TranscriptFailureReason =
  | "not-found"
  | "unsupported-media"
  | "network"
  | "unauthorized"
  | "aborted"
  | "unknown";

export class TranscriptUnavailableError extends Error {
  constructor(
    readonly reason: TranscriptFailureReason,
    readonly providerId: string,
    message?: string,
  ) {
    super(message ?? `Transcript unavailable (${reason}) from ${providerId}`);
    this.name = "TranscriptUnavailableError";
  }
}
