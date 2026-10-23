"""Turn pre-generated motion into static PLS2 files the hosted site plays without a GPU.

Reads the sections written by pregenerate.py, builds each mesh with the licensed
SMPL-X model on the CPU (the same _vertices step the live worker uses), encodes it
as compact PLS2, and records the lesson in data/interpreter/pregenerated.json.

    .cache/signing/venv/Scripts/python.exe services/signing/export_static.py --only ielts-listening-topics,sat-rw-evidence

Output defaults to public/signing (served by Next at /signing). Only complete lesson
videos are exported; exam parts are skipped because exam signing needs the live worker.
"""
import argparse
from datetime import datetime, timezone
import json
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[2]
MANIFEST = ROOT / "data/interpreter/pregenerated.json"


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--source", type=Path, default=ROOT / ".cache/signing/pregenerated")
    parser.add_argument("--output", type=Path, default=ROOT / "public/signing")
    parser.add_argument("--only", help="Comma-separated catalogue ids to export (default: every complete lesson)")
    args = parser.parse_args()

    import numpy as np
    import compact
    from engine import CHANNELS, FPS, SignEngine
    from config import config
    if not Path(config()["smplx"]).is_file():
        sys.exit("Configure the licensed SMPLX_NEUTRAL.npz (worker-config.json \"smplx\" or POLARIS_SMPLX_PATH).")

    wanted = {value.strip() for value in args.only.split(",")} if args.only else None
    folders = sorted(path for path in args.source.iterdir() if (path / "source.json").is_file())
    infos = [json.loads((folder / "source.json").read_text(encoding="utf-8")) for folder in folders]
    chosen = [(folder, info) for folder, info in zip(folders, infos)
              if info.get("kind") == "lesson" and (wanted is None or info["id"] in wanted)]
    if wanted and (missing := wanted - {info["id"] for _, info in chosen}):
        sys.exit("Not found among generated lessons: " + ", ".join(sorted(missing)))
    for _, info in chosen:
        if not info.get("complete"):
            sys.exit(f"{info['id']} is not completely generated yet; rerun pregenerate.py first.")

    engine = SignEngine()
    manifest = json.loads(MANIFEST.read_text(encoding="utf-8")) if MANIFEST.exists() else {}
    manifest.setdefault("format", "polaris-pregenerated-mesh/1")
    videos = manifest.setdefault("videos", {})
    args.output.mkdir(parents=True, exist_ok=True)
    total = 0
    for folder, info in chosen:
        target = args.output / info["id"]
        target.mkdir(parents=True, exist_ok=True)
        sections, size = [], 0
        for index in range(info["sections"]):
            with np.load(folder / f"{index}.npz", allow_pickle=False) as values:
                streams = {name: values[name] for name in CHANNELS}
                start, end, frames = float(values["start"]), float(values["end"]), int(values["frames"])
                silence = not str(values["text"]).strip()
            vertices, faces = engine._vertices(streams)
            data = compact.encode_array(vertices, FPS)
            path = target / f"{index}.pls2"
            path.write_bytes(data)
            size += len(data)
            sections.append([round(start, 3), round(end, 3), frames, silence])
            if index == 0 and not (args.output / "topology.bin").exists():
                (args.output / "topology.bin").write_bytes(faces.astype("<u4").tobytes())
            print(f"  {info['id']} {index + 1}/{info['sections']}: {len(data) / 1024 ** 2:.2f} MB", flush=True)
        # Transcripts stay out of the public manifest; only timing is needed for playback.
        videos[info["id"]] = {"youtubeId": info["youtubeId"], "duration": round(info["duration"], 3),
                              "chunkSeconds": info["chunkSeconds"], "steps": info["steps"],
                              "generatedAt": datetime.now(timezone.utc).strftime("%Y-%m-%d"), "sections": sections}
        total += size
        print(f"{info['id']}: {len(sections)} sections, {size / 1024 ** 2:.0f} MB "
              f"(largest {max((target / f'{i}.pls2').stat().st_size for i in range(len(sections))) / 1024 ** 2:.2f} MB)", flush=True)
    # Static hosts that read _headers (Cloudflare Pages, Netlify) then allow the site to fetch these files.
    (args.output / "_headers").write_text("/*\n  Access-Control-Allow-Origin: *\n  Cache-Control: public, max-age=86400\n", encoding="utf-8")
    MANIFEST.write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")
    print(f"Exported {len(chosen)} lessons, {total / 1024 ** 2:.0f} MB, to {args.output}; updated {MANIFEST.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
