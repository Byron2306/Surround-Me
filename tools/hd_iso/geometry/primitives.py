from __future__ import annotations

import math


def gable_roof_rise(depth_m: float, pitch_degrees: float, ridge_axis: str) -> float:
    if ridge_axis != "X":
        raise ValueError("House Master A v1 requires ridge_axis='X'")
    return math.tan(math.radians(float(pitch_degrees))) * (float(depth_m) / 2.0)
