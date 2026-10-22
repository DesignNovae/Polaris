"""Compact mesh transport (PLS2) for hosted playback.

PLS1 sends float32 vertices: about 25 MB per eight-second section, too much for a
judge's connection or static hosting. PLS2 keeps every frame and vertex, but
quantizes positions to a 0.2 mm grid (at most 0.1 mm from the model's output, about
30x smaller than one rendered pixel), then predicts each value from the previous
two frames and from the preceding vertex, so smooth motion leaves small residuals.
Low and high bytes are split into planes and deflated. Measured on real signing
sections: about 3 MB per eight seconds, versus 6 MB with plain frame deltas.

Layout: "PLS2", frames, vertices, fps (u32), axis minimum[3], axis step[3] (f32),
then zlib(low bytes, high bytes) of int16 residuals in frame, vertex, axis order.
Residual r[t, v] = d2[t, v] - d2[t, v - 1], where d2 is the second temporal
difference (first difference at t = 1, the value itself at t = 0). Every operation
wraps at 16 bits, identically in the decoder. The pose streams are unchanged.
"""
from pathlib import Path
import struct
import zlib

HEADER = struct.Struct("<4sIII")


def encode(source):
    import numpy as np
    source = Path(source)
    with source.open("rb") as handle:
        magic, frames, vertices, fps = HEADER.unpack(handle.read(HEADER.size))
    if magic != b"PLS1":
        raise ValueError("Not a PLS1 mesh")
    return encode_array(np.fromfile(source, dtype="<f4", offset=HEADER.size).reshape(frames, vertices, 3), fps)


GRID = 0.0002  # metres


def wrap(values):
    import numpy as np
    return values.astype(np.int64).astype(np.int16)


def encode_array(values, fps=25):
    """Encode float vertices shaped (frames, vertices, 3)."""
    import numpy as np
    values = np.asarray(values, dtype="<f4")
    frames, vertices, _ = values.shape
    if not np.isfinite(values).all():
        raise ValueError("Invalid mesh; animation was not published")
    low = values.min(axis=(0, 1)).astype("<f4")
    step = np.maximum((values.max(axis=(0, 1)).astype(np.float64) - low) / 65535, GRID).astype("<f4")
    quantized = np.rint((values - low) / step).clip(0, 65535).astype(np.int64) - 32768
    first = quantized.copy()
    first[1:] = quantized[1:] - quantized[:-1]
    second = first.copy()
    second[2:] = first[2:] - first[1:-1]
    residual = wrap(second).astype(np.int64)
    residual[:, 1:] = residual[:, 1:] - wrap(second)[:, :-1]
    pairs = wrap(residual).astype("<i2").reshape(-1).view(np.uint8).reshape(-1, 2)
    planes = np.concatenate([pairs[:, 0], pairs[:, 1]]).tobytes()
    # Level 6: measured 4% larger than level 9 but 13x faster to export.
    return HEADER.pack(b"PLS2", frames, vertices, fps) + low.tobytes() + step.tobytes() + zlib.compress(planes, 6)


def decode(data):
    """Reference decoder used by tests; the browser mirrors this in lib/interpreter/model/live.ts."""
    import numpy as np
    magic, frames, vertices, fps = HEADER.unpack_from(data)
    if magic != b"PLS2":
        raise ValueError("Not a PLS2 mesh")
    low = np.frombuffer(data, "<f4", 3, HEADER.size)
    step = np.frombuffer(data, "<f4", 3, HEADER.size + 12)
    planes = np.frombuffer(zlib.decompress(data[HEADER.size + 24:]), np.uint8)
    count = frames * vertices * 3
    residual = (planes[:count].astype(np.uint16) | (planes[count:].astype(np.uint16) << 8)).view(np.int16)
    residual = residual.reshape(frames, vertices, 3)
    second = np.cumsum(residual, axis=1, dtype=np.int16)  # undo the vertex prediction (wrapping)
    first = second.copy()
    for t in range(2, frames):
        first[t] = first[t - 1] + second[t]
    quantized = np.cumsum(first, axis=0, dtype=np.int16)
    return (low + (quantized.astype(np.float64) + 32768) * step).astype("<f4"), fps


def write(source):
    """Write the PLS2 copy beside a PLS1 section; returns its path."""
    source = Path(source)
    target = source.with_suffix(".pls2")
    temporary = target.with_suffix(".pls2tmp")
    temporary.write_bytes(encode(source))
    temporary.replace(target)
    return target
