#!/bin/sh
# Prepares the persistent cache on first boot, then serves the worker on all interfaces.
# Put a TLS proxy or tunnel in front of port 8765; the worker itself speaks plain HTTP.
set -eu
CACHE=/app/.cache/signing
SIGNSPARK_COMMIT=a08b0d6f799950afa4cbeebea01fda3f6de5c1eb
export POLARIS_SMPLX_PATH="${POLARIS_SMPLX_PATH:-$CACHE/smplx/SMPLX_NEUTRAL.npz}"

TOKEN="${POLARIS_SIGNING_TOKEN:-}"
if [ "${#TOKEN}" -lt 32 ]; then
  echo "Set POLARIS_SIGNING_TOKEN to a random secret of at least 32 characters (openssl rand -hex 32)." >&2
  exit 1
fi

mkdir -p "$CACHE/smplx"
if [ ! -f "$CACHE/SignSparK/signspark/unet_model.py" ]; then
  rm -rf "$CACHE/SignSparK"
  git clone https://github.com/JianHe0628/SignSparK.git "$CACHE/SignSparK"
  git -C "$CACHE/SignSparK" checkout "$SIGNSPARK_COMMIT"
fi

# Resumes and SHA-256 verifies the ~16.7 GB checkpoints; already verified files are skipped.
python3 /app/services/signing/download_models.py

if [ ! -f "$POLARIS_SMPLX_PATH" ]; then
  echo "Missing licensed SMPL-X mesh at $POLARIS_SMPLX_PATH. Copy SMPLX_NEUTRAL.npz into the volume and restart." >&2
  exit 1
fi

cd /app/services/signing
exec python3 -m uvicorn worker:app --host 0.0.0.0 --port 8765 --no-access-log
