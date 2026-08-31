/**
 * Verbatim tracks for media Polaris itself renders.
 *
 * The IELTS listening player speaks a script Polaris wrote, through the browser
 * speech synthesiser. We therefore know the words exactly - there is nothing to
 * transcribe and nothing to guess. The caller registers the script, this provider
 * serves it as `verbatim`, and it outranks every inferred source.
 *
 * Timing here is an estimate refined at runtime: the clock source re-anchors on
 * every real `boundary` event from the synthesiser, so the words are exact and the
 * alignment converges on the truth within the first phrase.
 */

import type { TranscriptRequest, TranscriptTrack, TranscriptSegment } from "../types/transcript";
import { TranscriptUnavailableError } from "../types/transcript";
import { registerTranscriptProvider, type TranscriptProvider } from "./TranscriptProvider";
import { splitIntoSegments } from "../segmentation/segmentText";

const registry = new Map<string, TranscriptTrack>();

/**
 * Average speaking rate of the Web Speech synthesiser at rate 1.0, in characters
 * per second. Measured across the en-GB voices Chrome and Edge ship by default.
 * Only used for the initial estimate; boundary events correct it immediately.
 */
const SYNTH_CHARS_PER_SECOND = 14.2;

export function estimateSpokenDuration(text: string, rate = 1): number {
  return text.length / (SYNTH_CHARS_PER_SECOND * rate);
}

/**
 * Registers a verbatim script for a media id and returns the timed track.
 *
 * Called by any surface that owns its own audio. Registration is idempotent, so a
 * re-render with the same script does not rebuild the timeline.
 */
export function registerVerbatimScript(options: {
  mediaId: string;
  script: string;
  language: string;
  rate?: number;
}): TranscriptTrack {
  const existing = registry.get(options.mediaId);
  if (existing && existing.segments.map((segment) => segment.text).join(" ") === options.script.trim()) {
    return existing;
  }

  const rate = options.rate ?? 1;
  const pieces = splitIntoSegments(options.script);
  const totalChars = pieces.reduce((total, piece) => total + piece.length, 0) || 1;
  const totalDuration = estimateSpokenDuration(options.script, rate);

  let cursor = 0;
  const segments: TranscriptSegment[] = pieces.map((text, index) => {
    const share = (text.length / totalChars) * totalDuration;
    const segment: TranscriptSegment = {
      id: `${options.mediaId}:v${index}`,
      startTime: cursor,
      endTime: cursor + share,
      text,
      language: options.language,
      confidence: 1,
    };
    cursor += share;
    return segment;
  });

  const track: TranscriptTrack = {
    mediaId: options.mediaId,
    origin: "verbatim",
    language: options.language,
    segments,
    duration: totalDuration,
    providerId: RuntimeTranscriptProvider.id,
  };
  registry.set(options.mediaId, track);
  return track;
}

export function clearVerbatimScript(mediaId: string): void {
  registry.delete(mediaId);
}

export const RuntimeTranscriptProvider: TranscriptProvider = {
  id: "polaris-verbatim",
  label: "Polaris script (verbatim)",
  origin: "verbatim",
  rank: 100,
  canServe: (request: TranscriptRequest) => registry.has(request.mediaId),
  getTranscript: async (request: TranscriptRequest) => {
    const track = registry.get(request.mediaId);
    if (!track) throw new TranscriptUnavailableError("not-found", "polaris-verbatim");
    return track;
  },
};

registerTranscriptProvider(RuntimeTranscriptProvider);
