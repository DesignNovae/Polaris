"""Text-only SignSparK inference using the authors' pinned network and weights.

No procedural sign library, keyframe retrieval, or invented translation is used.
The three flow networks are moved onto the GPU sequentially to fit an 8 GB card.
"""
import gc
import hashlib
import math
from pathlib import Path
import struct
import sys
import time

from config import CACHE, config
from download_models import WEIGHTS, REVISION

SOURCE_REVISION = "a08b0d6f799950afa4cbeebea01fda3f6de5c1eb"
FPS = 25
CHANNELS = {"hand": 90, "body": 60, "face": 56}
TRANSITION_FRAMES = 6


def rotation_matrices(features):
    import numpy as np
    values = features.reshape(-1, 6)
    a, b = values[:, :3], values[:, 3:]
    first = a / np.maximum(np.linalg.norm(a, axis=-1, keepdims=True), 1e-8)
    b = b - (first * b).sum(-1, keepdims=True) * first
    second = b / np.maximum(np.linalg.norm(b, axis=-1, keepdims=True), 1e-8)
    matrices = np.stack([first, second, np.cross(first, second)], axis=-2)
    bad = np.abs(np.linalg.det(matrices) - 1) > .01
    matrices[bad] = np.eye(3)
    return matrices


def axis_angle(features, left=False):
    from scipy.spatial.transform import Rotation
    import numpy as np
    matrices = rotation_matrices(features)
    if left:
        flip = np.diag([1., -1., -1.])
        matrices = flip @ matrices @ flip
    return Rotation.from_matrix(matrices).as_rotvec().astype("float32").reshape(len(features), -1)


def join_motion_boundary(streams, previous):
    """Join independently generated clips with a short rotation-space transition.

    A preceding generated pose is not a linguistic keyframe. Feeding it into the
    network suppresses motion throughout subsequent clips. Only the first 0.2 s
    is blended here; every later model frame, including the final pose, is intact.
    """
    import numpy as np
    from scipy.spatial.transform import Rotation

    for name, values in streams.items():
        if name not in previous:
            continue
        prior = previous[name]
        if prior.ndim != 3 or prior.shape[0] != values.shape[0] or prior.shape[2] != values.shape[2] or not np.isfinite(prior).all():
            raise ValueError("Invalid preceding signing pose")
        count = min(TRANSITION_FRAMES, values.shape[1])
        if count < 2:
            continue
        fraction = np.linspace(0, 1, count, dtype="float32")[:-1]
        fraction = fraction * fraction * (3 - 2 * fraction)
        rotations = 6 if name == "face" else values.shape[2]
        targets = values[:, :count - 1, :rotations]
        origins = np.broadcast_to(prior[:, -1:, :rotations], targets.shape)
        start = Rotation.from_matrix(rotation_matrices(origins))
        end = Rotation.from_matrix(rotation_matrices(targets))
        alpha = np.broadcast_to(fraction[None, :, None], (*targets.shape[:2], rotations // 6)).reshape(-1, 1)
        blended = start * Rotation.from_rotvec((start.inv() * end).as_rotvec() * alpha)
        values[:, :count - 1, :rotations] = blended.as_matrix()[:, :2].reshape(targets.shape)
        if name == "face":
            alpha = fraction[None, :, None]
            values[:, :count - 1, 6:] = prior[:, -1:, 6:] * (1 - alpha) + values[:, :count - 1, 6:] * alpha
        values[:, 0] = prior[:, -1]
    return streams


class SignEngine:
    def __init__(self):
        self.encoder = None
        self.tokenizer = None
        self.mesh = None
        self.states = {}
        self.models = {}

    @staticmethod
    def readiness():
        settings = config()
        missing = [stream for stream in CHANNELS if not (CACHE / "models" / stream / "ema_0.9999_200000.pt").is_file()]
        if missing:
            return False, "Model download incomplete: " + ", ".join(missing)
        if not Path(settings["smplx"]).is_file():
            return False, "Configure the licensed SMPLX_NEUTRAL.npz file"
        if not (CACHE / "SignSparK/signspark/unet_model.py").is_file():
            return False, "Install the pinned SignSparK source"
        return True, "Models installed"

    def _state(self, stream):
        import torch
        if stream not in self.states:
            path = CACHE / "models" / stream / "ema_0.9999_200000.pt"
            # weights_only avoids arbitrary Python deserialization; mmap bounds resident RAM.
            state = torch.load(path, map_location="cpu", weights_only=True, mmap=True)
            self.states[stream] = state.get("state_dict", state)
        return self.states[stream]

    def _text(self, text):
        import torch
        from transformers import AutoTokenizer, XLMRobertaConfig, XLMRobertaModel
        state = self._state("hand")
        if self.encoder is None:
            # Released checkpoints include the frozen M-CLIP encoder. Build its known
            # architecture on meta, then assign those exact weights without downloading
            # a second 2.2 GB copy. Tokenizer is the authors' specified tokenizer.
            with torch.device("meta"):
                encoder = XLMRobertaModel(XLMRobertaConfig(vocab_size=250002, hidden_size=1024,
                    num_hidden_layers=24, num_attention_heads=16, intermediate_size=4096,
                    max_position_embeddings=514, type_vocab_size=1, pad_token_id=1,
                    bos_token_id=0, eos_token_id=2, layer_norm_eps=1e-5))
                projection = torch.nn.Linear(1024, 640)
            prefix = "text_enc_model.transformer."
            encoder.load_state_dict({k[len(prefix):]: v for k, v in state.items() if k.startswith(prefix)}, strict=True, assign=True)
            encoder.embeddings.position_ids = torch.arange(514).expand((1, -1))
            encoder.embeddings.token_type_ids = torch.zeros((1, 514), dtype=torch.long)
            prefix = "text_enc_model.LinearTransformation."
            projection.load_state_dict({k[len(prefix):]: v for k, v in state.items() if k.startswith(prefix)}, strict=True, assign=True)
            self.encoder = (encoder.eval(), projection.eval())
            self.tokenizer = AutoTokenizer.from_pretrained("M-CLIP/XLM-Roberta-Large-Vit-B-16Plus")
        encoder, projection = self.encoder
        tokens = self.tokenizer([f"<ASL> {text}"], padding=True, truncation=True, max_length=256, return_tensors="pt")
        with torch.inference_mode():
            embeddings = encoder(**tokens)[0]
            pooled = (embeddings * tokens["attention_mask"].unsqueeze(-1)).sum(1) / tokens["attention_mask"].sum(1, keepdim=True)
            return projection(pooled).cuda().float()

    def _sample(self, stream, embedding, frames, seed, cancelled):
        import torch
        sys.path.insert(0, str(CACHE / "SignSparK")) if str(CACHE / "SignSparK") not in sys.path else None
        from signspark.unet_model import Wilor_UNET
        from signspark.unet_model_large import precompute_freqs_cis

        class CachedTextUNet(Wilor_UNET):
            def load_and_freeze_clip(self, _version):
                return torch.nn.Identity(), None

            def encode_text(self, raw_text):
                return self.cached_embedding.expand(len(raw_text), -1)

        settings = config()
        steps = max(4, min(50, settings["steps"]))
        guidance = settings["guidance"]
        if stream not in self.models:
            # Keep warm networks only while the GPU has room for another stream
            # plus activations. The 3070 can usually retain all three (~4.8 GiB).
            while self.models and torch.cuda.mem_get_info()[0] < 2 * 1024 ** 3:
                self.models.pop(next(iter(self.models)))
                gc.collect(); torch.cuda.empty_cache()
            with torch.device("meta"):
                model = CachedTextUNet(njoints=CHANNELS[stream], attention=False, dataset=stream,
                                        latent_dim=512, unet_out_mult=8, length_mask_conditioned=True)
            weights = {k: v.to(device="cuda", dtype=torch.float16) if v.is_floating_point() else v.to("cuda")
                       for k, v in self._state(stream).items() if not k.startswith("text_enc_model.")}
            model.load_state_dict(weights, strict=True, assign=True)
            for module in model.modules():
                if hasattr(module, "freqs_cis"):
                    # RoPE must remain complex64; Module.to(dtype=half) would discard
                    # its imaginary component and silently corrupt every attention block.
                    module.freqs_cis = precompute_freqs_cis(module.head_dim, module._rope_len, device="cuda")
            self.models[stream] = model.eval()
            del weights
        model = self.models[stream]
        model.cached_embedding = embedding
        count = 2 if stream == "hand" else 1
        length = max(32, math.ceil(frames / 16) * 16)
        generator = torch.Generator(device="cuda").manual_seed(seed)
        x = torch.randn(count, CHANNELS[stream], length, device="cuda", generator=generator)
        zeros = torch.zeros_like(x)
        observed = torch.zeros_like(x, dtype=torch.bool)
        # Text-only sampling: no actual signing keyframes were supplied. A prior
        # generated resting pose must not condition this section's sign content.
        mask = (torch.arange(length, device="cuda") < frames).reshape(1, 1, length).expand(count, -1, -1)
        conditions = {"text": [""] * count, "mask": mask}
        try:
            with torch.inference_mode(), torch.autocast("cuda", dtype=torch.float16):
                for step in range(steps):
                    if cancelled():
                        raise InterruptedError("Signing generation cancelled")
                    t = torch.full((count,), step / steps, device="cuda")
                    velocity = model(x, t, y=conditions, obs_x0=zeros, obs_mask=observed)
                    if guidance != 1:
                        unconditional = model(x, t, y={**conditions, "uncond": True}, obs_x0=zeros, obs_mask=observed)
                        velocity = unconditional + guidance * (velocity - unconditional)
                    x = torch.where(observed, zeros, x + velocity.float() / steps)
                if not torch.isfinite(x).all():
                    raise RuntimeError("Model produced non-finite motion; no animation was published")
                return x[:, :, :frames].permute(0, 2, 1).cpu().numpy()
        finally:
            del model

    def _vertices(self, streams):
        import torch
        import numpy as np
        import smplx
        if self.mesh is None:
            self.mesh = smplx.SMPLX(config()["smplx"], gender="neutral", use_pca=False,
                flat_hand_mean=True, num_betas=10, num_expression_coeffs=50).eval()
        body, hands, face = streams["body"][0], streams["hand"], streams["face"][0]
        n = len(body)
        poses = {
            "body_pose": np.concatenate([np.zeros((n, 33), dtype="float32"), axis_angle(body)], axis=1),
            "left_hand_pose": axis_angle(hands[0], left=True), "right_hand_pose": axis_angle(hands[1]),
            "jaw_pose": axis_angle(face[:, :6]), "expression": face[:, 6:],
            "betas": np.zeros((n, 10), dtype="float32"),
        }
        for name in ("global_orient", "transl", "leye_pose", "reye_pose"):
            poses[name] = np.zeros((n, 3), dtype="float32")
        vertices = []
        with torch.inference_mode():
            for start in range(0, n, 16):
                result = self.mesh(**{name: torch.from_numpy(value[start:start + 16]) for name, value in poses.items()})
                vertices.append(result.vertices.numpy())
        return np.concatenate(vertices).astype("<f4"), self.mesh.faces.astype("<u4")

    def generate(self, text, seconds, identity, output, cancelled=lambda: False, previous_path=None):
        import numpy as np
        import torch
        ready, reason = self.readiness()
        if not ready:
            raise RuntimeError(reason)
        if not torch.cuda.is_available():
            raise RuntimeError("CUDA GPU unavailable. Install the NVIDIA driver and the CUDA PyTorch environment.")
        torch.set_num_threads(4)
        torch.cuda.reset_peak_memory_stats()
        started = time.monotonic()
        phases = {}
        previous = {}
        if previous_path and Path(previous_path).is_file():
            with np.load(previous_path, allow_pickle=False) as values:
                previous = {name: values[name] for name in CHANNELS}
        frames = max(1, min(304, math.ceil(seconds * FPS)))
        if text:
            embedding = self._text(text)
            phases["textSeconds"] = round(time.monotonic() - started, 3)
            seed = int(hashlib.sha256(identity.encode()).hexdigest()[:8], 16)
            streams = {}
            for index, stream in enumerate(CHANNELS):
                stage_start = time.monotonic()
                streams[stream] = self._sample(stream, embedding, frames, seed + index, cancelled)
                phases[f"{stream}Seconds"] = round(time.monotonic() - stage_start, 3)
        else:
            # Silence is an explicit resting pose, never a stand-in for translated speech.
            identity_rotation = np.array([1, 0, 0, 0, 1, 0], dtype="float32")
            streams = {name: np.tile(identity_rotation, (2 if name == "hand" else 1, frames, channels // 6))
                       for name, channels in CHANNELS.items() if name != "face"}
            streams["face"] = np.concatenate([np.tile(identity_rotation, (1, frames, 1)), np.zeros((1, frames, 50), dtype="float32")], axis=2)
            from scipy.spatial.transform import Rotation
            for joint, angle in [(4, -1.2), (5, 1.2)]:
                rest = Rotation.from_rotvec([0, 0, angle]).as_matrix()[:2].reshape(6)
                streams["body"][0, :, joint * 6:joint * 6 + 6] = rest
        stage_start = time.monotonic()
        streams = join_motion_boundary(streams, previous)
        vertices, faces = self._vertices(streams)
        phases["meshSeconds"] = round(time.monotonic() - stage_start, 3)
        if not np.isfinite(vertices).all():
            raise RuntimeError("Invalid mesh; animation was not published")
        output = Path(output)
        temporary = output.with_suffix(".tmp")
        with temporary.open("wb") as handle:
            handle.write(struct.pack("<4sIII", b"PLS1", frames, vertices.shape[1], FPS))
            handle.write(vertices.tobytes())
        temporary.replace(output)
        pose_path = output.with_suffix(".poses.npz")
        with pose_path.with_suffix(".tmp").open("wb") as handle:
            np.savez(handle, **streams)
        pose_path.with_suffix(".tmp").replace(pose_path)
        topology = output.parent / "topology.bin"
        if not topology.exists():
            temporary = topology.with_suffix(".tmp")
            temporary.write_bytes(faces.tobytes())
            temporary.replace(topology)
        return {"seconds": round(time.monotonic() - started, 3), "frames": frames, "fps": FPS,
                "peakVramMB": round(torch.cuda.max_memory_allocated() / 1024 ** 2),
                "modelRevision": REVISION, "sourceRevision": SOURCE_REVISION, "silence": not bool(text),
                "steps": config()["steps"], "review": "unreviewed", **phases}
