"use client";

/**
 * Lesson player that exposes a clock.
 *
 * The learn tab previously used a bare privacy-enhanced iframe, which plays fine
 * but reports nothing - there is no way to read its position, so nothing could
 * ever synchronise to it. This mounts the same video through the IFrame Player
 * API instead, still on youtube-nocookie.com, and hands the resulting clock
 * source up to the interpreter.
 *
 * If the API cannot load - content blockers stop it routinely - the component
 * falls back to the original iframe. The lesson still plays; only the
 * interpreter is unavailable, and it says so rather than showing a broken frame.
 *
 * Two things that are easy to get wrong and are handled explicitly here:
 *
 *   Sizing. The API *replaces* the element it is handed, so the iframe it
 *   creates carries its own 640x360 attributes and inherits nothing from the
 *   placeholder. `.lesson-player-frame` in globals.css pins whatever lands
 *   inside to the 16:9 box. Without it the player renders at its intrinsic size
 *   inside a taller container and appears to float.
 *
 *   React's double-invoked effects in development. `create()` is async, so the
 *   cleanup from the first pass can run while the first player is still being
 *   constructed - leaving an orphaned iframe behind and a second one on top of
 *   it. The container is cleared on every attach and the late-resolving player
 *   is destroyed rather than adopted.
 */

import { useEffect, useRef, useState } from "react";
import { YouTubeClockSource } from "@/lib/interpreter/synchronization/clocks/YouTubeClockSource";

export type LessonPlayerState = "loading" | "ready" | "unavailable";

export function LessonPlayer({
  videoId,
  title,
  onSource,
  onState,
  autoPlay,
}: {
  videoId: string;
  title: string;
  /** Receives the clock source, or null while none exists. */
  onSource: (source: YouTubeClockSource | null) => void;
  onState?: (state: LessonPlayerState, message?: string) => void;
  autoPlay?: boolean;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [state, setState] = useState<LessonPlayerState>("loading");

  // Callbacks are read through refs so a parent re-render never tears down and
  // rebuilds the player - which would restart the lesson from zero.
  const onSourceRef = useRef(onSource);
  onSourceRef.current = onSource;
  const onStateRef = useRef(onState);
  onStateRef.current = onState;
  const autoPlayRef = useRef(autoPlay);
  autoPlayRef.current = autoPlay;

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let cancelled = false;
    let created: YouTubeClockSource | null = null;

    // Any iframe left behind by a previous attach goes now. Without this the
    // development double-mount stacks a second player under the first.
    container.replaceChildren();

    setState("loading");
    onStateRef.current?.("loading");

    void YouTubeClockSource.create({
      container,
      videoId,
      privacyEnhanced: true,
      onError: (message) => {
        if (cancelled) return;
        setState("unavailable");
        onStateRef.current?.("unavailable", message);
      },
    })
      .then((source) => {
        // Resolved after teardown: discard it rather than leaving it mounted.
        if (cancelled) {
          source.destroy();
          return;
        }
        created = source;
        setState("ready");
        onStateRef.current?.("ready");
        onSourceRef.current(source);
        if (autoPlayRef.current) source.play();
      })
      .catch(() => {
        if (cancelled) return;
        setState("unavailable");
        onStateRef.current?.("unavailable");
      });

    return () => {
      cancelled = true;
      onSourceRef.current(null);
      created?.destroy();
      container.replaceChildren();
    };
  }, [videoId]);

  return (
    <div className="relative aspect-video w-full overflow-hidden bg-[#0b0908]">
      <div ref={containerRef} className="lesson-player-frame absolute inset-0" />

      {state === "unavailable" && (
        <iframe
          key={videoId}
          title={title}
          src={`https://www.youtube-nocookie.com/embed/${videoId}?rel=0`}
          className="absolute inset-0 h-full w-full border-0"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
        />
      )}
    </div>
  );
}
