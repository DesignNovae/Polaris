/**
 * Pure timeline maths shared by alignment, translation and rendering.
 * No DOM, no React, no provider imports - safe to unit test in isolation.
 */

import type { TranscriptSegment } from "../types/transcript";

export const clamp = (value: number, min: number, max: number) =>
  value < min ? min : value > max ? max : value;

/** Linear interpolation. */
export const lerp = (from: number, to: number, t: number) => from + (to - from) * t;

/** Smootherstep. Used for pose interpolation - signs decelerate into holds. */
export function easeInOut(t: number): number {
  const x = clamp(t, 0, 1);
  return x * x * x * (x * (x * 6 - 15) + 10);
}

/**
 * Index of the last item whose startTime is <= time, or -1.
 *
 * `hint` makes the common case free: playback is monotonic, so the answer is
 * almost always the previous index or the one after it. Only a seek falls
 * through to the O(log n) search.
 */
export function findIndexAtTime<T extends { startTime: number; endTime: number }>(
  items: readonly T[],
  time: number,
  hint = 0,
): number {
  const count = items.length;
  if (count === 0) return -1;

  if (hint >= 0 && hint < count) {
    const current = items[hint];
    if (time >= current.startTime && time < current.endTime) return hint;
    const next = items[hint + 1];
    if (next && time >= next.startTime && time < next.endTime) return hint + 1;
  }

  let low = 0;
  let high = count - 1;
  let found = -1;
  while (low <= high) {
    const mid = (low + high) >> 1;
    if (items[mid].startTime <= time) {
      found = mid;
      low = mid + 1;
    } else {
      high = mid - 1;
    }
  }
  return found;
}

/** Every item overlapping [from, to). Used to preload the upcoming window. */
export function itemsInWindow<T extends { startTime: number; endTime: number }>(
  items: readonly T[],
  from: number,
  to: number,
): T[] {
  const result: T[] = [];
  const start = Math.max(0, findIndexAtTime(items, from));
  for (let index = start; index < items.length; index += 1) {
    const item = items[index];
    if (item.startTime >= to) break;
    if (item.endTime > from) result.push(item);
  }
  return result;
}

/** 0-1 position of `time` inside an item's span. Clamped at both ends. */
export function progressWithin(item: { startTime: number; endTime: number }, time: number): number {
  const span = item.endTime - item.startTime;
  if (span <= 0) return 1;
  return clamp((time - item.startTime) / span, 0, 1);
}

/**
 * Guarantees a strictly increasing, non-overlapping, gap-free-enough track.
 *
 * Providers return human-authored or model-generated timings that routinely
 * overlap by a few milliseconds or arrive out of order. Every downstream stage
 * assumes sorted, disjoint spans, so normalisation happens once, here, rather
 * than being defended against in four places.
 */
export function normalizeSegments(segments: readonly TranscriptSegment[]): TranscriptSegment[] {
  const sorted = [...segments]
    .filter((segment) => Number.isFinite(segment.startTime) && Number.isFinite(segment.endTime))
    .sort((a, b) => a.startTime - b.startTime);

  const result: TranscriptSegment[] = [];
  for (const segment of sorted) {
    const previous = result[result.length - 1];
    const startTime = Math.max(0, previous ? Math.max(segment.startTime, previous.endTime) : segment.startTime);
    const endTime = Math.max(startTime + MIN_SEGMENT_SECONDS, segment.endTime);
    const text = segment.text.trim();
    if (!text) continue;
    result.push({ ...segment, startTime, endTime, text });
  }
  return result;
}

/** A segment shorter than this is unreadable and unsignable; providers get floored to it. */
export const MIN_SEGMENT_SECONDS = 0.35;

/** mm:ss for the transcript rail and diagnostics readout. */
export function formatTimecode(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
  const total = Math.floor(seconds);
  const minutes = Math.floor(total / 60);
  const rest = total % 60;
  return `${minutes}:${String(rest).padStart(2, "0")}`;
}

/**
 * Distributes a phrase's duration across its signs.
 *
 * Signs are not isochronous: fingerspelled letters are quick, held signs and
 * sentence-final signs are long, and reduplicated signs scale with repetition.
 * Weights come from the gesture itself so the caller stays dumb.
 */
export function distributeDuration(weights: readonly number[], totalSeconds: number): number[] {
  const sum = weights.reduce((total, weight) => total + weight, 0);
  if (sum <= 0 || weights.length === 0) return weights.map(() => 0);
  return weights.map((weight) => (weight / sum) * totalSeconds);
}
