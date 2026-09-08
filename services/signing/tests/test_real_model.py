"""Opt-in GPU checks against actual released weights, never a mocked inference result."""
import os
from pathlib import Path

import numpy as np
import pytest

from engine import SignEngine, TRANSITION_FRAMES


@pytest.mark.skipif(os.environ.get("POLARIS_SIGNING_REAL_TEST") != "1", reason="Opt-in real GPU model test")
def test_real_text_conditioning_determinism_and_chunk_boundary(tmp_path):
    engine = SignEngine()
    a, b, c, d = [tmp_path / f"{index}.bin" for index in range(4)]
    phrase = "The workshop starts on Tuesday."
    for output in (a, b):
        engine.generate(phrase, 4, "same-seed", output)
    engine.generate("Please bring your camera to the class.", 4, "same-seed", c)
    engine.generate("Please bring your camera to the class.", 4, "same-seed", d, previous_path=a.with_suffix(".poses.npz"))
    arrays = [np.fromfile(path, dtype="<f4", offset=16).reshape(100, 10475, 3) for path in (a, b, c, d)]
    assert all(np.isfinite(value).all() for value in arrays)
    np.testing.assert_allclose(arrays[0], arrays[1], atol=2e-5)
    assert np.abs(arrays[0] - arrays[2]).mean() > 1e-4, "Text conditioning must change actual generated motion"
    np.testing.assert_allclose(arrays[0][-1], arrays[3][0], atol=2e-5)
    # A boundary join must never suppress or change the following sign sequence.
    # The old first-frame conditioning passed the boundary check but collapsed it.
    np.testing.assert_allclose(arrays[2][TRANSITION_FRAMES:], arrays[3][TRANSITION_FRAMES:], atol=2e-5)
