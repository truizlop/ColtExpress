import unittest

import numpy as np
from train_v2 import trajectory_targets


class Targets(unittest.TestCase):
    def test_undiscounted_monte_carlo(self):
        for estimator in ["gae", "qtrace"]:
            adv, target = trajectory_targets(
                [0.2, 0.3, 0.4], [0.2, 0.3, 0.4], [0.2, 0.3, 0.4], 1, 1, estimator
            )
            np.testing.assert_allclose(target, [1, 1, 1], atol=1e-6)
            np.testing.assert_allclose(adv, [0.8, 0.7, 0.6], atol=1e-6)

    def test_single_terminal_decision(self):
        adv, target = trajectory_targets([0.3], [0.2], [0.1], 0, 0.98, "qtrace")
        np.testing.assert_allclose(target, [0], atol=1e-6)
        np.testing.assert_allclose(adv, [-0.1], atol=1e-6)

    def test_exact_constant_critic_has_zero_residual(self):
        adv, target = trajectory_targets(
            [0.7] * 3, [0.7] * 3, [0.7] * 3, 0.7, 0.98, "qtrace"
        )
        np.testing.assert_allclose(adv, [0] * 3, atol=1e-6)
        np.testing.assert_allclose(target, [0.7] * 3, atol=1e-6)


if __name__ == "__main__":
    unittest.main()
