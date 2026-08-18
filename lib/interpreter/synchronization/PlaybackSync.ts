/**
 * Synchronisation engine.
 *
 * Plain TypeScript. No React, no DOM, no knowledge of gestures or avatars - it
 * only turns a clock source into a smooth, drift-corrected stream of media time.
 * That isolation is what lets the renderer be swapped for WebGL, or the panel be
 * rewritten, without touching a line of timing logic.
 *
 * The problem it solves is that no player reports time smoothly enough to drive
 * animation. A YouTube iframe answers `getCurrentTime()` in coarse steps; an HTML
 * media element fires `timeupdate` around four times a second. Sampling either
 * one directly gives visibly stepped motion.
 *
 * So the engine predicts. It holds an anchor - a media time paired with the wall
 * clock reading when it was taken - and extrapolates forward at the current rate,
 * which produces continuous time at display refresh rate. Then it reconciles that
 * prediction against the authoritative clock several times a second:
 *
 *   drift within tolerance  -> nudge the anchor by a fraction (invisible)
 *   drift beyond tolerance  -> re-anchor hard and report a resync (correct)
 *
 * The video is always right. Prediction is only ever a way to fill the gaps
 * between the moments the video tells us the truth.
 */

import type { SyncFrame, SyncQuality, InterpreterSyncState } from "../types/interpreter";
import { LOST_SNAPSHOT, type ClockSnapshot, type PlaybackClockSource } from "./clocks/types";

export type PlaybackSyncOptions = {
  /**
   * Drift above this forces a hard resync. The brief specifies ~100ms, which is
   * also roughly where an interpreter falling behind becomes perceptible.
   */
  driftToleranceMs?: number;
  /** How often the authoritative clock is polled. */
  pollIntervalMs?: number;
  /**
   * Fraction of sub-tolerance drift corrected per poll. Low enough that the
   * correction is invisible, high enough to converge within about a second.
   */
  softGain?: number;
  /** Status updates are throttled to this, so React re-renders at human speed. */
  statusIntervalMs?: number;
};

const DEFAULTS = {
  driftToleranceMs: 100,
  pollIntervalMs: 250,
  softGain: 0.18,
  statusIntervalMs: 250,
} as const;

/**
 * A frame gap longer than this means the tab was backgrounded or the thread was
 * blocked. Extrapolating across it would fabricate motion, so the engine treats
 * it as a discontinuity and re-anchors instead.
 */
const MAX_FRAME_GAP_MS = 400;

type FrameListener = (frame: SyncFrame) => void;

export class PlaybackSync {
  private source: PlaybackClockSource | null = null;
  private unsubscribeSource: (() => void) | null = null;

  /** Media time at the anchor point, in seconds. */
  private anchorMedia = 0;
  /** performance.now() at the anchor point. */
  private anchorWall = 0;
  private rate = 1;
  private playing = false;

  private rafId: number | null = null;
  private lastFrameAt = 0;
  private lastPollAt = 0;
  private lastStatusAt = 0;

  private driftMs = 0;
  private quality: SyncQuality = "lost";
  private resyncCount = 0;
  private seekGeneration = -1;

  private readonly frameListeners = new Set<FrameListener>();
  private readonly statusListeners = new Set<() => void>();

  private status: InterpreterSyncState = {
    quality: "lost",
    driftMs: 0,
    resyncCount: 0,
    activeGestureId: null,
    activeSegmentId: null,
  };

  private readonly options: Required<PlaybackSyncOptions>;

  constructor(options: PlaybackSyncOptions = {}) {
    this.options = { ...DEFAULTS, ...options };
  }

  /* ── Attachment ───────────────────────────────────────────────────────── */

  attach(source: PlaybackClockSource): void {
    this.detach();
    this.source = source;
    this.unsubscribeSource = source.subscribe((snapshot) => this.onTransportEvent(snapshot));
    this.reanchor(source.read(), "attach");
    this.start();
  }

  detach(): void {
    this.stop();
    this.unsubscribeSource?.();
    this.unsubscribeSource = null;
    this.source = null;
    this.quality = "lost";
    this.publishStatus(true);
  }

  /* ── Loop control ─────────────────────────────────────────────────────── */

  private start(): void {
    if (this.rafId !== null || typeof window === "undefined") return;
    this.lastFrameAt = performance.now();
    this.rafId = window.requestAnimationFrame(this.tick);
  }

  private stop(): void {
    if (this.rafId === null || typeof window === "undefined") return;
    window.cancelAnimationFrame(this.rafId);
    this.rafId = null;
  }

  /* ── Anchoring ────────────────────────────────────────────────────────── */

  /**
   * Resets prediction to the authoritative clock.
   *
   * Called on attach, on every transport event, and whenever drift exceeds
   * tolerance. `reason` exists so the diagnostics readout can distinguish "the
   * user seeked" from "we fell behind", which are very different problems.
   */
  private reanchor(snapshot: ClockSnapshot, reason: "attach" | "event" | "drift" | "gap"): void {
    if (snapshot.lost) {
      this.quality = "lost";
      return;
    }
    this.anchorMedia = snapshot.currentTime;
    this.anchorWall = performance.now();
    this.rate = snapshot.rate > 0 ? snapshot.rate : 1;
    this.playing = snapshot.playing && !snapshot.buffering;
    this.seekGeneration = snapshot.seekGeneration;
    this.driftMs = 0;
    if (reason === "drift" || reason === "gap") this.resyncCount += 1;
    this.quality = reason === "attach" ? "locked" : "correcting";
  }

  private onTransportEvent(snapshot: ClockSnapshot): void {
    // A transport event is ground truth by definition - the player just told us
    // what it did. Never soft-correct here; snap.
    this.reanchor(snapshot, "event");
    this.publishStatus(true);
  }

  /** Predicted media time for a given wall-clock reading. */
  private predict(now: number): number {
    if (!this.playing) return this.anchorMedia;
    return this.anchorMedia + ((now - this.anchorWall) / 1000) * this.rate;
  }

  /* ── Frame loop ───────────────────────────────────────────────────────── */

  private readonly tick = (): void => {
    this.rafId = typeof window === "undefined" ? null : window.requestAnimationFrame(this.tick);

    const source = this.source;
    if (!source) return;

    const now = performance.now();
    const rawDelta = now - this.lastFrameAt;
    this.lastFrameAt = now;

    // The tab was backgrounded, or the main thread stalled. Predicting across the
    // gap would invent motion that never happened.
    if (rawDelta > MAX_FRAME_GAP_MS) {
      this.reanchor(this.readSource(source), "gap");
      this.emitFrame(now, Math.min(rawDelta, MAX_FRAME_GAP_MS));
      return;
    }

    if (now - this.lastPollAt >= this.options.pollIntervalMs) {
      this.lastPollAt = now;
      this.reconcile(source, now);
    }

    this.emitFrame(now, rawDelta);

    if (now - this.lastStatusAt >= this.options.statusIntervalMs) {
      this.lastStatusAt = now;
      this.publishStatus(false);
    }
  };

  private readSource(source: PlaybackClockSource): ClockSnapshot {
    try {
      return source.read();
    } catch {
      // A player torn down mid-frame throws rather than returning. Degrade to
      // "lost" and hold the last pose instead of crashing the render loop.
      return LOST_SNAPSHOT;
    }
  }

  /** Compares prediction against the player and corrects, softly or hard. */
  private reconcile(source: PlaybackClockSource, now: number): void {
    const snapshot = this.readSource(source);
    if (snapshot.lost) {
      this.quality = "lost";
      return;
    }

    // The source noticed a seek we have not accounted for yet.
    if (snapshot.seekGeneration !== this.seekGeneration) {
      this.reanchor(snapshot, "event");
      return;
    }

    // Rate changes must re-anchor, not just update the multiplier: the elapsed
    // time since the last anchor was accumulated at the old rate.
    if (snapshot.rate > 0 && snapshot.rate !== this.rate) {
      this.reanchor(snapshot, "event");
      return;
    }

    if (snapshot.playing !== this.playing) {
      this.reanchor(snapshot, "event");
      return;
    }

    // Buffering stalls the media clock while wall time keeps running.
    if (snapshot.buffering) {
      this.reanchor(snapshot, "event");
      return;
    }

    const predicted = this.predict(now);
    const drift = (predicted - snapshot.currentTime) * 1000;
    this.driftMs = drift;

    if (Math.abs(drift) > this.options.driftToleranceMs) {
      this.reanchor(snapshot, "drift");
      return;
    }

    // Within tolerance: pull the anchor toward truth by a fraction of the error.
    // Correcting the whole error at once would be a visible jitter every poll.
    this.anchorMedia -= (drift / 1000) * this.options.softGain;
    this.quality = "locked";
  }

  private emitFrame(now: number, deltaMs: number): void {
    if (this.frameListeners.size === 0) return;
    const frame: SyncFrame = {
      mediaTime: this.predict(now),
      rate: this.rate,
      playing: this.playing,
      driftMs: this.driftMs,
      quality: this.quality,
      deltaMs,
    };
    for (const listener of this.frameListeners) listener(frame);
  }

  /* ── Subscriptions ────────────────────────────────────────────────────── */

  /**
   * Per-frame stream at display refresh rate.
   *
   * Imperative on purpose. Routing 60 updates a second through React state would
   * re-render the tree 60 times a second and cost more than the video decode.
   * Subscribers write to refs.
   */
  subscribeFrames(listener: FrameListener): () => void {
    this.frameListeners.add(listener);
    return () => {
      this.frameListeners.delete(listener);
    };
  }

  /** Coarse, throttled status stream. Safe for useSyncExternalStore. */
  subscribeStatus(listener: () => void): () => void {
    this.statusListeners.add(listener);
    return () => {
      this.statusListeners.delete(listener);
    };
  }

  getStatus = (): InterpreterSyncState => this.status;

  /**
   * Lets the renderer report which gesture and segment are live.
   *
   * The renderer knows this per frame; the panel needs it at reading speed. The
   * value is stored immediately and only published when it actually changes, so
   * a held sign does not re-render the gloss track every frame.
   */
  reportActive(activeGestureId: string | null, activeSegmentId: string | null): void {
    if (this.status.activeGestureId === activeGestureId && this.status.activeSegmentId === activeSegmentId) return;
    this.status = { ...this.status, activeGestureId, activeSegmentId };
    this.notifyStatus();
  }

  private publishStatus(force: boolean): void {
    const rounded = Math.round(this.driftMs);
    const changed =
      this.status.quality !== this.quality ||
      this.status.resyncCount !== this.resyncCount ||
      // Bucket drift to 5ms so a stable lock does not re-render on noise.
      Math.abs(this.status.driftMs - rounded) >= 5;

    if (!changed && !force) return;
    this.status = { ...this.status, quality: this.quality, driftMs: rounded, resyncCount: this.resyncCount };
    this.notifyStatus();
  }

  private notifyStatus(): void {
    for (const listener of this.statusListeners) listener();
  }

  /* ── Diagnostics ──────────────────────────────────────────────────────── */

  /** Current predicted media time. For callers outside the frame loop. */
  now(): number {
    return this.predict(performance.now());
  }

  get toleranceMs(): number {
    return this.options.driftToleranceMs;
  }

  destroy(): void {
    this.detach();
    this.frameListeners.clear();
    this.statusListeners.clear();
  }
}
