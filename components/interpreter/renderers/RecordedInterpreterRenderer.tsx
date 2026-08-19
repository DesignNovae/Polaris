"use client";

/**
 * Filmed interpreter track.
 *
 * This is the renderer that makes the feature conform rather than approximate.
 * WCAG 1.2.6 asks for sign language interpretation of prerecorded audio, and a
 * synthesised avatar does not satisfy it - a filmed, credentialed interpreter
 * does. Shipping this now, rather than listing it as future work, is what makes
 * the synthetic path a fallback instead of the product.
 *
 * The clip follows the lesson. It never plays on its own timeline: it is seeked
 * to the lesson's position, matched to its rate, and paused when it pauses. If
 * the clip drifts past tolerance it is corrected against the lesson, never the
 * other way round.
 */

import { useEffect, useRef, useState } from "react";
import type { AvatarRendererProps } from "@/lib/interpreter/render/registry";

/**
 * Correction threshold. Deliberately looser than the sync engine's 100ms: a
 * <video> seek is visually disruptive, so small offsets are absorbed by nudging
 * the playback rate instead of jumping.
 */
const SEEK_TOLERANCE = 0.28;
/** Below this, drift is corrected by trimming the rate rather than seeking. */
const RATE_TRIM_TOLERANCE = 0.08;
/** How often correction is considered. Every frame would thrash the decoder. */
const CORRECTION_INTERVAL_MS = 220;

export default function RecordedInterpreterRenderer({ sync, track, ariaLabel, onError }: AvatarRendererProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [failed, setFailed] = useState(false);

  const src = track.kind === "recorded" ? track.src : null;
  const offset = track.kind === "recorded" ? track.offset : 0;
  const poster = track.kind === "recorded" ? track.poster : undefined;

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !src) return;

    let lastCorrectionAt = 0;

    const unsubscribe = sync.subscribeFrames((frame) => {
      if (video.readyState < 1) return;

      const target = frame.mediaTime + offset;

      // Transport first: a paused lesson must never leave the interpreter signing.
      if (frame.playing && video.paused) {
        void video.play().catch(() => {
          // Autoplay policies block muted playback rarely, but not never.
          onError("The interpreter clip could not start. Use the lesson controls to play.");
        });
      } else if (!frame.playing && !video.paused) {
        video.pause();
      }

      const now = performance.now();
      if (now - lastCorrectionAt < CORRECTION_INTERVAL_MS) return;
      lastCorrectionAt = now;

      const drift = video.currentTime - target;

      if (Math.abs(drift) > SEEK_TOLERANCE) {
        // Too far out to hide. Seek, and accept the visible correction.
        if (target >= 0 && (!video.duration || target <= video.duration)) video.currentTime = target;
        video.playbackRate = frame.rate;
        return;
      }

      if (Math.abs(drift) > RATE_TRIM_TOLERANCE && frame.playing) {
        // Close enough to absorb: run fractionally fast or slow until it closes.
        const trim = drift > 0 ? -0.06 : 0.06;
        video.playbackRate = Math.max(0.25, frame.rate + trim);
      } else {
        video.playbackRate = frame.rate;
      }
    });

    return unsubscribe;
  }, [sync, src, offset, onError]);

  if (!src) {
    return (
      <div className="flex h-full items-center justify-center p-4 text-center text-[11px] text-ink-muted">
        This track has no recording attached.
      </div>
    );
  }

  if (failed) {
    return (
      <div className="flex h-full items-center justify-center p-4 text-center text-[11px] text-ink-dim">
        The interpreter recording could not load.
      </div>
    );
  }

  return (
    <video
      ref={videoRef}
      src={src}
      poster={poster}
      aria-label={ariaLabel}
      className="h-full w-full object-cover"
      // The interpreter carries no audio of its own; the lesson owns the sound.
      muted
      playsInline
      // Buffered ahead so the first sign is not a stall at the moment it must be read.
      preload="auto"
      onError={() => {
        setFailed(true);
        onError("The interpreter recording could not load.");
      }}
    />
  );
}
