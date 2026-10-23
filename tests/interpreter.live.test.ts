import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { SigningBuffer } from "../lib/interpreter/model/buffer";
import { parseMeshChunk, signingChunkIndex, youtubeVideoId } from "../lib/interpreter/model/live";
import { hasPregeneratedSigning, pregeneratedAssetUrl, pregeneratedCaptions, pregeneratedJob } from "../lib/interpreter/model/pregenerated";
import pregenerated from "../data/interpreter/pregenerated.json";
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

test("mesh transport rejects truncated, oversized, and non-finite model geometry", async () => {
  const bytes = new ArrayBuffer(16 + 10475 * 12);
  const header = new DataView(bytes);
  header.setUint32(0, 0x31534c50, true); header.setUint32(4, 1, true);
  header.setUint32(8, 10475, true); header.setUint32(12, 25, true);
  assert.equal((await parseMeshChunk(bytes, 0, 0, .04)).vertices, 10475);
  await assert.rejects(parseMeshChunk(bytes.slice(0, -1), 0, 0, .04));
  new Float32Array(bytes, 16)[0] = NaN;
  await assert.rejects(parseMeshChunk(bytes, 0, 0, .04));
  new Float32Array(bytes, 16)[0] = 0;
  header.setUint32(4, 305, true);
  await assert.rejects(parseMeshChunk(bytes, 0, 0, .04));
});

test("compact PLS2 sections from the Python worker decode to the original vertices", async () => {
  // tests/fixtures/signing-pls2.bin was written by services/signing/compact.py from this formula.
  const file = readFileSync(new URL("./fixtures/signing-pls2.bin", import.meta.url));
  const bytes = file.buffer.slice(file.byteOffset, file.byteOffset + file.byteLength);
  const chunk = await parseMeshChunk(bytes, 0, 0, .12);
  assert.equal(chunk.frames, 3);
  let worst = 0;
  for (let f = 0, k = 0; f < 3; f++) for (let i = 0; i < 10475; i++) for (let axis = 0; axis < 3; axis++, k++) {
    const expected = Math.fround(.8 * Math.sin(i * .0013 + axis * 1.7) + .004 * f * Math.cos(i * .01));
    worst = Math.max(worst, Math.abs(chunk.positions[k] - expected));
  }
  assert.ok(worst <= 1.01e-4, `max error ${worst} m`); // 0.1 mm plus float32 rounding
  await assert.rejects(parseMeshChunk(bytes.slice(0, -10), 0, 0, .12));
});

test("prepared signing exposes every listed section as a ready job and nothing else", () => {
  assert.equal(pregeneratedJob("not-a-prepared-lesson"), null);
  assert.equal(hasPregeneratedSigning("not-a-prepared-lesson"), false);
  assert.equal(pregeneratedCaptions("not-a-prepared-lesson"), null);
  assert.equal(pregeneratedAssetUrl("sat-rw-evidence", "3"), "/signing/sat-rw-evidence/3.pls2");
  assert.equal(pregeneratedAssetUrl("sat-rw-evidence", "topology"), "/signing/topology.bin");
  for (const [id, entry] of Object.entries((pregenerated as unknown as { videos: Record<string, { sections: unknown[]; duration: number }> }).videos)) {
    const job = pregeneratedJob(id)!;
    assert.equal(job.phase, "ready");
    assert.equal(Object.keys(job.chunks).length, entry.sections.length);
    assert.ok(Math.ceil(entry.duration / job.chunkSeconds) === entry.sections.length, `${id} covers its whole duration`);
    assert.equal(pregeneratedCaptions(id)?.length, entry.sections.length, `${id} has one caption per section`);
  }
});
