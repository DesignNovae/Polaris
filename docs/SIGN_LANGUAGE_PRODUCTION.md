# Local model-based sign language production

Updated 2026-09-06. Polaris runs the released SignSparK hand, body, and face networks and renders their output through the user's licensed SMPL-X mesh. The supported live path is **English audio → ASL**, for university/research use. Generated signing has not been certified by an ASL interpreter.

## Run on this machine

The isolated Python environment, three verified checkpoints, tokenizer, Whisper, and FFmpeg are installed under `.cache/signing/`. Private worker configuration references the SMPL-X file supplied by the user. These assets and secrets are not committed.

Run in two terminals from the project root:

```powershell
npm run signing:worker
npm run dev
```

In Action Lab → Video Learning, enable the interpreter and select ASL. Choose a lesson, paste an HTTPS YouTube link, or import video/audio. Imported files need decodable English audio, must be at most 100 MB, and cannot exceed two hours. The worker processes files locally; it does not upload them to an AI provider.

In Mock Exams → IELTS Listening, enable signing before playing a part. The worker is checked before the one-play recording is claimed. Use the recording's Play control when signing is ready. Pause, seek, and speed changes follow the recording. The exam timer continues during pauses: this is sign-supported practice, not a claim of standardized IELTS accommodations. Written transcripts and answer keys are not returned to the signing panel.

## Playback and inference

The worker transcribes actual audio with timestamped local Whisper, then generates eight-second sections with SignSparK. It prioritizes the requested section and prepares two sections ahead. Each section is sampled independently from its speech text, with no observed signing keyframes. When a preceding pose is available, a 0.2-second transition blends joint rotations and facial expressions after generation. Frames at and after 0.2 seconds remain exactly as generated. Three.js renders the resulting SMPL-X vertices at 25 fps.

The media clock is authoritative. Unavailable sections pause playback and hide stale geometry. Playback resumes only if it was requested; “Keep playback paused” cancels that intent. Cached backward seeks show the corresponding frame immediately. Uncached seeks request the new section. Paused players with completed lookahead use a slow heartbeat.

Networks run sequentially and remain cached on the GPU when memory permits. Frozen M-CLIP weights stay on the CPU. Parameters use FP16, flow integration uses FP32, and complex RoPE buffers retain their precision.

## Measurements and tests

RTX 3070 8 GB, 25 fps. The default uses the authors' 50-step evaluation setting. Set the worker's `POLARIS_SIGNING_STEPS=10` for the faster setting; neither setting establishes linguistic accuracy.

| Check | Observed result |
|---|---|
| Eight-second motion, 50 steps, first run | 12.250 s; 4,910 MiB peak allocated GPU memory |
| Eight-second motion, 50 steps, warm | 5.953 s; 4,914 MiB peak allocated GPU memory |
| Eight-second motion, 10 steps, first run | 8.234 s; 4,910 MiB peak allocated GPU memory |
| Eight-second motion, 10 steps, warm | 1.422 s; 4,914 MiB peak allocated GPU memory |
| Listening part 1 ASR, downloaded model | 3.422 s for the first eight-second window |
| Listening part 1 motion, new engine | 7.625 s after ASR |
| Real-model regression | Repeated text/seed matched; different text changed motion; joined boundary vertices matched; later frames matched independent generation exactly. Passed at 50 steps in 36.64 s after the motion fix |
| Sustained SAT motion regression | Nine consecutive sections (72 s) of the reported linear-equations lesson; all eight boundaries matched, and movement continued throughout |
| Browser source-clock checks | Paused seeks at 0 and 10 s matched; a paused frame stayed fixed; final source 22.566 s matched signing 22.560 s |
| Timed Listening browser check | Forward seek 10.000 s matched signing 10.000 s; resumed audio 0.222 s matched 0.200 s; paused audio 7.156 s and signing 7.120 s stayed fixed while the timer continued |
| New media browser check | Imported an uncatalogued MP4, sought to an unprepared section at 50 s, and verified buffering, generation, and synchronized completion at 71 s |
| Automated regressions | 20 TypeScript checks and 9 Python service checks passed; the separate opt-in real GPU regression passed at the final 50-step default in 39.17 s |
| Production build | `npm run build` passed compilation, lint, TypeScript validation, and generation of all 58 static pages |

These sample measurements are not worst-case latency or linguistic-accuracy guarantees. Downloads, cold initialization, decoding, transcription, transfers, browser rendering, other GPU workloads, and higher playback rates also affect readiness. Detailed benchmark artifacts are in `.cache/signing/benchmarks/`.

### Motion collapse after the first section

The previous implementation supplied each generated final pose as the next section's observed keyframe. On the reported SAT lesson, that progressively suppressed motion. A controlled comparison used the same 16–24-second audio window, transcript, seed, checkpoint, and 50 steps: conditioning on the preceding pose gave 1.361 mm p95 frame-to-frame vertex movement, versus 15.684 mm for independent sampling. A generated resting pose is not a semantic signing keyframe.

The fix removes that conditioning and joins independently generated sections only at the output boundary. On a sustained rerun of the same source, section movement was 11.516–19.935 mm across all nine sections. At 16–24 s it rose from 1.361 to 16.005 mm; at 64–72 s from 1.591 to 13.337 mm. All eight mesh boundaries matched within 0.02 mm. The separate GPU regression verifies that joining does not modify later model frames, preventing this specific failure from returning. Twelve Python service/unit checks also passed.

The restarted worker was also checked through the actual SAT YouTube player and Three.js renderer. Motion remained visible at 18.200 s and 58.480 s. Pausing held the avatar at 36.080 s; forward seek selected 46.080 s, backward seek returned to 36.080 s, and playback then resumed across later sections. The live worker's generated meshes matched the sustained benchmark metrics.

These measurements establish motion and continuity, not ASL comprehension. Warm generation took 6.625–6.750 s per eight-second section, plus 2.609–2.984 s for transcription on this run, so sustained playback can still need buffering at the 50-step setting.

To repeat the sustained check with real audio (stop the worker first):

```powershell
.cache/signing/venv/Scripts/python.exe services/signing/sustained_benchmark.py path/to/audio.webm --sections 9 --output .cache/signing/benchmarks/sustained-check
```

The full cold-worker exam browser check required over a minute before the first section became visible. Treat the warm inference numbers as model timings, not end-to-end startup promises. The exam avatar appears beside the questions on desktop and stacks without overlap on narrow screens. The test attempt was not submitted with fabricated answers.

```powershell
node --import ./tests/register.mjs --test --test-isolation=none tests/interpreter.model.test.ts tests/interpreter.live.test.ts tests/exams.scoring.test.ts
npm run signing:test
```

Stop the worker before the opt-in real GPU regression to avoid competing GPU processes:

```powershell
$env:POLARIS_SIGNING_REAL_TEST = '1'
.cache/signing/venv/Scripts/python.exe -m pytest services/signing/tests/test_real_model.py -q
```

Benchmark real inference:

```powershell
.cache/signing/venv/Scripts/python.exe services/signing/benchmark.py --seconds 8 --repeat 2 --name warm-check
```

## Install on another Windows machine

Requires Git, Node, uv, and NVIDIA drivers compatible with CUDA 12.8. Python 3.10 is the tested environment:

```powershell
uv venv --python 3.10 .cache/signing/venv
uv pip install --python .cache/signing/venv/Scripts/python.exe --extra-index-url https://download.pytorch.org/whl/cu128 -r services/signing/requirements.lock.txt
git clone https://github.com/JianHe0628/SignSparK.git .cache/signing/SignSparK
git -C .cache/signing/SignSparK checkout a08b0d6f799950afa4cbeebea01fda3f6de5c1eb
.cache/signing/venv/Scripts/python.exe services/signing/download_models.py
npm ci
npm run signing:worker -- --smplx "C:\path\to\SMPLX_NEUTRAL.npz"
```

The downloader resumes bounded ranges and verifies each file's pinned SHA-256 before publishing it. Checkpoints total approximately 16.7 GB; allow additional space for the environment, speech model, and generated meshes. First speech/tokenizer use downloads their public assets. Do not commit or redistribute the licensed SMPL-X file.

## Service boundaries

- Worker binds only `127.0.0.1:8765`. A random server-only bearer token lives in `.cache/signing/worker-config.json`. `POLARIS_SIGNING_TOKEN` and `POLARIS_SMPLX_PATH` support overrides.
- Next routes require authentication. Worker ownership applies to status, seeks, cancellation, and assets. Exam metadata additionally requires the active owned exam; geometry requires the corresponding recording claim.
- No transcript, answer key, or source filesystem path appears in job responses.
- Maximum four jobs, two per user, one inference queue, two-section lookahead, one-hour inactivity expiry, and 3 GiB of meshes per job. Browser memory retains nearby sections only.
- Jobs are transient and cleared on worker restart. Retry re-imports a retained file or recreates an exam job.
- Next and the worker must run on the same machine. A hosted application cannot use its own loopback address to reach a student's laptop; remote deployment needs a separately secured GPU service.

## Accuracy and limits

Live ASL currently supports English audio. BSL and ISL are explicitly unsupported in this live path. The upstream multilingual release does not automatically validate every spoken/sign-language pairing.

Whisper may mishear names, numbers, accents, or noisy audio. Eight-second windows may split clauses. Independently trained streams may produce incorrect grammar or poorly coordinated motion. The brief boundary transition improves geometric continuity when the preceding section exists; it does not validate linguistic meaning. An uncached seek may have no preceding section.

An ASL-fluent reviewer should assess comprehension, negation, numbers, names, facial grammar, and transitions on representative lessons before instructional or assessment reliance. No sketch or AI topic outline is labeled as real model signing. The older prepared-MP4 manifest API remains available; its empty manifest does not block live generation. AI speech-synthesis practice outside the timed Mock Exams runner still uses the older interface.

YouTube audio must be publicly accessible to the normal downloader. No login cookies or access-control bypass are used. If audio cannot be obtained, import the original file. This implementation does not claim perfect interpretation of every unknown video or zero startup delay.

## Sources

- [SignSparK source](https://github.com/JianHe0628/SignSparK), pinned `a08b0d6f799950afa4cbeebea01fda3f6de5c1eb`, Apache-2.0.
- [Official checkpoints](https://huggingface.co/LionelLow/SignSparK), pinned `a51af39fe036b8b286c35c233a0e726291c0ffee`, non-commercial research restrictions.
- [Authors' rendering conventions](https://github.com/JianHe0628/SignSparK/blob/main/VISUALIZATION.md).
- [SMPL-X licensed model](https://smpl-x.is.tue.mpg.de/).
