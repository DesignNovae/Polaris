"""Read public YouTube metadata for editorial review; never download video/audio."""
import argparse
from concurrent.futures import ThreadPoolExecutor
import json
from pathlib import Path
import re

import yt_dlp

ROOT = Path(__file__).resolve().parents[1]
QUERIES = {
    "IELTS|Listening": ["IELTS Advantage listening tips", "TakeIELTS Official listening question types"],
    "IELTS|Reading": ["IELTS Advantage reading true false not given", "TakeIELTS Official reading tips"],
    "IELTS|Writing": ["IELTS Advantage writing task 2 essay", "TakeIELTS Official writing task 1"],
    "IELTS|Speaking": ["IELTS Advantage speaking part 1 2 3", "TakeIELTS Official speaking tips"],
    "SAT|Math": ["Khan Academy SAT math percentages probability", "Khan Academy SAT math functions exponents"],
    "SAT|Reading and Writing": ["Khan Academy SAT reading writing transitions", "Khan Academy SAT words context punctuation"],
}


def metadata(target):
    label, url = target
    try:
        with yt_dlp.YoutubeDL({"quiet": True, "no_warnings": True, "skip_download": True,
                              "socket_timeout": 20, "retries": 1, "extract_flat": "in_playlist"}) as ydl:
            info = ydl.extract_info(url, download=False)
        entries = list(info.get("entries", [])) if "entries" in info else [info]
        return {"group": label, "entries": [{k: item.get(k) for k in
                ("id", "title", "channel", "channel_id", "duration", "availability", "playable_in_embed", "live_status", "description")}
                for item in entries if item]}
    except Exception as error:
        return {"group": label, "error": str(error)}


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--search", action="store_true")
    parser.add_argument("--selection", type=Path)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    args.output.parent.mkdir(parents=True, exist_ok=True)
    if args.selection:
        targets = [(item["youtubeId"], f'https://www.youtube.com/watch?v={item["youtubeId"]}')
                   for item in json.loads(args.selection.read_text(encoding="utf-8"))]
    elif args.search:
        targets = [(group, f"ytsearch8:{query}") for group, queries in QUERIES.items() for query in queries]
    else:
        source = (ROOT / "lib/action-lab/data.ts").read_text(encoding="utf-8")
        targets = [(video, f"https://www.youtube.com/watch?v={video}") for video in re.findall(r'youtubeId: "([\w-]{11})"', source)]
    results = []
    with ThreadPoolExecutor(max_workers=3) as pool:
        for result in pool.map(metadata, targets):
            results.append(result)
            args.output.write_text(json.dumps(results, indent=2), encoding="utf-8")
            print(json.dumps({"group": result["group"], "count": len(result.get("entries", [])), "error": result.get("error")}), flush=True)
