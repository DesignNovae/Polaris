"""Local-only worker configuration. Licensed assets and secrets stay out of git."""
import json
import os
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
CACHE = ROOT / ".cache/signing"
CONFIG_FILE = CACHE / "worker-config.json"


def config():
    value = json.loads(CONFIG_FILE.read_text()) if CONFIG_FILE.exists() else {}
    return {
        "token": os.environ.get("POLARIS_SIGNING_TOKEN", value.get("token", "")),
        "smplx": os.environ.get("POLARIS_SMPLX_PATH", value.get("smplx", "")),
        "steps": int(os.environ.get("POLARIS_SIGNING_STEPS", "50")),
        "guidance": float(os.environ.get("POLARIS_SIGNING_GUIDANCE", "1")),
    }


def configure_environment():
    os.environ.setdefault("HF_HOME", str(CACHE / "huggingface"))
    os.environ.setdefault("TOKENIZERS_PARALLELISM", "false")
    os.environ.setdefault("HF_HUB_DISABLE_XET", "1")


configure_environment()
