# Pre-generating sign language for the demo

This runs the sign language model over every catalogue lesson and the four IELTS Listening parts on an NVIDIA GPU (tested on an RTX 3070 8 GB), so the hosted site can play signing without a GPU. It saves only the model's motion (pose) output. **You do not need the SMPL-X file**, and must not be sent one: its license does not allow sharing.

## 1. Set up (skip if the signing worker already runs on this PC)

Requires Git, Node, [uv](https://docs.astral.sh/uv/), an NVIDIA driver supporting CUDA 12.8, about 25 GB free disk, and the Polaris repository. From the project root in PowerShell:

```powershell
uv venv --python 3.10 .cache/signing/venv
uv pip install --python .cache/signing/venv/Scripts/python.exe --extra-index-url https://download.pytorch.org/whl/cu128 -r services/signing/requirements.lock.txt
git clone https://github.com/JianHe0628/SignSparK.git .cache/signing/SignSparK
git -C .cache/signing/SignSparK checkout a08b0d6f799950afa4cbeebea01fda3f6de5c1eb
.cache/signing/venv/Scripts/python.exe services/signing/download_models.py
```

The last step downloads and verifies 16.7 GB of model weights. It resumes if interrupted.

If the weights are already on this PC in another folder, copy them to `.cache/signing/models/hand/ema_0.9999_200000.pt` (and the same for `body` and `face`) before running `download_models.py`. It then only verifies them instead of downloading again.

## 2. Generate

Stop the signing worker first if it is running (it competes for the GPU). Then try the four short exam parts first; they take about a minute:

```powershell
npm run signing:pregenerate -- --exam-only
```

If that works, run everything:

```powershell
npm run signing:pregenerate
```

The full set is about 10.6 hours of media and takes roughly 12 hours at the default quality, so leave it running overnight. It prints progress and an estimate for each video. **You can stop it with Ctrl+C at any time; running the same command again continues where it stopped.** Sleep or a restart is also fine; just rerun.

Useful options:

- `--list` shows the order and lengths without generating anything.
- `--steps 10` is about 2× faster with lower motion quality. Keep the default unless time is short, and use the same value on every run.
- `--max-minutes 15` skips the longest lessons.
- `--only id1,id2` generates specific lessons (ids from `--list`).

Exam parts come first, then the lessons in the guided learning paths, then the rest, shortest first. A partial run is still useful.

A lesson can be skipped if YouTube refuses to provide its audio; the run continues and lists failures at the end.

## 3. Send the result

Zip and send the folder `.cache/signing/pregenerated` (around 1–1.5 GB for everything; Google Drive works). It contains `manifest.json`, then one folder per lesson with `source.json` and numbered `.npz` sections. Do not include `.cache/signing/pregenerate-sources` (downloaded audio, not needed).
