/**
 * Flattened, queryable gesture timeline.
 *
 * Built once per translation result and then read every frame, so the shape is
 * chosen for lookup cost rather than for construction cost: one flat array sorted
 * by start time, plus a cursor that makes sequential playback O(1) and only makes
 * a seek pay for the binary search.
 *
 * Immutable. A settings change or a re-translation builds a new timeline rather
 * than mutating this one, which is what lets the renderer hold a reference across
 * frames without defensive copying.
 */

import type { Gesture, SignSequence } from "../types/gestures";
import { findIndexAtTime, itemsInWindow, progressWithin } from "../utils/timeline";

/** What the renderer needs to draw a single frame. */
export type TimelineCursor = {
  /** Sign being articulated, or null in a gap between sequences. */
  gesture: Gesture | null;
  /** The one after it, for transition blending and preloading. */
  next: Gesture | null;
  /** 0-1 through the current gesture. 0 when there is no gesture. */
  progress: number;
  /** Index into the flat array, reused as the next frame's hint. */
  index: number;
  /** Transcript segment currently being interpreted. */
  segmentId: string | null;
};

export const EMPTY_CURSOR: TimelineCursor = {
  gesture: null,
  next: null,
  progress: 0,
  index: -1,
  segmentId: null,
};

export class GestureTimeline {
  private readonly gestures: Gesture[];
  /** Parallel array: which segment each gesture belongs to. */
  private readonly owners: string[];
  /** Last index returned, used as the hint for the next lookup. */
  private cursor = 0;

  readonly startTime: number;
  readonly endTime: number;

  constructor(sequences: readonly SignSequence[]) {
    const gestures: Gesture[] = [];
    const owners: string[] = [];

    for (const sequence of sequences) {
      for (const gesture of sequence.gestures) {
        gestures.push(gesture);
        owners.push(sequence.segmentId);
      }
    }

    // Sequences may arrive out of order when translation resolves in parallel.
    const order = gestures.map((_, index) => index).sort((a, b) => gestures[a].startTime - gestures[b].startTime);
    this.gestures = order.map((index) => gestures[index]);
    this.owners = order.map((index) => owners[index]);

    this.startTime = this.gestures[0]?.startTime ?? 0;
    this.endTime = this.gestures[this.gestures.length - 1]?.endTime ?? 0;
  }

  get size(): number {
    return this.gestures.length;
  }

  get isEmpty(): boolean {
    return this.gestures.length === 0;
  }

  /**
   * Resolves the frame state at a media time.
   *
   * Called once per animation frame, so the fast path matters: the hint makes
   * monotonic playback two comparisons, and only a seek falls through to the
   * O(log n) search.
   */
  at(mediaTime: number): TimelineCursor {
    if (this.gestures.length === 0) return EMPTY_CURSOR;

    const index = findIndexAtTime(this.gestures, mediaTime, this.cursor);
    if (index < 0) {
      // Before the first sign - hold the rest pose rather than snapping into one.
      return { ...EMPTY_CURSOR, next: this.gestures[0] };
    }
    this.cursor = index;

    const gesture = this.gestures[index];
    const next = this.gestures[index + 1] ?? null;

    // Past the end of this gesture and the next has not begun: a real gap.
    if (mediaTime >= gesture.endTime) {
      return { gesture: null, next, progress: 0, index, segmentId: null };
    }

    return {
      gesture,
      next,
      progress: progressWithin(gesture, mediaTime),
      index,
      segmentId: this.owners[index] ?? null,
    };
  }

  /**
   * Gestures starting within the next `seconds`.
   *
   * The renderer uses this to warm anything a gesture needs before it is due -
   * a clip fetch, a texture, a mesh. Doing that work when the sign is already due
   * is what produces a visible stall at the moment the interpreter must be
   * readable.
   */
  upcoming(mediaTime: number, seconds: number): Gesture[] {
    return itemsInWindow(this.gestures, mediaTime, mediaTime + seconds);
  }

  /** Every gesture belonging to a segment. Used by the gloss track. */
  forSegment(segmentId: string): Gesture[] {
    return this.gestures.filter((_, index) => this.owners[index] === segmentId);
  }

  /** Resets the lookup hint. Called on seek so a backwards jump does not scan forward. */
  resetCursor(): void {
    this.cursor = 0;
  }
}

export const EMPTY_TIMELINE = new GestureTimeline([]);
