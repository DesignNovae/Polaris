/**
 * Deterministic text chunking + hashing.
 *
 * Chunks are sentence-aligned so a citation never starts mid-clause, and
 * overlap carries the trailing sentences of the previous window forward so a
 * fact that straddles a boundary is retrievable from either side.
 */

import { createHash } from "crypto";

export const MAX_CHUNK_CHARS = 900;
export const CHUNK_OVERLAP_CHARS = 150;

/** Short, stable content hash. Changing text changes the hash, so ingestion
 *  can skip re-embedding anything that did not actually change. */
export function hashText(text: string): string {
  return createHash("sha256").update(text).digest("hex").slice(0, 32);
}

function normalize(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

/**
 * Splits into sentences, hard-splitting any sentence too long to be a unit.
 *
 * `unitMax` is deliberately smaller than the window: a unit is later joined
 * with up to `overlap` characters carried from the previous window, and
 * unit + overlap must still fit. Sizing units at the full window is what let
 * an oversized sentence overflow the chunk it landed in.
 */
function splitSentences(text: string, unitMax: number): string[] {
  const parts = text.split(/(?<=[.!?])\s+/);
  const out: string[] = [];
  for (const part of parts) {
    if (part.length <= unitMax) {
      out.push(part);
      continue;
    }
    // A single oversized sentence (long list fields) - hard-split on word
    // boundaries, so no chunk ever begins or ends mid-word.
    let buffer = "";
    for (const word of part.split(" ")) {
      if (buffer && buffer.length + word.length + 1 > unitMax) {
        out.push(buffer);
        buffer = word;
      } else {
        buffer = buffer ? `${buffer} ${word}` : word;
      }
      // A single word longer than the unit budget: emit it whole rather than
      // cutting it, since a fragment is not retrievable by any query.
      if (buffer.length > unitMax && !buffer.includes(" ")) {
        out.push(buffer);
        buffer = "";
      }
    }
    if (buffer) out.push(buffer);
  }
  return out.filter(Boolean);
}

export function splitText(
  raw: string,
  max = MAX_CHUNK_CHARS,
  overlap = CHUNK_OVERLAP_CHARS,
): string[] {
  const text = normalize(raw);
  if (!text) return [];
  if (text.length <= max) return [text];

  // Units are sized so that unit + carried overlap still fits the window.
  const unitMax = Math.max(max - overlap, Math.floor(max / 2));
  const sentences = splitSentences(text, unitMax);
  const windows: string[] = [];
  let current: string[] = [];
  let length = 0;

  for (const sentence of sentences) {
    if (length + sentence.length + 1 > max && current.length > 0) {
      windows.push(current.join(" "));
      // Carry trailing sentences forward, but only what fits the overlap
      // budget - carrying past it is what pushed windows over the window.
      const carried: string[] = [];
      let carriedLength = 0;
      for (let i = current.length - 1; i >= 0; i--) {
        const cost = current[i].length + 1;
        if (carriedLength + cost > overlap) break;
        carried.unshift(current[i]);
        carriedLength += cost;
      }
      current = carried;
      length = carriedLength;
    }
    current.push(sentence);
    length += sentence.length + 1;
  }
  if (current.length) windows.push(current.join(" "));
  return windows;
}
