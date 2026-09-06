"""Real-model diagnostic for the same speech with/without a preceding pose."""
import argparse
import hashlib
import json
from pathlib import Path

from diagnostics import motion_metrics
from engine import SignEngine
from media import Transcriber, audio_duration


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("audio", type=Path)
    parser.add_argument("--previous", type=Path, required=True)
    parser.add_argument("--index", type=int, default=2)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    args.output.mkdir(parents=True, exist_ok=True)
    text, start, end = Transcriber().transcribe(args.audio, args.index, audio_duration(args.audio))
    identity = f"{hashlib.sha256(args.audio.read_bytes()).hexdigest()}:{args.index}"
    print(json.dumps({"speech": text, "start": start, "end": end}), flush=True)
    engine = SignEngine()
    results = []
    for mode, previous in [("preceding-pose", args.previous), ("independent", None)]:
        output = args.output / mode / "0.bin"
        output.parent.mkdir(parents=True, exist_ok=True)
        generation = engine.generate(text, end - start, identity, output, previous_path=previous)
        result = {"mode": mode, "generation": generation, "motion": motion_metrics(output)}
        results.append(result)
        print(json.dumps(result), flush=True)
    (args.output / "comparison.json").write_text(json.dumps(results, indent=2))
