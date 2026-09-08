"""Exercise consecutive real audio/model sections and measure their motion."""
import argparse
import hashlib
import json
from pathlib import Path
import time

import numpy as np

from diagnostics import motion_metrics
from engine import SignEngine
from media import CHUNK_SECONDS, Transcriber, audio_duration


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("audio", type=Path)
    parser.add_argument("--sections", type=int, default=9)
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--reference", type=Path)
    args = parser.parse_args()
    args.output.mkdir(parents=True, exist_ok=True)
    duration = audio_duration(args.audio)
    source_hash = hashlib.sha256(args.audio.read_bytes()).hexdigest()
    engine, transcriber = SignEngine(), Transcriber()
    results = []
    previous_vertices = None
    for index in range(args.sections):
        if index * CHUNK_SECONDS >= duration:
            break
        started = time.monotonic()
        speech, start, end = transcriber.transcribe(args.audio, index, duration)
        asr_seconds = time.monotonic() - started
        output = args.output / f"{index}.bin"
        generation = engine.generate(speech, end - start, f"{source_hash}:{index}", output,
                                     previous_path=args.output / f"{index - 1}.poses.npz")
        vertices = np.memmap(output, dtype="<f4", offset=16, mode="r", shape=(generation["frames"], 10475, 3))
        if previous_vertices is not None:
            np.testing.assert_allclose(vertices[0], previous_vertices, atol=2e-5)
        previous_vertices = vertices[-1].copy()
        result = {"index": index, "start": start, "end": end, "wordCount": len(speech.split()),
                  "asrSeconds": round(asr_seconds, 3), "generation": generation, "motion": motion_metrics(output)}
        reference = args.reference / output.name if args.reference else None
        if reference and reference.exists():
            result["before"] = motion_metrics(reference)
        results.append(result)
        (args.output / "results.json").write_text(json.dumps(results, indent=2))
        print(json.dumps(result), flush=True)
