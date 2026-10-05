from __future__ import annotations

import hashlib
import json
import random


WALL_FAMILIES = ("PLASTER", "PAINTED_MASONRY", "BRICK")
ROOF_FAMILIES = ("WEATHERED_METAL", "ASPHALT_SHINGLE", "CLAY_TILE")
GLASS_STATES = ("DIRTY_INTACT", "CRACKED", "BOARDED")
TRIM_FAMILIES = ("PAINTED_WOOD", "AGED_TIMBER", "PAINTED_METAL")
METAL_FAMILIES = ("GALVANIZED_STEEL", "PAINTED_STEEL", "AGED_ZINC")

WALL_PALETTE = (
    [0.34, 0.32, 0.28, 1.0],
    [0.42, 0.39, 0.33, 1.0],
    [0.30, 0.31, 0.29, 1.0],
    [0.46, 0.43, 0.37, 1.0],
)
ROOF_PALETTE = (
    [0.17, 0.18, 0.18, 1.0],
    [0.24, 0.20, 0.18, 1.0],
    [0.20, 0.22, 0.23, 1.0],
)
TRIM_PALETTE = (
    [0.48, 0.47, 0.43, 1.0],
    [0.31, 0.29, 0.26, 1.0],
    [0.55, 0.53, 0.48, 1.0],
)


def _canonical_json(data: dict) -> str:
    return json.dumps(data, sort_keys=True, separators=(",", ":"), ensure_ascii=False)


def source_geometry_sha256(geometry: dict) -> str:
    return "sha256:" + hashlib.sha256(_canonical_json(geometry).encode("utf-8")).hexdigest()


def source_detail_sha256(detail: dict) -> str:
    return "sha256:" + hashlib.sha256(_canonical_json(detail).encode("utf-8")).hexdigest()


def _bounded(rng: random.Random, low: float, high: float) -> float:
    return round(rng.uniform(low, high), 6)


def compile_house_a_surface(
    geometry: dict,
    detail: dict,
    appearance_seed: int,
    decay_seed: int,
) -> dict:
    if geometry.get("templateId") != "house.master.a":
        raise ValueError("unsupported geometry template for House A surface compiler")
    if detail.get("templateId") != "house.master.a":
        raise ValueError("unsupported detail template for House A surface compiler")

    appearance_seed = int(appearance_seed)
    decay_seed = int(decay_seed)
    appearance_rng = random.Random(appearance_seed)
    decay_rng = random.Random(decay_seed)

    wall_family = appearance_rng.choice(WALL_FAMILIES)
    roof_family = appearance_rng.choice(ROOF_FAMILIES)
    trim_family = appearance_rng.choice(TRIM_FAMILIES)
    metal_family = appearance_rng.choice(METAL_FAMILIES)

    wall_color = list(appearance_rng.choice(WALL_PALETTE))
    roof_color = list(appearance_rng.choice(ROOF_PALETTE))
    trim_color = list(appearance_rng.choice(TRIM_PALETTE))

    # Glass state belongs to the appearance family in S1. Damage intensity is
    # kept separately in the decay channels, so seed responsibilities remain
    # auditable and do not bleed into one another.
    glass_state = appearance_rng.choice(GLASS_STATES)

    decay = {
        "paintWear": _bounded(decay_rng, 0.15, 0.85),
        "crackedPlaster": _bounded(decay_rng, 0.05, 0.75),
        "dampStreaks": _bounded(decay_rng, 0.10, 0.90),
        "grime": _bounded(decay_rng, 0.20, 0.95),
        "mossMildew": _bounded(decay_rng, 0.00, 0.65),
        "rust": _bounded(decay_rng, 0.05, 0.80),
        "foundationDirt": _bounded(decay_rng, 0.20, 0.95),
        "gutterStaining": _bounded(decay_rng, 0.10, 0.90),
        "roofStaining": _bounded(decay_rng, 0.15, 0.90),
        "glassDirt": _bounded(decay_rng, 0.20, 0.95),
    }

    return {
        "schemaVersion": "hd-iso-surface-v1",
        "templateId": "house.master.a",
        "structuralSeed": int(geometry["structuralSeed"]),
        "detailSeed": int(detail["detailSeed"]),
        "appearanceSeed": appearance_seed,
        "decaySeed": decay_seed,
        "sourceGeometrySha256": source_geometry_sha256(geometry),
        "sourceDetailSha256": source_detail_sha256(detail),
        "materials": {
            "walls": {
                "family": wall_family,
                "baseColorRgba": wall_color,
                "roughness": 0.82,
            },
            "roof": {
                "family": roof_family,
                "baseColorRgba": roof_color,
                "roughness": 0.78,
            },
            "trim": {
                "family": trim_family,
                "baseColorRgba": trim_color,
                "roughness": 0.72,
            },
            "metal": {
                "family": metal_family,
                "baseColorRgba": [0.28, 0.29, 0.29, 1.0],
                "roughness": 0.66,
            },
            "glass": {
                "state": glass_state,
                "baseColorRgba": [0.12, 0.16, 0.17, 1.0],
                "roughness": 0.22,
            },
        },
        "decay": decay,
    }
