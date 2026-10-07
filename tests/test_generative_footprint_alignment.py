import unittest

from tools.hd_iso.generative.compositor import align_candidate_to_canonical_footprint


class FootprintAlignmentTests(unittest.TestCase):
    def test_three_point_affine_alignment_locks_house_ground_axes(self):
        source = [[(0, 0, 0, 0) for _ in range(9)] for _ in range(9)]
        source[6][2] = (255, 0, 0, 255)   # left/front
        source[5][6] = (0, 255, 0, 255)   # right/front, wrong shallow slope
        source[2][5] = (0, 0, 255, 255)   # rear/left, wrong side slope

        target = {
            "left": {"x": 2, "y": 6},
            "right": {"x": 6, "y": 8},
            "rear": {"x": 6, "y": 4},
        }
        out = align_candidate_to_canonical_footprint(
            source,
            source_points={
                "left": {"x": 2, "y": 6},
                "right": {"x": 6, "y": 5},
                "rear": {"x": 5, "y": 2},
            },
            target_points=target,
            width=9,
            height=9,
        )

        self.assertEqual(out[6][2], (255, 0, 0, 255))
        self.assertEqual(out[8][6], (0, 255, 0, 255))
        self.assertEqual(out[4][6], (0, 0, 255, 255))

    def test_refuses_degenerate_source_control_points(self):
        source = [[(0, 0, 0, 0) for _ in range(4)] for _ in range(4)]
        with self.assertRaisesRegex(ValueError, "candidate_footprint_points_degenerate"):
            align_candidate_to_canonical_footprint(
                source,
                source_points={
                    "left": {"x": 0, "y": 0},
                    "right": {"x": 1, "y": 1},
                    "rear": {"x": 2, "y": 2},
                },
                target_points={
                    "left": {"x": 0, "y": 0},
                    "right": {"x": 2, "y": 1},
                    "rear": {"x": 2, "y": -1},
                },
                width=4,
                height=4,
            )


if __name__ == "__main__":
    unittest.main()
