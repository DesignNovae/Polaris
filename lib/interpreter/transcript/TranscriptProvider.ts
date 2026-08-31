/**
 * Transcript provider contract and resolution chain.
 *
 * Providers are ranked and tried in order. The first one that returns a usable
 * track wins; the rest are never consulted. Adding a real caption API later means
 * registering one more provider at a higher rank - no other file changes.
 */

import type {
  TranscriptRequest,
  TranscriptTrack,
  TranscriptOrigin,
} from "../types/transcript";
import { TranscriptUnavailableError } from "../types/transcript";
import { normalizeSegments } from "../utils/timeline";

export interface TranscriptProvider {
  readonly id: string;
  /** Shown in the provenance readout, e.g. "Polaris companion track". */
  readonly label: string;
  readonly origin: TranscriptOrigin;
  /**
   * Higher wins. Word-accurate sources rank above editorial ones, which rank
   * above generated ones. Ties resolve by registration order.
   */
  readonly rank: number;
  /** Cheap synchronous check so the chain skips providers that cannot serve this media. */
  canServe(request: TranscriptRequest): boolean;
  /** Resolve a track, or throw TranscriptUnavailableError. */
  getTranscript(request: TranscriptRequest): Promise<TranscriptTrack>;
}

const providers = new Map<string, TranscriptProvider>();

export function registerTranscriptProvider(provider: TranscriptProvider): void {
  providers.set(provider.id, provider);
}

export function listTranscriptProviders(): TranscriptProvider[] {
  return [...providers.values()].sort((a, b) => b.rank - a.rank);
}

export function getTranscriptProvider(id: string): TranscriptProvider | undefined {
  return providers.get(id);
}

/**
 * Walks the chain and returns the first usable track.
 *
 * A provider throwing is expected, not exceptional - "this lesson has no
 * captions" is the normal case for most media. Only an empty chain is an error,
 * and it surfaces as `not-found` so the panel renders the no-transcript state
 * rather than a crash.
 */
export async function resolveTranscript(request: TranscriptRequest): Promise<TranscriptTrack> {
  const chain = listTranscriptProviders().filter((provider) => provider.canServe(request));
  const failures: string[] = [];

  for (const provider of chain) {
    if (request.signal?.aborted) {
      throw new TranscriptUnavailableError("aborted", provider.id);
    }
    try {
      const track = await provider.getTranscript(request);
      const segments = normalizeSegments(track.segments);
      if (segments.length === 0) {
        failures.push(`${provider.id}: empty`);
        continue;
      }
      return { ...track, segments, providerId: provider.id };
    } catch (error) {
      if (error instanceof TranscriptUnavailableError && error.reason === "aborted") throw error;
      failures.push(`${provider.id}: ${error instanceof Error ? error.message : "failed"}`);
    }
  }

  throw new TranscriptUnavailableError(
    "not-found",
    "chain",
    failures.length ? `No transcript source succeeded (${failures.join("; ")})` : "No transcript source is registered for this media",
  );
}
