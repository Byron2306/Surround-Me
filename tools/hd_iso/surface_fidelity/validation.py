from __future__ import annotations

from dataclasses import dataclass
from typing import Literal

from .house_a import (
    source_detail_sha256,
    source_geometry_sha256,
    source_surface_sha256,
)


@dataclass(frozen=True)
class SurfaceFidelityValidationResult:
    status: Literal["PASS", "REFUSE"]
    reasons: tuple[str, ...]


_EXPECTED_CHANNELS = {
    "walls": {
        "microScale",
        "microStrength",
        "verticalStreakBias",
        "lowerWallDirtBias",
        "crackFrequency",
        "crackContrast",
    },
    "roof": {
        "macroVariationScale",
        "stainClusterScale",
        "runoffBias",
        "edgeWearBias",
        "mossPatchScale",
    },
    "metal": {
        "rustClusterScale",
        "rustEdgeBias",
        "runoffBias",
        "roughnessVariation",
    },
    "glass": {
        "hazeScale",
        "hazeStrength",
        "streakScale",
        "streakStrength",
        "scratchScale",
    },
    "trim": {
        "grainScale",
        "wearEdgeBias",
        "roughnessVariation",
    },
}

_UNIT_KEYS = {
    "microStrength",
    "verticalStreakBias",
    "lowerWallDirtBias",
    "crackFrequency",
    "crackContrast",
    "runoffBias",
    "edgeWearBias",
    "rustEdgeBias",
    "roughnessVariation",
    "hazeStrength",
    "streakStrength",
    "wearEdgeBias",
}

_SCALE_BOUNDS = {
    ("walls", "microScale"): (8.0, 28.0),
    ("roof", "macroVariationScale"): (1.5, 6.0),
    ("roof", "stainClusterScale"): (2.5, 11.0),
    ("roof", "mossPatchScale"): (3.0, 14.0),
    ("metal", "rustClusterScale"): (4.0, 18.0),
    ("glass", "hazeScale"): (5.0, 22.0),
    ("glass", "streakScale"): (10.0, 38.0),
    ("glass", "scratchScale"): (18.0, 64.0),
    ("trim", "grainScale"): (12.0, 48.0),
}

_FORBIDDEN_AUTHORITY = {
    "widthM",
    "depthM",
    "anchor",
    "wallHeightM",
    "roofPitchDegrees",
    "roofRiseM",
    "ridgeAxis",
    "cameraMatrix",
    "projectionAdapter",
    "footprintPixel",
    "displacement",
    "displaceModifier",
    "geometryNodes",
    "vertexOffset",
    "modifier",
    "modifiers",
}


def _number(value) -> float | None:
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def _unit(value) -> bool:
    number = _number(value)
    return number is not None and 0.0 <= number <= 1.0


def _scale_in_range(family: str, key: str, value) -> bool:
    number = _number(value)
    if number is None:
        return False
    low, high = _SCALE_BOUNDS[(family, key)]
    return low <= number <= high


def validate_house_a_surface_fidelity(
    geometry: dict,
    detail: dict,
    surface: dict,
    fidelity: dict,
) -> SurfaceFidelityValidationResult:
    reasons: list[str] = []
    if fidelity.get("variantId") != geometry.get("variantId"):
        reasons.append("variant_identity_mismatch")

    if fidelity.get("schemaVersion") != "hd-iso-surface-fidelity-v1":
        reasons.append("fidelity_schema_mismatch")
    if fidelity.get("templateId") != "house.master.a":
        reasons.append("fidelity_template_mismatch")
    if geometry.get("templateId") != "house.master.a":
        reasons.append("source_geometry_template_mismatch")
    if detail.get("templateId") != "house.master.a":
        reasons.append("source_detail_template_mismatch")
    if surface.get("templateId") != "house.master.a":
        reasons.append("source_surface_template_mismatch")

    if fidelity.get("structuralSeed") != geometry.get("structuralSeed"):
        reasons.append("structural_seed_mismatch")
    if fidelity.get("detailSeed") != detail.get("detailSeed"):
        reasons.append("detail_seed_mismatch")
    if fidelity.get("appearanceSeed") != surface.get("appearanceSeed"):
        reasons.append("appearance_seed_mismatch")
    if fidelity.get("decaySeed") != surface.get("decaySeed"):
        reasons.append("decay_seed_mismatch")

    if fidelity.get("sourceGeometrySha256") != source_geometry_sha256(geometry):
        reasons.append("source_geometry_hash_mismatch")
    if fidelity.get("sourceDetailSha256") != source_detail_sha256(detail):
        reasons.append("source_detail_hash_mismatch")
    if fidelity.get("sourceSurfaceSha256") != source_surface_sha256(surface):
        reasons.append("source_surface_hash_mismatch")

    if not isinstance(fidelity.get("fidelitySeed"), int):
        reasons.append("fidelity_seed_invalid")

    if any(field in fidelity for field in _FORBIDDEN_AUTHORITY):
        reasons.append("forbidden_fidelity_authority")

    channels = fidelity.get("channels", {})
    if set(channels) != set(_EXPECTED_CHANNELS):
        reasons.append("fidelity_block_set_mismatch")
    else:
        for family, expected in _EXPECTED_CHANNELS.items():
            block = channels.get(family, {})
            if set(block) != expected:
                reasons.append("fidelity_channel_set_mismatch")
                continue

            for key, value in block.items():
                if key in _UNIT_KEYS:
                    if not _unit(value):
                        reasons.append("fidelity_unit_value_out_of_range")
                else:
                    if not _scale_in_range(family, key, value):
                        reasons.append("fidelity_scale_out_of_range")

    unique = tuple(dict.fromkeys(reasons))
    return SurfaceFidelityValidationResult(
        "PASS" if not unique else "REFUSE",
        unique,
    )
