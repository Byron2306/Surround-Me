from __future__ import annotations

import math
import random

from .model import GeometryManifest, HouseGeometry
from .primitives import gable_roof_rise
from .sockets import front_door, front_window, porch_socket


def _uniform(rng: random.Random, bounds: dict) -> float:
    return rng.uniform(float(bounds["min"]), float(bounds["max"]))


def compile_house_a(template: dict, structural_seed: int) -> GeometryManifest:
    if template.get("templateId") != "house.master.a":
        raise ValueError("unsupported template for House A compiler")

    rng = random.Random(int(structural_seed))
    width_m, depth_m = map(float, template["footprintM"])
    max_height_m = float(template["maxHeightM"])
    wall_min = float(template["wallHeightM"]["min"])
    wall_max = float(template["wallHeightM"]["max"])
    pitch_min = float(template["roof"]["pitchDegrees"]["min"])
    pitch_max = float(template["roof"]["pitchDegrees"]["max"])

    wall_height = rng.uniform(wall_min, wall_max)
    max_pitch_for_envelope = math.degrees(math.atan((max_height_m - wall_height) / (depth_m / 2.0)))
    effective_pitch_max = min(pitch_max, max_pitch_for_envelope)
    if effective_pitch_max < pitch_min:
        wall_height = wall_min
        max_pitch_for_envelope = math.degrees(math.atan((max_height_m - wall_height) / (depth_m / 2.0)))
        effective_pitch_max = min(pitch_max, max_pitch_for_envelope)
    pitch = rng.uniform(pitch_min, effective_pitch_max)
    roof_rise = gable_roof_rise(depth_m, pitch, template["roof"]["ridgeAxis"])

    door_position = _uniform(rng, template["door"]["lateralPosition"])
    door = front_door(float(template["door"]["widthM"]), float(template["door"]["heightM"]), door_position)

    wcfg = template["windows"]
    count = rng.randint(int(wcfg["frontCount"]["min"]), int(wcfg["frontCount"]["max"]))
    if count == 1:
        positions = [0.2 if door_position > 0.5 else 0.8]
    else:
        positions = [0.18 + i * (0.64 / (count - 1)) for i in range(count)]
    windows = tuple(
        front_window(
            i + 1,
            _uniform(rng, wcfg["widthM"]),
            _uniform(rng, wcfg["heightM"]),
            _uniform(rng, wcfg["sillHeightM"]),
            pos,
        )
        for i, pos in enumerate(positions)
    )

    eave = _uniform(rng, template["roof"]["eaveOverhangM"])
    porch_bounds = tuple(float(v) for v in template["attachments"]["porch"]["maxBoundsM"])

    house = HouseGeometry(
        template_id="house.master.a",
        width_m=width_m,
        depth_m=depth_m,
        max_height_m=max_height_m,
        anchor=tuple(float(v) for v in template["anchor"]),
        facade_orientation=template["facadeOrientation"],
        wall_height_m=wall_height,
        roof_pitch_degrees=pitch,
        ridge_axis=template["roof"]["ridgeAxis"],
        eave_overhang_m=eave,
        door=door,
        windows=windows,
        attachments=(porch_socket(porch_bounds),),
        roof_rise_m=roof_rise,
    )
    return GeometryManifest("hd-iso-geometry-v1", "house.master.a", int(structural_seed), house)
