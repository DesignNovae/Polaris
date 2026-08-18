"use client";

/**
 * Pipeline orchestration hook.
 *
 *   Transcript -> Segmentation -> Translation -> Gesture timeline
 *
 * Every stage stays behind its own interface; this hook only sequences them and
 * maps failures onto the states the panel knows how to render.
 *
 * Translation runs in two phases, which is what makes the feature feel realtime
 * rather than "wait, then sign":
 *
 *   1. The rule engine translates synchronously. It needs no network and no key,
 *      so the interpreter starts signing on the same frame the transcript lands.
 *   2. If a stronger provider exists, it translates in the background and the
 *      timeline is swapped underneath. Playback is not interrupted - the new
 *      timeline is read from the same media clock, so the hands simply get better.
 *
 * A viewer never waits on a model to see signing, and never gets stuck with the
 * weaker output when a better one is available.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import { GestureTimeline } from "../render/GestureTimeline";
import { resolveTranscript } from "../transcript/TranscriptProvider";
import { TranscriptUnavailableError } from "../types/transcript";
import {
  RuleBasedTranslationProvider,
} from "../translation/RuleBasedTranslationProvider";
import {
  selectTranslationProvider,
  translateSegments,
  type TranslationRequest,
} from "../translation/SignTranslationProvider";
import { MACHINE_SYNTHETIC, type SignLanguageCode, type SignSequence } from "../types/gestures";
import {
  IDLE_TRANSLATION_STATE,
  type InterpreterStatus,
  type TranslationState,
} from "../types/interpreter";

export type GestureTimelineOptions = {
  /** Stable id of the media being interpreted. */
  mediaId: string | null;
  language: SignLanguageCode;
  enabled: boolean;
  /** Media duration in seconds when known. Helps generated providers pace output. */
  duration?: number;
  /** Localised copy for each failure state. */
  messages: Record<Exclude<InterpreterStatus, "ready" | "disabled">, string>;
};

export type GestureTimelineResult = TranslationState & {
  timeline: GestureTimeline;
  /** Forces a re-run, for the retry affordance on the error states. */
  retry: () => void;
};

const EMPTY = new GestureTimeline([]);

export function useGestureTimeline(options: GestureTimelineOptions): GestureTimelineResult {
  const { mediaId, language, enabled, duration, messages } = options;

  const [state, setState] = useState<TranslationState>(IDLE_TRANSLATION_STATE);
  const [attempt, setAttempt] = useState(0);

  // Messages arrive as a fresh object each render from the parent's copy table.
  // Reading them through a ref keeps them out of the effect's dependency list,
  // which would otherwise restart the whole pipeline on every parent render.
  const messagesRef = useRef(messages);
  messagesRef.current = messages;

  useEffect(() => {
    if (!enabled || !mediaId) {
      setState(IDLE_TRANSLATION_STATE);
      return;
    }

    const controller = new AbortController();
    let cancelled = false;

    const fail = (status: Exclude<InterpreterStatus, "ready" | "disabled">) => {
      if (cancelled) return;
      setState({ ...IDLE_TRANSLATION_STATE, status, message: messagesRef.current[status] });
    };

    void (async () => {
      setState({ ...IDLE_TRANSLATION_STATE, status: "loading-transcript", message: messagesRef.current["loading-transcript"] });

      let track;
      try {
        track = await resolveTranscript({ mediaId, duration, signal: controller.signal });
      } catch (error) {
        if (cancelled) return;
        if (error instanceof TranscriptUnavailableError && error.reason === "aborted") return;
        fail("no-transcript");
        return;
      }
      if (cancelled) return;

      if (!selectTranslationProvider(language)) {
        fail("unsupported-language");
        return;
      }

      const requests: TranslationRequest[] = track.segments.map((segment) => ({
        segment,
        language,
        signal: controller.signal,
      }));

      // Phase 1 - instant, deterministic, no network.
      let sequences: SignSequence[];
      try {
        sequences = requests.map((request) => RuleBasedTranslationProvider.translate(request) as SignSequence);
      } catch {
        fail("error");
        return;
      }
      if (cancelled) return;

      setState({
        status: "ready",
        track,
        sequences,
        certification: MACHINE_SYNTHETIC,
        message: null,
        progress: 1,
      });

      // Phase 2 - upgrade in the background if something better is registered.
      const best = selectTranslationProvider(language);
      if (!best || best.id === RuleBasedTranslationProvider.id) return;

      try {
        const upgraded = await translateSegments(requests);
        if (cancelled || upgraded.length === 0) return;
        setState((current) =>
          current.status === "ready"
            ? { ...current, sequences: upgraded, certification: upgraded[0]?.certification ?? current.certification }
            : current,
        );
      } catch {
        // The rule-engine timeline is already playing. A failed upgrade is not a
        // user-visible failure, so it stays silent by design.
      }
    })();

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [mediaId, language, enabled, duration, attempt]);

  // Rebuilding the timeline is O(n log n); memoising it means a settings change,
  // a resize, or a parent re-render costs nothing.
  const timeline = useMemo(
    () => (state.sequences.length ? new GestureTimeline(state.sequences) : EMPTY),
    [state.sequences],
  );

  const retry = useMemo(() => () => setAttempt((value) => value + 1), []);

  return { ...state, timeline, retry };
}
