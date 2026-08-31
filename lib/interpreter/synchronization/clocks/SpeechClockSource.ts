/**
 * Clock source backed by the Web Speech synthesiser.
 *
 * The IELTS listening player speaks a Polaris-authored script. There is no media
 * element and `SpeechSynthesis` exposes no playback position - but it does fire
 * `boundary` events carrying the character index it has reached, which is a real
 * observation of where the voice actually is.
 *
 * So this source anchors on every boundary event and interpolates between them by
 * character position. The result is a genuine clock: the words are exact because
 * Polaris wrote them, and the alignment is corrected by the synthesiser itself
 * several times per sentence rather than being guessed once and left to drift.
 *
 * This is also the surface where the interpreter matters most. A listening exam
 * is inaccessible by construction to a Deaf or hard-of-hearing student; a signed
 * track is the difference between attempting it and not.
 */

import { LOST_SNAPSHOT, type ClockSnapshot, type PlaybackClockSource } from "./types";

export type SpeechClockOptions = {
  /** The exact text being spoken. Character indices are relative to it. */
  script: string;
  /** Total estimated duration in seconds, matching the transcript track's scale. */
  duration: number;
};

export class SpeechClockSource implements PlaybackClockSource {
  readonly id = "speech-synthesis";

  private listeners = new Set<(snapshot: ClockSnapshot) => void>();

  /** Media time at the last anchor, in seconds. */
  private anchorTime = 0;
  /** performance.now() at the last anchor. */
  private anchorWall = 0;
  private playing = false;
  private ended = false;
  private seekGeneration = 0;
  private destroyed = false;

  private readonly totalChars: number;

  constructor(private readonly options: SpeechClockOptions) {
    this.totalChars = Math.max(1, options.script.length);
    this.anchorWall = typeof performance === "undefined" ? 0 : performance.now();
  }

  /**
   * Converts a character index into media seconds.
   *
   * Linear in character position. Speech is not perfectly linear in characters,
   * but boundary events arrive every word or two, so the error never accumulates
   * far enough to matter before the next correction.
   */
  private timeForChar(charIndex: number): number {
    return (Math.min(charIndex, this.totalChars) / this.totalChars) * this.options.duration;
  }

  /* ── Called by the speech player as the utterance progresses ──────────── */

  /** A real observation from the synthesiser. The strongest signal this source has. */
  onBoundary(charIndex: number): void {
    if (this.destroyed) return;
    this.anchorTime = this.timeForChar(charIndex);
    this.anchorWall = performance.now();
    this.playing = true;
    this.ended = false;
    this.emit();
  }

  onStart(): void {
    if (this.destroyed) return;
    this.anchorTime = 0;
    this.anchorWall = performance.now();
    this.playing = true;
    this.ended = false;
    this.seekGeneration += 1;
    this.emit();
  }

  onPause(): void {
    if (this.destroyed) return;
    // Freeze at the current estimate so resuming continues from the right place.
    this.anchorTime = this.currentEstimate();
    this.anchorWall = performance.now();
    this.playing = false;
    this.emit();
  }

  onResume(): void {
    if (this.destroyed) return;
    this.anchorWall = performance.now();
    this.playing = true;
    this.emit();
  }

  onEnd(): void {
    if (this.destroyed) return;
    this.anchorTime = this.options.duration;
    this.anchorWall = performance.now();
    this.playing = false;
    this.ended = true;
    this.emit();
  }

  /** Full reset, for replaying the same script from the top. */
  onReset(): void {
    if (this.destroyed) return;
    this.anchorTime = 0;
    this.anchorWall = performance.now();
    this.playing = false;
    this.ended = false;
    this.seekGeneration += 1;
    this.emit();
  }

  private currentEstimate(): number {
    if (!this.playing) return this.anchorTime;
    const elapsed = (performance.now() - this.anchorWall) / 1000;
    return Math.min(this.options.duration, this.anchorTime + elapsed);
  }

  read(): ClockSnapshot {
    if (this.destroyed) return LOST_SNAPSHOT;
    return {
      currentTime: this.currentEstimate(),
      sampledAt: typeof performance === "undefined" ? 0 : performance.now(),
      playing: this.playing,
      // The synthesiser runs at the rate set on the utterance; the transcript
      // duration is already computed at that rate, so this scale is 1.
      rate: 1,
      duration: this.options.duration,
      buffering: false,
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

  get isEnded(): boolean {
    return this.ended;
  }

  destroy(): void {
    this.destroyed = true;
    this.listeners.clear();
  }
}
