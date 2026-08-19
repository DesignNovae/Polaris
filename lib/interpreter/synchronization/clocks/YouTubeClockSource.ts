/**
 * Clock source backed by the YouTube IFrame Player API.
 *
 * The learn tab previously embedded a plain privacy-enhanced iframe, which gives
 * no way to read playback position - so nothing could synchronise to it. This
 * source swaps that for the JS API player, still on youtube-nocookie.com so the
 * privacy-enhanced behaviour the UI advertises is preserved, and exposes the
 * transport as a clock.
 *
 * Two things the API does not give us, handled here:
 *
 *   - Seeks fire no event. Detected by comparing each reading against what
 *     elapsed time can explain, and reported as a discontinuity.
 *   - `getCurrentTime()` advances in coarse steps. Left alone deliberately -
 *     smoothing belongs in PlaybackSync, and doing it in two places would fight.
 */

import { LOST_SNAPSHOT, type ClockSnapshot, type PlaybackClockSource } from "./types";

/* ── Minimal API surface, declared locally rather than pulling in @types ── */

type YouTubePlayer = {
  getCurrentTime(): number;
  getDuration(): number;
  getPlayerState(): number;
  getPlaybackRate(): number;
  playVideo(): void;
  pauseVideo(): void;
  seekTo(seconds: number, allowSeekAhead: boolean): void;
  loadVideoById(videoId: string): void;
  destroy(): void;
};

type YouTubeApi = {
  Player: new (
    element: HTMLElement | string,
    options: {
      videoId: string;
      host?: string;
      width?: string | number;
      height?: string | number;
      playerVars?: Record<string, string | number>;
      events?: {
        onReady?: (event: { target: YouTubePlayer }) => void;
        onStateChange?: (event: { data: number; target: YouTubePlayer }) => void;
        onPlaybackRateChange?: (event: { data: number }) => void;
        onError?: (event: { data: number }) => void;
      };
    },
  ) => YouTubePlayer;
  PlayerState: { UNSTARTED: number; ENDED: number; PLAYING: number; PAUSED: number; BUFFERING: number; CUED: number };
};

declare global {
  interface Window {
    YT?: YouTubeApi;
    onYouTubeIframeAPIReady?: () => void;
  }
}

const PLAYING = 1;
const PAUSED = 2;
const BUFFERING = 3;
const ENDED = 0;

const API_SRC = "https://www.youtube.com/iframe_api";

let apiPromise: Promise<YouTubeApi> | null = null;

/**
 * Loads the IFrame API once per document.
 *
 * The API calls a single global callback when ready, so concurrent callers must
 * share one promise rather than each installing their own hook and clobbering
 * the previous one.
 */
export function loadYouTubeApi(): Promise<YouTubeApi> {
  if (typeof window === "undefined") return Promise.reject(new Error("YouTube API requires a browser"));
  if (window.YT?.Player) return Promise.resolve(window.YT);
  if (apiPromise) return apiPromise;

  apiPromise = new Promise<YouTubeApi>((resolve, reject) => {
    const previous = window.onYouTubeIframeAPIReady;
    const timeout = window.setTimeout(() => reject(new Error("YouTube IFrame API did not load")), 12_000);

    window.onYouTubeIframeAPIReady = () => {
      window.clearTimeout(timeout);
      previous?.();
      if (window.YT?.Player) resolve(window.YT);
      else reject(new Error("YouTube IFrame API loaded without a Player constructor"));
    };

    if (!document.querySelector(`script[src="${API_SRC}"]`)) {
      const script = document.createElement("script");
      script.src = API_SRC;
      script.async = true;
      script.onerror = () => {
        window.clearTimeout(timeout);
        reject(new Error("YouTube IFrame API script failed to load"));
      };
      document.head.appendChild(script);
    }
  }).catch((error) => {
    // Let a later attempt retry rather than caching the failure forever - this
    // fails routinely behind content blockers and on flaky connections.
    apiPromise = null;
    throw error;
  });

  return apiPromise;
}

export type YouTubeClockOptions = {
  container: HTMLElement;
  videoId: string;
  /** Preserves the privacy-enhanced host the learn tab already advertises. */
  privacyEnhanced?: boolean;
  onReady?: () => void;
  onError?: (message: string) => void;
};

/**
 * A jump larger than this, beyond what elapsed time explains, is a seek.
 * Comfortably above normal reporting jitter and below the smallest deliberate skip.
 */
const SEEK_THRESHOLD_SECONDS = 0.75;

export class YouTubeClockSource implements PlaybackClockSource {
  readonly id = "youtube";

  private player: YouTubePlayer | null = null;
  private listeners = new Set<(snapshot: ClockSnapshot) => void>();
  private destroyed = false;

  private seekGeneration = 0;
  private lastTime = 0;
  private lastReadAt = 0;
  private ready = false;

  private constructor(private readonly options: YouTubeClockOptions) {}

  static async create(options: YouTubeClockOptions): Promise<YouTubeClockSource> {
    const source = new YouTubeClockSource(options);
    await source.init();
    return source;
  }

  private async init(): Promise<void> {
    const api = await loadYouTubeApi();
    if (this.destroyed) return;

    // The API replaces the element it is given, so it gets a child to consume
    // rather than the caller's container.
    const mount = document.createElement("div");
    this.options.container.appendChild(mount);

    await new Promise<void>((resolve) => {
      this.player = new api.Player(mount, {
        videoId: this.options.videoId,
        // Written straight onto the generated iframe. Without these it is born
        // 640x360 and sits at that size inside whatever box contains it.
        width: "100%",
        height: "100%",
        host: this.options.privacyEnhanced === false ? undefined : "https://www.youtube-nocookie.com",
        playerVars: {
          rel: 0,
          modestbranding: 1,
          playsinline: 1,
          // Required for the JS API to accept commands from this origin.
          enablejsapi: 1,
          origin: window.location.origin,
        },
        events: {
          onReady: () => {
            this.ready = true;
            this.options.onReady?.();
            this.emit();
            resolve();
          },
          onStateChange: () => {
            // Buffering and resume both change how time advances, so every state
            // transition is a re-anchor point for the sync engine.
            this.emit();
          },
          onPlaybackRateChange: () => this.emit(),
          onError: (event) => {
            this.options.onError?.(describeYouTubeError(event.data));
            this.emit();
          },
        },
      });
    });
  }

  read(): ClockSnapshot {
    const player = this.player;
    if (!player || !this.ready || this.destroyed) return LOST_SNAPSHOT;

    let currentTime: number;
    let state: number;
    let rate: number;
    let duration: number;
    try {
      currentTime = player.getCurrentTime();
      state = player.getPlayerState();
      rate = player.getPlaybackRate();
      duration = player.getDuration();
    } catch {
      // The iframe can be torn down between frames during navigation.
      return LOST_SNAPSHOT;
    }

    if (!Number.isFinite(currentTime)) return LOST_SNAPSHOT;

    const now = performance.now();
    const playing = state === PLAYING;

    // Seek detection: compare the observed jump against what playback could have
    // produced in the elapsed wall time. Anything beyond that is a user action.
    if (this.lastReadAt > 0) {
      const elapsed = ((now - this.lastReadAt) / 1000) * (rate > 0 ? rate : 1);
      const expected = playing ? elapsed : 0;
      if (Math.abs(currentTime - this.lastTime - expected) > SEEK_THRESHOLD_SECONDS) {
        this.seekGeneration += 1;
      }
    }
    this.lastTime = currentTime;
    this.lastReadAt = now;

    return {
      currentTime,
      sampledAt: now,
      playing,
      rate: rate > 0 ? rate : 1,
      duration: Number.isFinite(duration) ? duration : 0,
      buffering: state === BUFFERING,
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

  /* ── Transport, for the panel's own controls ──────────────────────────── */

  play(): void {
    this.player?.playVideo();
  }

  pause(): void {
    this.player?.pauseVideo();
  }

  seekTo(seconds: number): void {
    this.player?.seekTo(Math.max(0, seconds), true);
    this.seekGeneration += 1;
    this.emit();
  }

  get isEnded(): boolean {
    try {
      return this.player?.getPlayerState() === ENDED;
    } catch {
      return false;
    }
  }

  get isPaused(): boolean {
    try {
      return this.player?.getPlayerState() === PAUSED;
    } catch {
      return true;
    }
  }

  destroy(): void {
    this.destroyed = true;
    this.listeners.clear();
    try {
      this.player?.destroy();
    } catch {
      // Already gone. Nothing to release.
    }
    this.player = null;
  }
}

function describeYouTubeError(code: number): string {
  switch (code) {
    case 2:
      return "This lesson has an invalid video id.";
    case 5:
      return "This lesson cannot play in an HTML5 player here.";
    case 100:
      return "This lesson is no longer available on YouTube.";
    case 101:
    case 150:
      return "The owner of this lesson does not allow it to play outside YouTube.";
    default:
      return "This lesson could not be loaded.";
  }
}
