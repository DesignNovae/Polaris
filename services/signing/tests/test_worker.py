import time

from fastapi.testclient import TestClient
import pytest

import worker

OWNER = "a" * 64
OTHER = "b" * 64
TOKEN = "c" * 64


class ReadyEngine:
    @staticmethod
    def readiness():
        return True, "ready"


@pytest.fixture
def client(tmp_path, monkeypatch):
    monkeypatch.setattr(worker, "JOB_ROOT", tmp_path / "jobs")
    monkeypatch.setattr(worker, "config", lambda: {"token": TOKEN})
    monkeypatch.setattr(worker, "manager", worker.Jobs(engine=ReadyEngine()))
    # No lifespan thread: unit tests do not download or impersonate the real model.
    return TestClient(worker.app)


def headers(owner=OWNER):
    return {"Authorization": "Bearer " + TOKEN, "X-Signing-Owner": owner}


def create(client):
    response = client.post("/jobs", headers=headers(), json={"kind": "youtube", "videoId": "abcdefghijk"})
    assert response.status_code == 202
    return response.json()["id"]


def test_worker_rejects_missing_auth_invalid_inputs_and_unsupported_language(client):
    assert client.get("/health").status_code == 401
    assert client.get("/health", headers=headers()).status_code == 200
    for body in [{"kind": "youtube", "videoId": "../../etc"}, {"kind": "youtube"},
                 {"kind": "youtube", "videoId": "abcdefghijk", "language": "bfi"},
                 {"kind": "exam", "part": "../../secret"}]:
        assert client.post("/jobs", headers=headers(), json=body).status_code in (400, 422)


def test_ownership_applies_to_status_seek_delete_and_assets(client):
    identity = create(client)
    for verb, url, extra in [
        ("get", f"/jobs/{identity}", {}),
        ("patch", f"/jobs/{identity}", {"json": {"seconds": 8}}),
        ("get", f"/jobs/{identity}/assets/topology", {}),
        ("delete", f"/jobs/{identity}", {}),
    ]:
        assert getattr(client, verb)(url, headers=headers(OTHER), **extra).status_code == 404
    assert client.get(f"/jobs/{identity}", headers=headers()).status_code == 200


def test_duplicate_retry_capacity_seek_priority_and_no_transcript_leak(client):
    identity = create(client)
    assert create(client) == identity
    job = worker.manager.jobs[identity]
    job.duration = 40
    response = client.patch(f"/jobs/{identity}", headers=headers(), json={"seconds": 25})
    assert response.status_code == 200
    assert list(worker.manager.wanted(job)) == [3, 4]
    assert "source" not in response.json() and "transcript" not in response.json()
    assert client.post("/jobs", headers=headers(), json={"kind": "youtube", "videoId": "bcdefghijkl"}).status_code == 202
    assert client.post("/jobs", headers=headers(), json={"kind": "youtube", "videoId": "cdefghijklm"}).status_code == 429


def test_cancelled_active_job_is_not_deleted_under_running_decoder(client):
    identity = create(client)
    job = worker.manager.jobs[identity]
    job.active = True
    job.phase = "transcribing"
    assert client.delete(f"/jobs/{identity}", headers=headers()).status_code == 200
    worker.manager.expire()
    assert job.directory.exists()
    job.active = False
    worker.manager.expire()
    assert not job.directory.exists()
    assert client.get(f"/jobs/{identity}", headers=headers()).status_code == 404


def test_expired_job_does_not_revive_on_poll(client):
    identity = create(client)
    worker.manager.jobs[identity].touched = time.time() - worker.TTL - 1
    assert client.get(f"/jobs/{identity}", headers=headers()).status_code == 404


def test_oversized_stream_is_rejected_and_cancelled(client, monkeypatch):
    monkeypatch.setattr(worker, "MAX_UPLOAD", 8)
    response = client.post("/jobs/upload", headers=headers(), content=b"x" * 9)
    assert response.status_code == 413
    assert all(job.cancelled for job in worker.manager.jobs.values())
