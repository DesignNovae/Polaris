/**
 * Clock source backed by an HTMLMediaElement.
 *
 * The simplest of the three, and the one a self-hosted lesson or a live stream
 * would use. `currentTime` is authoritative and free to read, and the element
 * fires real transport events, so there is nothing to infer.
 */

import { LOST_SNAPSHOT, type ClockSnapshot, type PlaybackClockSource } from "./types";

const TRANSPORT_EVENTS = [
  "play", "pause", "seeking", "seeked", "ratechange",
  "waiting", "playing", "ended", "loadedmetadata", "emptied",
] as const;

export class MediaElementClockSource implements PlaybackClockSource {
  readonly id = "media-element";

  private listeners = new Set<(snapshot: ClockSnapshot) => void>();
  private seekGeneration = 0;
  private destroyed = false;

  private readonly onTransport = (event: Event): void => {
    if (event.type === "seeked" || event.type === "seeking") this.seekGeneration += 1;
    this.emit();
  };

  constructor(private readonly element: HTMLMediaElement) {
    for (const type of TRANSPORT_EVENTS) element.addEventListener(type, this.onTransport);
  }

  read(): ClockSnapshot {
    const element = this.element;
    if (this.destroyed || !element.isConnected) return LOST_SNAPSHOT;

    return {
      currentTime: element.currentTime,
      sampledAt: performance.now(),
      playing: !element.paused && !element.ended,
      rate: element.playbackRate > 0 ? element.playbackRate : 1,
      duration: Number.isFinite(element.duration) ? element.duration : 0,
      // readyState below HAVE_FUTURE_DATA means the clock is about to stall.
      buffering: element.seeking || element.readyState < 3,
      seekGeneration: this.seekGeneration,
      lost: false,
    };
  }

  subscribe(listener: (snapshot: ClockSnapshot) => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private emit(): void {
    if (this.listeners.size === 0) return;
    const snapshot = this.read();
    for (const listener of this.listeners) listener(snapshot);
  }

  destroy(): void {
    this.destroyed = true;
    for (const type of TRANSPORT_EVENTS) this.element.removeEventListener(type, this.onTransport);
    this.listeners.clear();
  }
}
