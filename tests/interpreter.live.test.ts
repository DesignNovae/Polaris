import test from "node:test";
import assert from "node:assert/strict";
import { SigningBuffer } from "../lib/interpreter/model/buffer";
import { parseMeshChunk, signingChunkIndex, youtubeVideoId } from "../lib/interpreter/model/live";
import { LOST_SNAPSHOT } from "../lib/interpreter/synchronization/clocks/types";

const paused = { ...LOST_SNAPSHOT, lost: false, duration: 60, currentTime: 12, sampledAt: 1 };
const playing = { ...paused, playing: true };

test("buffer resumes only requested playback and preserves an explicit pause", () => {
  const gate = new SigningBuffer();
  assert.equal(gate.update(paused, false), null);
  assert.equal(gate.update(paused, true), null);
  assert.equal(gate.update(playing, false), "pause");
  gate.transport(paused);
  assert.equal(gate.update(paused, false), null);
  assert.equal(gate.update(paused, true), "play");
  assert.equal(gate.update(playing, false), "pause");
  gate.transport(paused);
  gate.pauseByUser();
  assert.equal(gate.update(paused, true), null);
});

test("seeking to an unfinished section retains play intent; lost source cancels it", () => {
  const gate = new SigningBuffer();
  gate.update(playing, false);
  gate.transport(paused);
  gate.transport({ ...paused, currentTime: 42, seekGeneration: 2 });
  assert.equal(gate.update({ ...paused, currentTime: 42 }, true), "play");
  gate.update(playing, false);
  gate.update(LOST_SNAPSHOT, false);
  assert.equal(gate.update(paused, true), null);
  assert.equal(signingChunkIndex(16, 24), 2);
  assert.equal(signingChunkIndex(24, 24), 2);
  assert.equal(signingChunkIndex(999, 24), 2);
});

test("new YouTube links accept only supported HTTPS YouTube hosts and valid IDs", () => {
  for (const value of ["https://www.youtube.com/watch?v=abcdefghijk", "https://youtu.be/abcdefghijk", "https://youtube.com/shorts/abcdefghijk"])
    assert.equal(youtubeVideoId(value), "abcdefghijk");
  for (const value of ["http://youtube.com/watch?v=abcdefghijk", "https://youtube.com.evil.test/watch?v=abcdefghijk", "file:///etc/passwd", "https://127.0.0.1:8765", "https://youtube.com/watch?v=abc"])
    assert.equal(youtubeVideoId(value), null);
});

test("mesh transport rejects truncated, oversized, and non-finite model geometry", () => {
  const bytes = new ArrayBuffer(16 + 10475 * 12);
  const header = new DataView(bytes);
  header.setUint32(0, 0x31534c50, true); header.setUint32(4, 1, true);
  header.setUint32(8, 10475, true); header.setUint32(12, 25, true);
  assert.equal(parseMeshChunk(bytes, 0, 0, .04).vertices, 10475);
  assert.throws(() => parseMeshChunk(bytes.slice(0, -1), 0, 0, .04));
  new Float32Array(bytes, 16)[0] = NaN;
  assert.throws(() => parseMeshChunk(bytes, 0, 0, .04));
  new Float32Array(bytes, 16)[0] = 0;
  header.setUint32(4, 305, true);
  assert.throws(() => parseMeshChunk(bytes, 0, 0, .04));
});
