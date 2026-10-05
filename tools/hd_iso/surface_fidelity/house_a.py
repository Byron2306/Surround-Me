from __future__ import annotations

import hashlib
import json
import random


def _canonical_json(data: dict) -> str:
    return json.dumps(data, sort_keys=True, separators=(",", ":"), ensure_ascii=False)


def source_geometry_sha256(geometry: dict) -> str:
    return "sha256:" + hashlib.sha256(_canonical_json(geometry).encode("utf-8")).hexdigest()


def source_detail_sha256(detail: dict) -> str:
    return "sha256:" + hashlib.sha256(_canonical_json(detail).encode("utf-8")).hexdigest()


def source_surface_sha256(surface: dict) -> str:
    return "sha256:" + hashlib.sha256(_canonical_json(surface).encode("utf-8")).hexdigest()


def _unit(rng: random.Random, low: float, high: float) -> float:
    return round(rng.uniform(low, high), 6)


def _scale(rng: random.Random, low: float, high: float) -> float:
    return round(rng.uniform(low, high), 6)


def compile_house_a_surface_fidelity(
    geometry: dict,
    detail: dict,
    surface: dict,
    fidelity_seed: int,
) -> dict:
    if geometry.get("templateId") != "house.master.a":
        raise ValueError("unsupported geometry template for House A surface fidelity")
    if detail.get("templateId") != "house.master.a":
        raise ValueError("unsupported detail template for House A surface fidelity")
    if surface.get("templateId") != "house.master.a":
        raise ValueError("unsupported surface template for House A surface fidelity")

    fidelity_seed = int(fidelity_seed)
    rng = random.Random(fidelity_seed)

    channels = {
        "walls": {
            "microScale": _scale(rng, 8.0, 28.0),
            "microStrength": _unit(rng, 0.08, 0.42),
            "verticalStreakBias": _unit(rng, 0.35, 0.92),
            "lowerWallDirtBias": _unit(rng, 0.45, 0.96),
            "crackFrequency": _unit(rng, 0.10, 0.65),
            "crackContrast": _unit(rng, 0.18, 0.78),
        },
        "roof": {
            "macroVariationScale": _scale(rng, 1.5, 6.0),
            "stainClusterScale": _scale(rng, 2.5, 11.0),
            "runoffBias": _unit(rng, 0.30, 0.90),
            "edgeWearBias": _unit(rng, 0.15, 0.75),
            "mossPatchScale": _scale(rng, 3.0, 14.0),
        },
        "metal": {
            "rustClusterScale": _scale(rng, 4.0, 18.0),
            "rustEdgeBias": _unit(rng, 0.25, 0.90),
            "runoffBias": _unit(rng, 0.25, 0.88),
            "roughnessVariation": _unit(rng, 0.05, 0.35),
        },
        "glass": {
            "hazeScale": _scale(rng, 5.0, 22.0),
            "hazeStrength": _unit(rng, 0.15, 0.72),
            "streakScale": _scale(rng, 10.0, 38.0),
            "streakStrength": _unit(rng, 0.15, 0.80),
            "scratchScale": _scale(rng, 18.0, 64.0),
        },
        "trim": {
            "grainScale": _scale(rng, 12.0, 48.0),
            "wearEdgeBias": _unit(rng, 0.18, 0.82),
            "roughnessVariation": _unit(rng, 0.05, 0.32),
        },
    }

    return {
        "schemaVersion": "hd-iso-surface-fidelity-v1",
        "templateId": "house.master.a",
        "structuralSeed": int(geometry["structuralSeed"]),
        "detailSeed": int(detail["detailSeed"]),
        "appearanceSeed": int(surface["appearanceSeed"]),
        "decaySeed": int(surface["decaySeed"]),
        "fidelitySeed": fidelity_seed,
        "sourceGeometrySha256": source_geometry_sha256(geometry),
        "sourceDetailSha256": source_detail_sha256(detail),
        "sourceSurfaceSha256": source_surface_sha256(surface),
        "channels": channels,
    }
