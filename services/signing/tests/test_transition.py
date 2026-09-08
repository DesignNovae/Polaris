import numpy as np
import pytest
from scipy.spatial.transform import Rotation

from engine import CHANNELS, TRANSITION_FRAMES, join_motion_boundary, rotation_matrices


def stream_values(frames, offset):
    streams = {}
    for name, channels in CHANNELS.items():
        batches = 2 if name == "hand" else 1
        rotations = 1 if name == "face" else channels // 6
        angles = np.linspace(offset, offset + .8, batches * frames * rotations)
        matrices = Rotation.from_rotvec(np.column_stack([angles, angles * .2, angles * .1])).as_matrix()
        data = matrices[:, :2].reshape(batches, frames, rotations * 6).astype("float32")
        if name == "face":
            data = np.concatenate([data, np.full((batches, frames, 50), offset, dtype="float32")], axis=-1)
        streams[name] = data
    return streams


def test_boundary_preserves_model_motion_and_valid_joint_rotations():
    prior, current = stream_values(20, -.7), stream_values(200, .3)
    originals = {name: value.copy() for name, value in current.items()}
    result = join_motion_boundary(current, prior)
    for name, values in result.items():
        np.testing.assert_array_equal(values[:, 0], prior[name][:, -1])
        np.testing.assert_array_equal(values[:, TRANSITION_FRAMES - 1:], originals[name][:, TRANSITION_FRAMES - 1:])
        rotational = values[..., :6] if name == "face" else values
        matrices = rotation_matrices(rotational)
        np.testing.assert_allclose(matrices @ matrices.transpose(0, 2, 1), np.broadcast_to(np.eye(3), matrices.shape), atol=1e-5)
        assert np.isfinite(values).all()


def test_unavailable_previous_pose_and_single_frame_do_not_hold_new_motion():
    current = stream_values(1, .3)
    originals = {name: value.copy() for name, value in current.items()}
    for previous in ({}, stream_values(20, -.7)):
        for name, values in join_motion_boundary(current, previous).items():
            np.testing.assert_array_equal(values, originals[name])


def test_corrupt_boundary_is_rejected():
    prior = stream_values(20, -.7)
    prior["hand"][0, -1, 0] = np.nan
    with pytest.raises(ValueError, match="preceding signing pose"):
        join_motion_boundary(stream_values(200, .3), prior)
