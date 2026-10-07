from __future__ import annotations

from dataclasses import dataclass
from typing import Literal

from .house_a import (
    GLASS_STATES,
    METAL_FAMILIES,
    ROOF_FAMILIES,
    TRIM_FAMILIES,
    WALL_FAMILIES,
    source_detail_sha256,
    source_geometry_sha256,
)


@dataclass(frozen=True)
class SurfaceValidationResult:
    status: Literal["PASS", "REFUSE"]
    reasons: tuple[str, ...]


_FORBIDDEN_STRUCTURAL_FIELDS = {
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
}


def _unit(value) -> bool:
    try:
        v = float(value)
    except (TypeError, ValueError):
        return False
    return 0.0 <= v <= 1.0


def _rgba(value) -> bool:
    return (
        isinstance(value, list)
        and len(value) == 4
        and all(_unit(channel) for channel in value)
    )


def validate_house_a_surface(
    geometry: dict,
    detail: dict,
    surface: dict,
) -> SurfaceValidationResult:
    reasons: list[str] = []
    if surface.get("variantId") != geometry.get("variantId"):
        reasons.append("variant_identity_mismatch")

    if surface.get("schemaVersion") != "hd-iso-surface-v1":
        reasons.append("surface_schema_mismatch")
    if surface.get("templateId") != "house.master.a":
        reasons.append("surface_template_mismatch")
    if geometry.get("templateId") != "house.master.a":
        reasons.append("source_geometry_template_mismatch")
    if detail.get("templateId") != "house.master.a":
        reasons.append("source_detail_template_mismatch")

    if surface.get("structuralSeed") != geometry.get("structuralSeed"):
        reasons.append("structural_seed_mismatch")
    if surface.get("detailSeed") != detail.get("detailSeed"):
        reasons.append("detail_seed_mismatch")

    if surface.get("sourceGeometrySha256") != source_geometry_sha256(geometry):
        reasons.append("source_geometry_hash_mismatch")
    if surface.get("sourceDetailSha256") != source_detail_sha256(detail):
        reasons.append("source_detail_hash_mismatch")

    if any(field in surface for field in _FORBIDDEN_STRUCTURAL_FIELDS):
        reasons.append("forbidden_structural_field")

    materials = surface.get("materials", {})
    walls = materials.get("walls", {})
    roof = materials.get("roof", {})
    trim = materials.get("trim", {})
    metal = materials.get("metal", {})
    glass = materials.get("glass", {})

    if walls.get("family") not in WALL_FAMILIES:
        reasons.append("wall_material_family_invalid")
    if roof.get("family") not in ROOF_FAMILIES:
        reasons.append("roof_material_family_invalid")
    if trim.get("family") not in TRIM_FAMILIES:
        reasons.append("trim_material_family_invalid")
    if metal.get("family") not in METAL_FAMILIES:
        reasons.append("metal_material_family_invalid")
    if glass.get("state") not in GLASS_STATES:
        reasons.append("glass_state_invalid")

    material_blocks = (walls, roof, trim, metal, glass)
    for block in material_blocks:
        if not _rgba(block.get("baseColorRgba")):
            reasons.append("material_color_out_of_range")
            break

    for block in material_blocks:
        if not _unit(block.get("roughness")):
            reasons.append("material_roughness_out_of_range")
            break

    decay = surface.get("decay", {})
    required_decay = {
        "paintWear",
        "crackedPlaster",
        "dampStreaks",
        "grime",
        "mossMildew",
        "rust",
        "foundationDirt",
        "gutterStaining",
        "roofStaining",
        "glassDirt",
    }
    if set(decay) != required_decay:
        reasons.append("decay_channel_set_mismatch")
    elif any(not _unit(value) for value in decay.values()):
        reasons.append("decay_channel_out_of_range")

    for seed_name in ("appearanceSeed", "decaySeed"):
        value = surface.get(seed_name)
        if not isinstance(value, int):
            reasons.append(f"{seed_name}_invalid")

    unique = tuple(dict.fromkeys(reasons))
    return SurfaceValidationResult("PASS" if not unique else "REFUSE", unique)
