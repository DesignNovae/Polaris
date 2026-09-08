"""Real inference smoke test; artifacts and measured results remain in the local cache."""
import argparse
import json
from pathlib import Path
import time

from config import CACHE, ROOT
from engine import SignEngine
from media import Transcriber, audio_duration

parser = argparse.ArgumentParser()
parser.add_argument("--text", default="The photography workshop starts on Tuesday at six thirty.")
parser.add_argument("--audio", type=Path)
parser.add_argument("--seconds", type=float, default=8)
parser.add_argument("--name", default="smoke")
parser.add_argument("--repeat", type=int, default=1)
args = parser.parse_args()
directory = CACHE / "benchmarks" / args.name
directory.mkdir(parents=True, exist_ok=True)
text = args.text
asr_seconds = None
if args.audio:
    started = time.monotonic()
    duration = audio_duration(args.audio)
    text, start, end = Transcriber().transcribe(args.audio, 0, duration)
    args.seconds = end - start
    asr_seconds = time.monotonic() - started
    print(f"ASR {asr_seconds:.2f}s: {text}", flush=True)
engine = SignEngine()
for index in range(args.repeat):
    result = engine.generate(text, args.seconds, "benchmark-deterministic-seed", directory / f"{index}.bin")
    result.update({"text": text, "asrSeconds": asr_seconds, "mediaSeconds": args.seconds})
    (directory / f"result-{index}.json").write_text(json.dumps(result, indent=2))
    print(json.dumps(result, indent=2), flush=True)
