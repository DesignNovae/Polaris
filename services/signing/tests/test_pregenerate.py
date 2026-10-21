import json

import numpy as np

import engine
import media
import pregenerate


class FakeEngine:
    """Deterministic stand-in for the GPU stage; keeps the real boundary join."""

    def __init__(self):
        self.calls = []

    def motion(self, text, seconds, identity, cancelled=lambda: False, previous_path=None):
        self.calls.append(identity)
        frames = int(seconds * engine.FPS)
        rng = np.random.default_rng(abs(hash(identity)) % 2 ** 32)
        streams = {name: rng.normal(size=(2 if name == "hand" else 1, frames, size)).astype("float32")
                   for name, size in engine.CHANNELS.items()}
        previous = {}
        if previous_path and previous_path.is_file():
            with np.load(previous_path, allow_pickle=False) as values:
                previous = {name: values[name] for name in engine.CHANNELS}
        return engine.join_motion_boundary(streams, previous), frames, 0, {}


class FakeTranscriber:
    def transcribe(self, path, index, duration):
        start = index * media.CHUNK_SECONDS
        return ("" if index == 1 else f"words {index}"), start, min(duration, start + media.CHUNK_SECONDS)


def target(tmp_path):
    source = tmp_path / "part-1.wav"
    source.write_bytes(b"audio")
    return {"id": "exam-ielts-listening-part-1", "kind": "exam", "part": "part-1", "title": "Part 1", "source": source}


def test_sections_use_live_seeds_join_boundaries_and_resume(tmp_path, monkeypatch):
    monkeypatch.setattr(media, "audio_duration", lambda _path: 20.0)
    item, output = target(tmp_path), tmp_path / "out"
    first = FakeEngine()
    info = pregenerate.run(item, output, tmp_path / "sources", first, FakeTranscriber(), 50)
    assert info["complete"] and info["sections"] == 3
    assert first.calls == [f"{info['sourceHash']}:{i}" for i in range(3)]
    folder = output / item["id"]
    sections = []
    for i in range(3):
        with np.load(folder / f"{i}.npz") as values:
            sections.append({name: values[name] for name in values.files})
    for before, after in zip(sections, sections[1:]):
        for name in engine.CHANNELS:
            np.testing.assert_array_equal(after[name][:, 0], before[name][:, -1])
    assert str(sections[1]["text"]) == "" and float(sections[2]["end"]) == 20.0

    (folder / "2.npz").unlink()
    again = FakeEngine()
    assert pregenerate.run(item, output, tmp_path / "sources", again, FakeTranscriber(), 50)["complete"]
    assert again.calls == [f"{info['sourceHash']}:2"]


def test_changed_step_count_discards_inconsistent_sections(tmp_path, monkeypatch):
    monkeypatch.setattr(media, "audio_duration", lambda _path: 10.0)
    item, output = target(tmp_path), tmp_path / "out"
    pregenerate.run(item, output, tmp_path / "sources", FakeEngine(), FakeTranscriber(), 50)
    rerun = FakeEngine()
    pregenerate.run(item, output, tmp_path / "sources", rerun, FakeTranscriber(), 10)
    assert len(rerun.calls) == 2
    assert json.loads((output / item["id"] / "source.json").read_text())["steps"] == 10


def test_targets_cover_exam_parts_first_then_every_catalogue_lesson():
    items = pregenerate.targets()
    assert [t["kind"] for t in items[:4]] == ["exam"] * 4 and all(t["source"].is_file() for t in items[:4])
    lessons = [t for t in items if t["kind"] == "lesson"]
    assert len({t["id"] for t in lessons}) == len(lessons) and all(len(t["youtubeId"]) == 11 for t in lessons)
