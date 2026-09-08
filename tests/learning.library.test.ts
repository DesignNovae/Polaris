import assert from "node:assert/strict";
import { test } from "node:test";
import { LEARNING_LIBRARY, LEARNING_PATHS, LEARNING_SECTIONS } from "../lib/learning/catalog";
import { filterLibrary, formatTime, progressPatchSchema, resumePosition, type LibraryFilters } from "../lib/learning/library";

const all: LibraryFilters = { exam: "All", topic: "All", query: "", level: "All", length: "All", view: "all", sort: "recommended" };
test("all six sections have ten unique, checked, playable-duration lessons", () => {
  assert.equal(LEARNING_LIBRARY.length, 60);
  assert.equal(new Set(LEARNING_LIBRARY.map((v) => v.youtubeId)).size, 60);
  assert.equal(new Set(LEARNING_LIBRARY.map((v) => v.id)).size, 60);
  for (const [exam, sections] of Object.entries(LEARNING_SECTIONS)) {
    for (const topic of sections) assert.equal(filterLibrary(LEARNING_LIBRARY, { ...all, exam, topic }, {}).length, 10);
  }
  for (const video of LEARNING_LIBRARY) {
    assert.ok(video.durationSeconds > 0 && video.durationSeconds <= 7200);
    assert.match(video.youtubeId, /^[\w-]{11}$/);
    assert.ok(Number.isFinite(Date.parse(video.checkedAt)));
    assert.equal(new URL(video.officialUrl).searchParams.get("v"), video.youtubeId);
  }
});
test("paths contain valid unique lessons in the correct exam", () => {
  for (const path of LEARNING_PATHS) {
    assert.equal(new Set(path.videoIds).size, path.videoIds.length);
    assert.ok(path.videoIds.length >= 3);
    for (const id of path.videoIds) assert.equal(LEARNING_LIBRARY.find((v) => v.id === id)?.exam, path.exam);
  }
});
test("search combines words with exam, level and duration filters without changing the catalog", () => {
  const before = LEARNING_LIBRARY.map((v) => v.id);
  const found = filterLibrary(LEARNING_LIBRARY, { ...all, exam: "SAT", query: "KHAN   equations", length: "short" }, {});
  assert.ok(found.length >= 2);
  assert.ok(found.every((v) => v.exam === "SAT" && v.durationSeconds < 600));
  const sorted = filterLibrary(LEARNING_LIBRARY, { ...all, sort: "shortest" }, {});
  assert.ok(sorted.every((v, i) => i === 0 || v.durationSeconds >= sorted[i - 1].durationSeconds));
  assert.deepEqual(LEARNING_LIBRARY.map((v) => v.id), before);
  assert.equal(filterLibrary(LEARNING_LIBRARY, { ...all, query: "no matching lesson zzzzz" }, {}).length, 0);
});
test("saved, continue and completed views use the account's progress independently", () => {
  const [a, b, c] = LEARNING_LIBRARY;
  const progress = { [a.id]: { saved: true }, [b.id]: { position: 30, duration: 200 }, [c.id]: { position: 40, duration: 100, completed: true } };
  assert.deepEqual(filterLibrary(LEARNING_LIBRARY, { ...all, view: "saved" }, progress).map((v) => v.id), [a.id]);
  assert.deepEqual(filterLibrary(LEARNING_LIBRARY, { ...all, view: "continue" }, progress).map((v) => v.id), [b.id]);
  assert.deepEqual(filterLibrary(LEARNING_LIBRARY, { ...all, view: "completed" }, progress).map((v) => v.id), [c.id]);
  assert.equal(filterLibrary(LEARNING_LIBRARY, { ...all, view: "saved" }, {}).length, 0);
});
test("progress rejects forged owner fields, invalid paths and impossible positions", () => {
  assert.ok(progressPatchSchema.safeParse({ videoId: "sat-math-linear", saved: true }).success);
  assert.ok(progressPatchSchema.safeParse({ videoId: "sat-math-linear", position: 40, duration: 200 }).success);
  for (const patch of [
    { videoId: "sat-math-linear", saved: true, userId: "other-user" },
    { videoId: "../../secret", saved: true }, { videoId: "id" },
    { videoId: "id", position: 201, duration: 200 }, { videoId: "id", position: -1, duration: 200 },
    { videoId: "id", position: Infinity, duration: 200 }, { videoId: "id", position: 20 },
  ]) assert.equal(progressPatchSchema.safeParse(patch).success, false);
});
test("resume handles completed videos, missing data and recording bounds", () => {
  assert.equal(resumePosition(), 0);
  assert.equal(resumePosition({ position: 80, duration: 100, completed: true }), 0);
  assert.equal(resumePosition({ position: 105, duration: 100 }), 99);
  assert.equal(resumePosition({ position: NaN, duration: 100 }), 0);
  assert.equal(formatTime(125), "2:05");
  assert.equal(formatTime(3601), "1:00:01");
});
