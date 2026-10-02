from __future__ import annotations

from dataclasses import dataclass
from typing import Literal

from .model import GeometryManifest, OpeningSocket


@dataclass(frozen=True)
class ValidationResult:
    status: Literal["PASS", "REFUSE"]
    reasons: tuple[str, ...]


def _span(opening: OpeningSocket, facade_width_m: float) -> tuple[float, float]:
    center = opening.lateral_position * facade_width_m
    half = opening.width_m / 2.0
    return center - half, center + half


def _overlap_with_gap(a: tuple[float, float], b: tuple[float, float], gap: float) -> bool:
    return not (a[1] + gap <= b[0] or b[1] + gap <= a[0])


def validate_house_a(manifest: GeometryManifest, template: dict) -> ValidationResult:
    reasons: list[str] = []
    if manifest.template_id != "house.master.a" or manifest.house.template_id != "house.master.a":
        reasons.append("unknown_template")
        return ValidationResult("REFUSE", tuple(reasons))

    h = manifest.house
    expected_w, expected_d = map(float, template["footprintM"])
    if h.width_m != expected_w:
        reasons.append("width_mismatch")
    if h.depth_m != expected_d:
        reasons.append("depth_mismatch")
    if h.anchor != tuple(float(v) for v in template["anchor"]):
        reasons.append("anchor_mismatch")
    if h.facade_orientation != template["facadeOrientation"]:
        reasons.append("facade_orientation_mismatch")
    if h.max_height_m != float(template["maxHeightM"]):
        reasons.append("max_height_contract_mismatch")
    if h.wall_height_m + h.roof_rise_m > float(template["maxHeightM"]):
        reasons.append("height_envelope_exceeded")

    pitch = template["roof"]["pitchDegrees"]
    if not float(pitch["min"]) <= h.roof_pitch_degrees <= float(pitch["max"]):
        reasons.append("roof_pitch_out_of_range")
    eave = template["roof"]["eaveOverhangM"]
    if not float(eave["min"]) <= h.eave_overhang_m <= float(eave["max"]):
        reasons.append("eave_out_of_range")
    wall = template["wallHeightM"]
    if not float(wall["min"]) <= h.wall_height_m <= float(wall["max"]):
        reasons.append("wall_height_out_of_range")

    door_cfg = template["door"]
    if h.door.height_m != float(door_cfg["heightM"]):
        reasons.append("door_height_mismatch")
    if h.door.width_m != float(door_cfg["widthM"]):
        reasons.append("door_width_mismatch")

    wcfg = template["windows"]
    corner = float(wcfg["minimumCornerClearanceM"])
    gap = float(wcfg["minimumOpeningGapM"])
    openings = (h.door,) + h.windows
    spans = []
    for opening in openings:
        left, right = _span(opening, h.width_m)
        if left < corner or right > h.width_m - corner:
            reasons.append("opening_corner_clearance")
        spans.append((opening.name, (left, right)))
    for i, (_, a) in enumerate(spans):
        for _, b in spans[i + 1 :]:
            if _overlap_with_gap(a, b, gap):
                reasons.append("opening_collision")
                break
        if "opening_collision" in reasons:
            break

    porch_cfg = template["attachments"]["porch"]["maxBoundsM"]
    allowed = tuple(float(v) for v in porch_cfg)
    for attachment in h.attachments:
        if attachment.name == "porch":
            if any(actual > limit for actual, limit in zip(attachment.bounds_m, allowed)):
                reasons.append("porch_outside_allowance")
        else:
            reasons.append("unknown_attachment")

    unique = tuple(dict.fromkeys(reasons))
    return ValidationResult("PASS" if not unique else "REFUSE", unique)
