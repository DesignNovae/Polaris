"""Measure saved model motion without rendering or exposing worker credentials."""
import argparse
import json
from pathlib import Path
import struct

import numpy as np


def motion_metrics(path):
    with Path(path).open("rb") as handle:
        magic, frames, vertices, fps = struct.unpack("<4sIII", handle.read(16))
    if magic != b"PLS1":
        raise ValueError("Not a signing mesh")
    values = np.memmap(path, dtype="<f4", offset=16, mode="r", shape=(frames, vertices, 3))
    steps = np.linalg.norm(np.diff(values, axis=0), axis=-1)
    ranges = np.linalg.norm(np.ptp(values, axis=0), axis=-1)
    # Millimetres in SMPL-X space. These diagnose animation, not sign accuracy.
    return {"frames": frames, "fps": fps,
            "vertexRangeP95Mm": round(float(np.percentile(ranges, 95)) * 1000, 3),
            "frameMovementP95Mm": round(float(np.percentile(steps, 95)) * 1000, 3),
            "perSecondMovementMm": [round(float(np.percentile(steps[i:i + fps], 95)) * 1000, 3)
                                    for i in range(0, len(steps), fps)]}


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("directory", type=Path)
    args = parser.parse_args()
    for path in sorted(args.directory.glob("*.bin"), key=lambda p: int(p.stem) if p.stem.isdigit() else 10000):
        if path.stem.isdigit():
            print(json.dumps({"chunk": int(path.stem), **motion_metrics(path)}), flush=True)
