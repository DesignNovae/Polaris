"""Publish an editorial selection only after real public metadata validation."""
import argparse
from datetime import datetime, timezone
import json
from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[1]
parser = argparse.ArgumentParser()
parser.add_argument("metadata", nargs="+", type=Path)
args = parser.parse_args()
metadata = {}
for path in args.metadata:
    for result in json.loads(path.read_text(encoding="utf-8")):
        for entry in result.get("entries", []):
            metadata[entry["id"]] = entry
source = (ROOT / "lib/action-lab/data.ts").read_text(encoding="utf-8").split("export const LEARNING_VIDEOS:", 1)[1]
originals = [dict(re.findall(r'(\w+): "([^"]*)"', line)) for line in source.splitlines() if 'youtubeId:' in line]
additions = json.loads((ROOT / "data/learning/additions.json").read_text(encoding="utf-8"))
videos = []
for item in originals + additions:
    info = metadata[item["youtubeId"]]
    if info.get("availability") != "public" or info.get("playable_in_embed") is not True or not 0 < (info.get("duration") or 0) <= 7200:
        raise ValueError(f'Cannot publish unverified or unsupported video: {item["youtubeId"]}')
    video = {**item, "id": item.get("id", "lesson-" + item["youtubeId"]), "durationSeconds": info["duration"],
             "duration": item.get("duration", "Skill lesson"), "source": info["channel"].strip(),
             "sourceTitle": info["title"], "channelId": info["channel_id"],
             "officialUrl": f'https://www.youtube.com/watch?v={item["youtubeId"]}',
             "level": item.get("level", "Practice" if "test" in item.get("duration", "").lower() or "practice" in item.get("duration", "").lower() else "Foundation"),
             "skill": item.get("skill", item["title"]), "checkedAt": datetime.now(timezone.utc).isoformat()}
    videos.append(video)
assert len({v["youtubeId"] for v in videos}) == len(videos), "Duplicate video"
destination = ROOT / "data/learning/catalog.json"
destination.write_text(json.dumps(videos, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
print(f"Published {len(videos)} verified catalog entries.")
