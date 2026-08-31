/**
 * Clock source contract.
 *
 * The lesson video is the single source of truth for time. Everything downstream
 * reads from it and nothing writes back to it - the interpreter never owns a
 * timeline of its own, never runs its own timer, and can never drift away and
 * keep going.
 *
 * A clock source is the adapter that makes "the video" mean a YouTube iframe, an
 * HTML media element, or a speech synthesiser, without the sync engine caring
 * which. Adding a live WebRTC stream later means writing one more of these.
 */

export type ClockSnapshot = {
  /** Authoritative media position in seconds, as the underlying player reports it. */
  currentTime: number;
  /** performance.now() at the moment currentTime was sampled. */
  sampledAt: number;
  playing: boolean;
  /** Playback rate multiplier. The interpreter scales with it rather than resampling. */
  rate: number;
  /** Total duration in seconds, 0 when unknown. */
  duration: number;
  /** True while buffering, when the clock is not advancing reliably. */
  buffering: boolean;
  /** Increments on every detected discontinuity, so a seek is distinguishable from drift. */
  seekGeneration: number;
  /** True when the source cannot currently be read at all. */
  lost: boolean;
};

export const LOST_SNAPSHOT: ClockSnapshot = {
  currentTime: 0,
  sampledAt: 0,
  playing: false,
  rate: 1,
  duration: 0,
  buffering: false,
  seekGeneration: 0,
  lost: true,
};

export interface PlaybackClockSource {
  readonly id: string;
  /**
   * Reads the authoritative position. Must be synchronous and cheap - the sync
   * engine calls it several times a second. Implementations that talk to a remote
   * player cache locally and refresh on events.
   */
  read(): ClockSnapshot;
  /**
   * Discrete transport events: play, pause, seek, rate change, buffering.
   * The sync engine re-anchors immediately on each one instead of waiting for the
   * next poll to notice, which is what keeps a seek from showing a visible jump.
   */
  subscribe(listener: (snapshot: ClockSnapshot) => void): () => void;
  destroy(): void;
}
