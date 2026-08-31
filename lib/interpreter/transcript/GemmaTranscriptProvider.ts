/**
 * Last resort in the transcript chain: asks Gemma for a lesson outline when no
 * authored or verbatim track exists.
 *
 * This provider is honest about what it is. Gemma has not heard the audio; it is
 * writing a study outline from the lesson title, exam, and topic. That is useful
 * - it is still true information about the subject - but it is not a transcript,
 * so it is tagged `ai-generated`, ranked last, and labelled as generated wherever
 * it surfaces.
 */

import type { TranscriptRequest, TranscriptTrack, TranscriptSegment } from "../types/transcript";
import { TranscriptUnavailableError } from "../types/transcript";
import { registerTranscriptProvider, type TranscriptProvider } from "./TranscriptProvider";
import { getMedia } from "./mediaRegistry";
import { gemmaHeaders } from "@/lib/gemma/browser-key";

const cache = new Map<string, TranscriptTrack>();

type OutlineResponse = { cues?: Array<{ at?: number; until?: number; text?: string }> };

export const GemmaTranscriptProvider: TranscriptProvider = {
  id: "gemma-outline",
  label: "Gemma lesson outline (generated)",
  origin: "ai-generated",
  rank: 20,
  canServe: (request: TranscriptRequest) => Boolean(getMedia(request.mediaId)),
  getTranscript: async (request: TranscriptRequest): Promise<TranscriptTrack> => {
    const cached = cache.get(request.mediaId);
    if (cached) return cached;

    const media = getMedia(request.mediaId);
    if (!media) throw new TranscriptUnavailableError("not-found", "gemma-outline");

    let payload: OutlineResponse;
    try {
      const response = await fetch("/api/interpreter", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...gemmaHeaders() },
        body: JSON.stringify({
          kind: "outline",
          mediaId: request.mediaId,
          duration: Math.max(60, Math.round(request.duration || media.duration || 300)),
          title: media.title,
          topic: media.topic,
          exam: media.exam,
          source: media.source,
        }),
        signal: request.signal,
      });
      if (response.status === 401 || response.status === 403) {
        throw new TranscriptUnavailableError("unauthorized", "gemma-outline");
      }
      if (!response.ok) throw new TranscriptUnavailableError("network", "gemma-outline");
      payload = (await response.json()) as OutlineResponse;
    } catch (error) {
      if (error instanceof TranscriptUnavailableError) throw error;
      if (error instanceof DOMException && error.name === "AbortError") {
        throw new TranscriptUnavailableError("aborted", "gemma-outline");
      }
      throw new TranscriptUnavailableError("network", "gemma-outline");
    }

    const cues = (payload.cues ?? []).filter(
      (cue): cue is { at: number; until: number; text: string } =>
        typeof cue.at === "number" && typeof cue.until === "number" && typeof cue.text === "string" && cue.text.trim().length > 0,
    );
    if (cues.length === 0) throw new TranscriptUnavailableError("not-found", "gemma-outline", "Gemma returned no usable cues");

    const segments: TranscriptSegment[] = cues.map((cue, index) => ({
      id: `${request.mediaId}:g${index}`,
      startTime: cue.at,
      endTime: cue.until,
      text: cue.text.trim(),
      // Generated timings are a guess at pacing, not an observation of the audio.
      confidence: 0.4,
    }));

    const track: TranscriptTrack = {
      mediaId: request.mediaId,
      origin: "ai-generated",
      language: "en",
      segments,
      duration: request.duration,
      providerId: "gemma-outline",
    };
    cache.set(request.mediaId, track);
    return track;
  },
};

registerTranscriptProvider(GemmaTranscriptProvider);
