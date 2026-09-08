import numpy as np
from engine import axis_angle, rotation_matrices


def test_rotation_convention_and_left_hand_match_smplx_adapter():
    identity = np.array([[1, 0, 0, 0, 1, 0]], dtype="float32")
    np.testing.assert_allclose(axis_angle(identity), 0, atol=1e-6)
    np.testing.assert_allclose(rotation_matrices(np.zeros_like(identity)), np.eye(3)[None], atol=1e-6)
    around_z = np.array([[0, -1, 0, 1, 0, 0]], dtype="float32")
    np.testing.assert_allclose(axis_angle(around_z)[0], [0, 0, np.pi / 2], atol=1e-6)
    np.testing.assert_allclose(axis_angle(around_z, left=True)[0], [0, 0, -np.pi / 2], atol=1e-6)
