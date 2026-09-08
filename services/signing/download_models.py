"""Download the official research weights, resume interrupted transfers, verify SHA-256."""
import concurrent.futures
import hashlib
import json
from pathlib import Path
import threading
import time
import urllib.request

ROOT = Path(__file__).resolve().parents[2]
REVISION = "a51af39fe036b8b286c35c233a0e726291c0ffee"
WEIGHTS = {
    "hand": (5581699849, "5bb8e407ba2c106a22c3b0c16fd1b0fc0f412a58d235143325fdb67efe5916c2"),
    "body": (5580532361, "bf95bb02802b1c46f40afb4424f8f521be6c8641ad8acfe406a666b463e3a380"),
    "face": (5580376713, "841e6ce5c929b142ad8ea3cc152fa67f57e7a8841954bf068df42a5d986ead53"),
}


def digest(path):
    value = hashlib.sha256()
    with path.open("rb") as stream:
        for block in iter(lambda: stream.read(8 * 1024 * 1024), b""):
            value.update(block)
    return value.hexdigest()


def prepare(stream):
    size, sha = WEIGHTS[stream]
    target = ROOT / ".cache/signing/models" / stream / "ema_0.9999_200000.pt"
    target.parent.mkdir(parents=True, exist_ok=True)
    if target.exists() and target.stat().st_size == size and digest(target) == sha:
        print(f"{stream}: verified", flush=True)
        return None
    partial = target.with_suffix(".part")
    url = f"https://huggingface.co/LionelLow/SignSparK/resolve/{REVISION}/{stream}/{target.name}"
    progress = partial.with_suffix(".ranges.json")
    if progress.exists():
        state = json.loads(progress.read_text())
        if state["sha"] != sha:
            raise RuntimeError("Download revision changed")
    else:
        state = {"sha": sha, "prefix": partial.stat().st_size if partial.exists() else 0, "completed": []}
        progress.write_text(json.dumps(state))
    if not partial.exists():
        partial.touch()
    lock = threading.Lock()
    last_report = [0]

    def transfer(bounds):
        start, end = bounds
        for attempt in range(6):
            try:
                request = urllib.request.Request(url, headers={"Range": f"bytes={start}-{end}", "User-Agent": "Polaris-Research/1.0"})
                with urllib.request.urlopen(request, timeout=60) as response:
                    if response.status != 206 or not response.headers.get("Content-Range", "").startswith(f"bytes {start}-{end}/"):
                        raise RuntimeError("Server did not honor the bounded download range")
                    data = response.read(end - start + 2)
                if len(data) != end - start + 1:
                    raise OSError("Incomplete download range")
                with partial.open("r+b", buffering=0) as handle:
                    handle.seek(start)
                    handle.write(data)
                with lock:
                    state["completed"].append([start, end])
                    temporary = progress.with_suffix(".tmp")
                    temporary.write_text(json.dumps(state))
                    temporary.replace(progress)
                    done = state["prefix"] + sum(b - a + 1 for a, b in state["completed"])
                    if time.monotonic() - last_report[0] > 30:
                        print(f"{stream}: {done / size:.1%}", flush=True)
                        last_report[0] = time.monotonic()
                return
            except (OSError, TimeoutError) as error:
                if attempt == 5:
                    raise
                time.sleep(min(2 ** attempt, 15))
    step = 32 * 1024 * 1024
    completed = {a for a, _ in state["completed"]}
    work = [(transfer, (start, min(size - 1, start + step - 1)))
            for start in range(state["prefix"], size, step) if start not in completed]
    return stream, target, partial, progress, sha, size, work


if __name__ == "__main__":
    pending = [item for stream in WEIGHTS if (item := prepare(stream))]
    work = [task for item in pending for task in item[-1]]
    with concurrent.futures.ThreadPoolExecutor(max_workers=8) as pool:
        list(pool.map(lambda task: task[0](task[1]), work))
    for stream, target, partial, progress, sha, size, _ in pending:
        if partial.stat().st_size != size or digest(partial) != sha:
            raise RuntimeError(f"{stream}: checkpoint verification failed; no model was published")
        partial.replace(target)
        progress.unlink()
        print(f"{stream}: SHA-256 verified", flush=True)
