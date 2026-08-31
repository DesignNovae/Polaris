"use client";

/**
 * React bindings for the synchronisation engine.
 *
 * The split here is the whole performance story. `useInterpreterSync` returns the
 * engine itself plus a coarse, throttled status snapshot. Components that need to
 * *display* something - the drift indicator, the gloss track - read the snapshot
 * and re-render a few times a second. The renderer takes the engine and
 * subscribes to frames imperatively, so it updates at display refresh rate
 * without React participating at all.
 *
 * Nothing in this file puts per-frame data into state, and nothing should.
 */

import { useCallback, useEffect, useMemo, useRef, useSyncExternalStore } from "react";
import { PlaybackSync, type PlaybackSyncOptions } from "../synchronization/PlaybackSync";
import type { PlaybackClockSource } from "../synchronization/clocks/types";
import { IDLE_SYNC_STATE, type InterpreterSyncState } from "../types/interpreter";

/**
 * Owns a PlaybackSync for the lifetime of the component and keeps it attached to
 * whichever clock source is current.
 *
 * `source` may be null while a player is still loading; the engine simply reports
 * "lost" until one arrives, which is exactly what the panel should show.
 */
export function useInterpreterSync(
  source: PlaybackClockSource | null,
  options?: PlaybackSyncOptions,
): { sync: PlaybackSync; status: InterpreterSyncState } {
  // Options are read once at construction. Re-creating the engine because a
  // caller passed a fresh object literal would drop the anchor every render.
  const optionsRef = useRef(options);
  const sync = useMemo(() => new PlaybackSync(optionsRef.current), []);

  useEffect(() => () => sync.destroy(), [sync]);

  useEffect(() => {
    if (!source) {
      sync.detach();
      return;
    }
    sync.attach(source);
    return () => sync.detach();
  }, [sync, source]);

  const subscribe = useCallback((listener: () => void) => sync.subscribeStatus(listener), [sync]);
  const status = useSyncExternalStore(subscribe, sync.getStatus, () => IDLE_SYNC_STATE);

  return { sync, status };
}

/**
 * Subscribes to the frame stream with a callback that stays current.
 *
 * The subscription itself is created once. Without the ref indirection, a caller
 * passing an inline arrow would resubscribe every render, and resubscribing
 * during playback drops frames.
 */
export function useSyncFrames(sync: PlaybackSync, onFrame: Parameters<PlaybackSync["subscribeFrames"]>[0]): void {
  const handler = useRef(onFrame);
  handler.current = onFrame;

  useEffect(() => sync.subscribeFrames((frame) => handler.current(frame)), [sync]);
}
