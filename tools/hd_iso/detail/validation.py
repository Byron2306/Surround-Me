from __future__ import annotations

from dataclasses import dataclass
from typing import Literal

from .house_a import source_geometry_sha256


@dataclass(frozen=True)
class DetailValidationResult:
    status: Literal["PASS", "REFUSE"]
    reasons: tuple[str, ...]


def _expected_windows(geometry: dict) -> list[dict]:
    return [
        {
            "name": w["name"],
            "facade": w["facade"],
            "widthM": float(w["widthM"]),
            "heightM": float(w["heightM"]),
            "sillHeightM": float(w["sillHeightM"]),
            "lateralPosition": float(w["lateralPosition"]),
        }
        for w in geometry["house"].get("windows", [])
    ]


def _porch_allowance(geometry: dict) -> tuple[float, float, float]:
    for attachment in geometry["house"].get("attachments", []):
        if attachment.get("name") == "porch":
            return tuple(float(v) for v in attachment["boundsM"])
    raise ValueError("house.master.a geometry is missing porch allowance")


def validate_house_a_detail(geometry: dict, detail: dict) -> DetailValidationResult:
    reasons: list[str] = []

    if detail.get("schemaVersion") != "hd-iso-detail-v1":
        reasons.append("detail_schema_mismatch")
    if detail.get("templateId") != "house.master.a":
        reasons.append("detail_template_mismatch")
    if geometry.get("templateId") != "house.master.a":
        reasons.append("source_template_mismatch")

    if detail.get("structuralSeed") != geometry.get("structuralSeed"):
        reasons.append("structural_seed_mismatch")

    expected_source_sha = source_geometry_sha256(geometry)
    if detail.get("sourceGeometrySha256") != expected_source_sha:
        reasons.append("source_geometry_hash_mismatch")

    house = geometry.get("house", {})
    if detail.get("windows") != _expected_windows(geometry):
        reasons.append("window_socket_mismatch")

    eaves = detail.get("eaves", {})
    if eaves.get("ridgeAxis") != house.get("ridgeAxis"):
        reasons.append("eave_ridge_axis_mismatch")
    try:
        if abs(float(eaves.get("overhangM")) - float(house.get("eaveOverhangM"))) > 1e-9:
            reasons.append("eave_mismatch")
    except (TypeError, ValueError):
        reasons.append("eave_mismatch")

    fascia = detail.get("fascia", {})
    try:
        if float(fascia.get("thicknessM")) <= 0.0 or float(fascia.get("depthM")) <= 0.0:
            reasons.append("fascia_invalid")
    except (TypeError, ValueError):
        reasons.append("fascia_invalid")

    gutter = detail.get("gutter", {})
    if gutter.get("facade") != "FRONT":
        reasons.append("gutter_facade_mismatch")
    expected_gutter_length = float(house.get("widthM")) + (2.0 * float(house.get("eaveOverhangM")))
    try:
        if abs(float(gutter.get("lengthM")) - expected_gutter_length) > 1e-9:
            reasons.append("gutter_length_mismatch")
        if not 0.0 < float(gutter.get("radiusM")) <= 0.15:
            reasons.append("gutter_radius_out_of_range")
    except (TypeError, ValueError):
        reasons.append("gutter_invalid")

    downpipe = detail.get("downpipe", {})
    if downpipe.get("facade") != "FRONT":
        reasons.append("downpipe_facade_mismatch")
    if downpipe.get("side") not in {"LEFT", "RIGHT"}:
        reasons.append("downpipe_side_invalid")
    try:
        if not 0.0 < float(downpipe.get("diameterM")) <= 0.15:
            reasons.append("downpipe_diameter_out_of_range")
    except (TypeError, ValueError):
        reasons.append("downpipe_diameter_out_of_range")

    if detail.get("variantId") != geometry.get("variantId"):
        reasons.append("variant_identity_mismatch")
    if not house.get("attachments"):
        if detail.get("porch") is not None:
            reasons.append("unexpected_porch")
    else:
        porch = detail.get("porch", {})
        if porch.get("facade") != "FRONT":
            reasons.append("porch_facade_mismatch")
        if porch.get("style") not in {"OPEN_FRAME", "TWO_POST"}:
            reasons.append("porch_style_invalid")
        try:
            actual = tuple(float(v) for v in porch.get("boundsM", []))
            allowed = _porch_allowance(geometry)
            if len(actual) != 3 or any(v <= 0.0 for v in actual):
                reasons.append("porch_bounds_invalid")
            elif any(v > limit + 1e-9 for v, limit in zip(actual, allowed)):
                reasons.append("porch_outside_allowance")
        except (TypeError, ValueError):
            reasons.append("porch_bounds_invalid")


    unique = tuple(dict.fromkeys(reasons))
    return DetailValidationResult("PASS" if not unique else "REFUSE", unique)
