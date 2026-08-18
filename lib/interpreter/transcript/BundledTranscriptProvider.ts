/**
 * Serves the Polaris-authored companion tracks that ship with the bundle.
 *
 * Zero network, zero latency, works offline. Ranked below verbatim sources and
 * above generated ones: the words are ours and the timings are deliberate, but
 * they describe the lesson rather than quoting it, and the panel says exactly
 * that.
 */

import type { TranscriptRequest, TranscriptTrack, TranscriptSegment } from "../types/transcript";
import { TranscriptUnavailableError } from "../types/transcript";
import { registerTranscriptProvider, type TranscriptProvider } from "./TranscriptProvider";
import { COMPANION_TRACKS } from "./data/lesson-transcripts";

function toSegments(mediaId: string, track: (typeof COMPANION_TRACKS)[string]): TranscriptSegment[] {
  return track.cues.map((cue, index) => ({
    id: `${mediaId}:c${index}`,
    startTime: cue.at,
    endTime: cue.until,
    text: cue.text,
    language: track.language,
    confidence: 1,
  }));
}

export const BundledTranscriptProvider: TranscriptProvider = {
  id: "polaris-companion",
  label: "Polaris companion track",
  origin: "authored-companion",
  rank: 60,
  canServe: (request: TranscriptRequest) =>
    Object.prototype.hasOwnProperty.call(COMPANION_TRACKS, request.mediaId),
  getTranscript: async (request: TranscriptRequest): Promise<TranscriptTrack> => {
    const source = COMPANION_TRACKS[request.mediaId];
    if (!source) throw new TranscriptUnavailableError("not-found", "polaris-companion");
    return {
      mediaId: request.mediaId,
      origin: "authored-companion",
      language: source.language,
      segments: toSegments(request.mediaId, source),
      duration: request.duration || source.duration,
      providerId: "polaris-companion",
    };
  },
};

registerTranscriptProvider(BundledTranscriptProvider);
