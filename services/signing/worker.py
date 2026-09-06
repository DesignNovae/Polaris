"""Authenticated loopback inference service. Start with scripts/signing-worker.mjs."""
import asyncio
from contextlib import asynccontextmanager
from dataclasses import dataclass, field
import hashlib
import logging
import math
from pathlib import Path
import re
import secrets
import shutil
import threading
import time
from typing import Literal
import uuid

from fastapi import Depends, FastAPI, Header, HTTPException, Request
from fastapi.responses import FileResponse
from pydantic import BaseModel, Field

from config import CACHE, ROOT, config
from engine import SignEngine
from media import CHUNK_SECONDS, MAX_UPLOAD, Transcriber, audio_duration, chunk_index, download_youtube

LOG = logging.getLogger("polaris.signing")
JOB_ROOT = CACHE / "jobs"
TTL = 3600
MAX_JOBS = 4
MAX_JOB_BYTES = 3 * 1024 ** 3


@dataclass
class Job:
    id: str
    owner: str
    directory: Path
    scope: dict
    youtube_id: str | None = None
    source: Path | None = None
    source_hash: str = ""
    duration: float = 0
    focus: int = 0
    touched: float = field(default_factory=time.time)
    worked: float = 0
    phase: str = "receiving"
    error: str | None = None
    chunks: dict = field(default_factory=dict)
    cancelled: bool = False
    active: bool = False

    def public(self):
        return {"id": self.id, "scope": self.scope, "duration": self.duration,
                "chunkSeconds": CHUNK_SECONDS, "phase": self.phase, "error": self.error,
                "chunks": {str(k): v for k, v in self.chunks.items()}, "language": "ase"}


class Jobs:
    def __init__(self, engine=None, transcriber=None):
        self.jobs = {}
        self.lock = threading.RLock()
        self.wake = threading.Event()
        self.stop = threading.Event()
        self.engine = engine or SignEngine()
        self.transcriber = transcriber or Transcriber()

    def reserve(self, owner, scope):
        with self.lock:
            self.expire()
            if len(self.jobs) >= MAX_JOBS or sum(j.owner == owner and not j.cancelled for j in self.jobs.values()) >= 2:
                raise HTTPException(429, "Signing capacity is busy. Close another signing player and retry.")
            identity = uuid.uuid4().hex
            directory = JOB_ROOT / identity
            directory.mkdir(parents=True)
            job = Job(identity, owner, directory, scope)
            self.jobs[identity] = job
            return job

    def get(self, identity, owner):
        with self.lock:
            job = self.jobs.get(identity)
            if not job or job.owner != owner or job.cancelled or time.time() - job.touched > TTL:
                raise HTTPException(404, "Signing session expired. Retry to start a new session.")
            job.touched = time.time()
            return job

    def expire(self):
        # Called under the lock. Never remove a directory while its GPU operation is active.
        for identity, job in list(self.jobs.items()):
            if (job.cancelled or time.time() - job.touched > TTL) and not job.active:
                target = job.directory.resolve()
                if target.parent == JOB_ROOT.resolve() and re.fullmatch(r"[a-f0-9]{32}", target.name):
                    shutil.rmtree(target, ignore_errors=True)
                    del self.jobs[identity]

    def run(self):
        while not self.stop.is_set():
            with self.lock:
                self.expire()
                candidates = [j for j in self.jobs.values() if not j.cancelled and not j.error and j.phase != "receiving"
                              and (not j.duration or any(i not in j.chunks for i in self.wanted(j)))]
                job = min(candidates, key=lambda j: j.worked) if candidates else None
                if job:
                    job.active = True
                    job.worked = time.monotonic()
                    job.phase = "generating"
            if not job:
                self.wake.wait(1)
                self.wake.clear()
                continue
            try:
                if job.youtube_id and not job.source:
                    job.phase = "downloading"
                    job.source = download_youtube(job.youtube_id, job.directory)
                if not job.duration:
                    job.duration = audio_duration(job.source)
                if not job.source_hash:
                    digest = hashlib.sha256()
                    with job.source.open("rb") as handle:
                        for block in iter(lambda: handle.read(1024 * 1024), b""):
                            digest.update(block)
                    job.source_hash = digest.hexdigest()
                with self.lock:
                    index = next(i for i in self.wanted(job) if i not in job.chunks)
                job.phase = "transcribing"
                asr_started = time.monotonic()
                text, start, end = self.transcriber.transcribe(job.source, index, job.duration)
                asr_seconds = time.monotonic() - asr_started
                if job.cancelled:
                    raise InterruptedError()
                job.phase = "generating"
                target = job.directory / f"{index}.bin"
                metrics = self.engine.generate(text, end - start, f"{job.source_hash}:{index}", target,
                    lambda: job.cancelled or self.stop.is_set(), job.directory / f"{index - 1}.poses.npz")
                metrics["asrSeconds"] = round(asr_seconds, 3)
                metrics["sourceHash"] = job.source_hash
                with self.lock:
                    job.chunks[index] = {"start": start, "end": end, **metrics}
                    # Bound disk use, retaining nearby sections for immediate backward seeks.
                    total = sum(p.stat().st_size for p in job.directory.glob("*.bin"))
                    for old in sorted(job.chunks, key=lambda i: abs(i - job.focus), reverse=True):
                        if total <= MAX_JOB_BYTES:
                            break
                        path = job.directory / f"{old}.bin"
                        total -= path.stat().st_size
                        path.unlink()
                        path.with_suffix(".poses.npz").unlink(missing_ok=True)
                        del job.chunks[old]
                    job.phase = "ready"
            except InterruptedError:
                job.phase = "cancelled"
            except Exception as error:
                LOG.exception("Signing job %s failed", job.id)
                with self.lock:
                    job.phase = "failed"
                    # Expected decoder/input errors are actionable. Internal paths never leave the worker.
                    job.error = str(error) if isinstance(error, ValueError) else "Local signing failed. Check the worker log, then retry."
            finally:
                job.active = False

    @staticmethod
    def wanted(job):
        count = max(1, math.ceil(job.duration / CHUNK_SECONDS))
        return range(job.focus, min(count, job.focus + 3))


manager = Jobs()


def authenticate(authorization: str = Header(default=""), x_signing_owner: str = Header(default="")):
    expected = config()["token"]
    if len(expected) < 32 or not secrets.compare_digest(authorization, "Bearer " + expected):
        raise HTTPException(401, "Unauthorized")
    if not re.fullmatch(r"[a-f0-9]{64}", x_signing_owner):
        raise HTTPException(401, "Invalid owner")
    return x_signing_owner


@asynccontextmanager
async def lifespan(_app):
    JOB_ROOT.mkdir(parents=True, exist_ok=True)
    # Jobs are transient. Clean only the worker's UUID directories left by a stopped process.
    for directory in JOB_ROOT.iterdir():
        if directory.is_dir() and directory.resolve().parent == JOB_ROOT.resolve() and re.fullmatch(r"[a-f0-9]{32}", directory.name):
            shutil.rmtree(directory, ignore_errors=True)
    thread = threading.Thread(target=manager.run, daemon=True, name="signing-gpu")
    thread.start()
    yield
    manager.stop.set()
    manager.wake.set()
    thread.join(timeout=5)


app = FastAPI(lifespan=lifespan, docs_url=None, redoc_url=None, openapi_url=None)


class CreateJob(BaseModel):
    kind: Literal["youtube", "exam"]
    language: Literal["ase"] = "ase"
    videoId: str | None = Field(default=None, pattern=r"^[A-Za-z0-9_-]{11}$")
    sessionId: str | None = Field(default=None, pattern=r"^[a-fA-F0-9]{24}$")
    part: str | None = Field(default=None, pattern=r"^part-[1-4]$")


class Focus(BaseModel):
    seconds: float = Field(ge=0, le=7200, allow_inf_nan=False)


@app.get("/health")
def health(_owner=Depends(authenticate)):
    ready, message = manager.engine.readiness()
    return {"ready": ready, "message": message, "languages": ["ase"]}


def require_ready():
    ready, message = manager.engine.readiness()
    if not ready:
        raise HTTPException(503, message)


@app.post("/jobs", status_code=202)
def create_job(body: CreateJob, owner=Depends(authenticate)):
    require_ready()
    if body.kind == "youtube":
        if not body.videoId:
            raise HTTPException(400, "A YouTube video ID is required")
        scope = {"kind": "lesson"}
    else:
        if not body.sessionId or not body.part:
            raise HTTPException(400, "An exam session and listening part are required")
        scope = {"kind": "exam", "sessionId": body.sessionId, "part": body.part}
    with manager.lock:
        # React retries and preflight calls share the same owned job rather than competing.
        for existing in manager.jobs.values():
            if existing.owner == owner and existing.scope == scope and not existing.cancelled and not existing.error:
                if body.kind == "exam" or existing.youtube_id == body.videoId:
                    existing.touched = time.time()
                    return existing.public()
        job = manager.reserve(owner, scope)
        if body.kind == "youtube":
            job.youtube_id = body.videoId
        else:
            job.source = ROOT / "assets/exams/ielts-listening" / f"{body.part}.wav"
        job.phase = "queued"
        manager.wake.set()
        return job.public()


@app.post("/jobs/upload", status_code=202)
async def upload(request: Request, owner=Depends(authenticate)):
    require_ready()
    job = manager.reserve(owner, {"kind": "lesson"})
    path = job.directory / "source.media"
    size = 0
    try:
        with path.open("wb") as handle:
            async for block in request.stream():
                size += len(block)
                if size > MAX_UPLOAD:
                    raise HTTPException(413, "Choose a file smaller than 100 MB")
                handle.write(block)
        job.duration = await asyncio.to_thread(audio_duration, path)
        job.source = path
        job.phase = "queued"
        manager.wake.set()
        return job.public()
    except Exception as error:
        job.cancelled = True
        job.phase = "cancelled"
        if isinstance(error, ValueError):
            raise HTTPException(400, str(error)) from error
        raise


@app.get("/jobs/{identity}")
def get_job(identity: str, owner=Depends(authenticate)):
    with manager.lock:
        return manager.get(identity, owner).public()


@app.patch("/jobs/{identity}")
def focus(identity: str, body: Focus, owner=Depends(authenticate)):
    with manager.lock:
        job = manager.get(identity, owner)
        job.focus = chunk_index(body.seconds, job.duration) if job.duration else 0
        manager.wake.set()
        return job.public()


@app.delete("/jobs/{identity}")
def cancel(identity: str, owner=Depends(authenticate)):
    with manager.lock:
        job = manager.get(identity, owner)
        job.cancelled = True
        manager.wake.set()
    return {"cancelled": True}


@app.get("/jobs/{identity}/assets/{asset}")
def asset(identity: str, asset: str, owner=Depends(authenticate)):
    with manager.lock:
        job = manager.get(identity, owner)
        if asset != "topology" and (not re.fullmatch(r"\d{1,3}", asset) or int(asset) not in job.chunks):
            raise HTTPException(404, "Signing section is not ready")
        path = job.directory / f"{asset}.bin"
        if not path.is_file():
            raise HTTPException(404, "Signing section is not ready")
        return FileResponse(path, media_type="application/octet-stream", headers={"Cache-Control": "private, no-store"})
