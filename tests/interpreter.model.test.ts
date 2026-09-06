import test from "node:test";
import assert from "node:assert/strict";
import { canReadExamSigning, parseVideoRange, signingManifestSchema } from "../lib/interpreter/model/manifest";
import { signingPlayback } from "../lib/interpreter/model/playback";

const asset = {
  id: "a".repeat(64), mediaId: "lesson-1", language: "ase", scope: "lesson",
  model: "SignSparK", checkpoint: "test-checkpoint", sourceHash: "b".repeat(64),
  sourceOrigin: "published-captions", duration: 60, fps: 25, offset: 0,
  includes: { hands: true, body: true, face: true }, review: { status: "unreviewed" },
};

test("model tracks reject fabricated transcript sources, absent facial motion and duplicate languages", () => {
  assert.equal(signingManifestSchema.safeParse({ version: 1, tracks: [asset] }).success, true);
  for (const changed of [
    { ...asset, sourceOrigin: "ai-generated" },
    { ...asset, sourceOrigin: "authored-companion" },
    { ...asset, includes: { ...asset.includes, face: false } },
    { ...asset, id: "../../secret" },
    { ...asset, review: { status: "reviewed" } },
    { ...asset, scope: "lesson", mediaId: "ielts-listening:part-1" },
    { ...asset, scope: "lesson", mediaId: "exam-listening:private-item" },
  ]) assert.equal(signingManifestSchema.safeParse({ version: 1, tracks: [changed] }).success, false);
  assert.equal(signingManifestSchema.safeParse({ version: 1, tracks: [asset, asset] }).success, false);
});

test("exam track access needs the active owner-loaded session and an audio claim for the video bytes", () => {
  const session = {
    mode: "ielts-listening", status: "in_progress", expiresAt: "2026-09-05T12:00:00Z",
    playedAudioParts: [] as string[], items: [{ stimulus: { mediaUrl: "part-1" } }],
  };
  const now = Date.parse("2026-09-05T11:00:00Z");
  assert.equal(canReadExamSigning(session, "part-1", false, now), true);
  assert.equal(canReadExamSigning(session, "part-1", true, now), false);
  const started = { ...session, playedAudioParts: ["part-1"] };
  assert.equal(canReadExamSigning(started, "part-1", true, now), true);
  assert.equal(canReadExamSigning(started, "part-2", true, now), false);
  assert.equal(canReadExamSigning({ ...started, status: "submitted" }, "part-1", true, now), false);
  assert.equal(canReadExamSigning(started, "part-1", true, now + 3_600_000), false);
  assert.equal(canReadExamSigning({ ...started, mode: "sat-full" }, "part-1", true, now), false);
});

test("video ranges support seeking without loading the whole file", () => {
  assert.deepEqual(parseVideoRange("bytes=50-99", 200), { start: 50, end: 99 });
  assert.deepEqual(parseVideoRange("bytes=50-", 200), { start: 50, end: 199 });
  assert.deepEqual(parseVideoRange("bytes=-30", 200), { start: 170, end: 199 });
  assert.deepEqual(parseVideoRange("bytes=0-500", 200), { start: 0, end: 199 });
  for (const header of ["bytes=200-", "bytes=-0", "bytes=40-30", "bytes=0-1,5-6", "bytes=-", "bytes=NaN-"]) {
    assert.equal(parseVideoRange(header, 200), "invalid");
  }
  assert.equal(parseVideoRange(null, 200), null);
});

const frame = { mediaTime: 10, offset: 0, duration: 60, videoTime: 10, rate: 1, playing: true, lost: false };

test("pause, forward and backward seeks follow the same media position", () => {
  assert.equal(signingPlayback({ ...frame, playing: false }).playing, false);
  for (const mediaTime of [40, 2]) {
    const result = signingPlayback({ ...frame, mediaTime, playing: false });
    assert.equal(result.target, mediaTime);
    assert.equal(result.seek, true);
    assert.equal(result.playing, false);
  }
  assert.equal(signingPlayback({ ...frame, rate: 1.5 }).rate, 1.5);
  assert.equal(signingPlayback({ ...frame, lost: true }).playing, false);
  assert.equal(signingPlayback({ ...frame, lost: true, videoTime: 4 }).target, 4);
});

test("offset lead-ins and the end hold the signer instead of looping unrelated motion", () => {
  assert.equal(signingPlayback({ ...frame, mediaTime: 0, offset: -2 }).playing, false);
  assert.equal(signingPlayback({ ...frame, mediaTime: 61 }).playing, false);
  assert.equal(signingPlayback({ ...frame, mediaTime: 61 }).target, 60);
  assert.equal(signingPlayback({ ...frame, videoTime: 10.15 }).seek, false);
  assert.ok(signingPlayback({ ...frame, videoTime: 10.15 }).rate < 1);
  assert.ok(signingPlayback({ ...frame, videoTime: 9.85 }).rate > 1);
});
