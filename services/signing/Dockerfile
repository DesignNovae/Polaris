# Hosted signing worker. Build from the repository root:
#   docker build -f services/signing/Dockerfile -t polaris-signing .
# Run on an NVIDIA GPU host (8 GB VRAM or more) with a persistent volume at /app/.cache/signing:
#   docker run --gpus all -p 8765:8765 -v polaris-signing:/app/.cache/signing \
#     -e POLARIS_SIGNING_TOKEN=<64 hex chars> polaris-signing
# The licensed SMPL-X file is never baked into the image; copy it into the volume (see entrypoint.sh).
FROM nvidia/cuda:12.8.1-base-ubuntu22.04

ENV DEBIAN_FRONTEND=noninteractive PYTHONUNBUFFERED=1 PIP_NO_CACHE_DIR=1
RUN apt-get update \
 && apt-get install -y --no-install-recommends python3 python3-pip git ca-certificates \
 && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY services/signing/requirements.lock.txt services/signing/
RUN python3 -m pip install --extra-index-url https://download.pytorch.org/whl/cu128 -r services/signing/requirements.lock.txt

COPY services/signing/ services/signing/
COPY assets/exams/ielts-listening/ assets/exams/ielts-listening/
RUN sed -i 's/\r$//' services/signing/entrypoint.sh && chmod +x services/signing/entrypoint.sh

VOLUME /app/.cache/signing
EXPOSE 8765
ENTRYPOINT ["/app/services/signing/entrypoint.sh"]
