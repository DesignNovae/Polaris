import struct

import numpy as np
import pytest

import compact


def mesh(path, frames=50, vertices=10475, seed=0):
    rng = np.random.default_rng(seed)
    rest = rng.uniform([-0.9, -1.1, -0.2], [0.9, 0.6, 0.2], size=(vertices, 3)).astype("<f4")
    moving = np.zeros((frames, vertices, 3), "<f4")
    # Hands and face move, the lower body stays still, like real signing sections.
    moving[:, :3000] = np.cumsum(rng.normal(0, 0.002, (frames, 3000, 3)), axis=0)
    values = rest + moving
    path.write_bytes(struct.pack("<4sIII", b"PLS1", frames, vertices, 25) + values.tobytes())
    return values


def test_round_trip_keeps_every_frame_within_quantization_step(tmp_path):
    original = mesh(tmp_path / "0.bin")
    data = compact.write(tmp_path / "0.bin").read_bytes()
    decoded, fps = compact.decode(data)
    assert fps == 25 and decoded.shape == original.shape
    step = np.frombuffer(data, "<f4", 3, 28)
    assert np.all(np.abs(decoded - original) <= step / 2 + 1e-6)
    assert np.abs(decoded - original).max() <= 1.01e-4  # metres: 0.1 mm plus float32 rounding
    assert len(data) < original.nbytes / 4


def test_rejects_non_pls1_input(tmp_path):
    (tmp_path / "bad.bin").write_bytes(b"NOPE" + bytes(12))
    with pytest.raises(ValueError):
        compact.encode(tmp_path / "bad.bin")


def test_fast_wrapping_motion_round_trips(tmp_path):
    # Large per-frame jumps overflow 16-bit residuals; wrapping must still decode exactly.
    rng = np.random.default_rng(3)
    values = rng.uniform(-1, 1, size=(30, 400, 3)).astype("<f4")
    data = compact.encode_array(values)
    decoded, _ = compact.decode(data)
    step = np.frombuffer(data, "<f4", 3, 28)
    assert np.all(np.abs(decoded - values) <= step / 2 + 1e-6)
