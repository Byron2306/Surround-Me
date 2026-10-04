from __future__ import annotations

import hashlib
import json
import random


def _canonical_json(data: dict) -> str:
    return json.dumps(data, sort_keys=True, separators=(",", ":"), ensure_ascii=False)


def source_geometry_sha256(geometry: dict) -> str:
    return "sha256:" + hashlib.sha256(_canonical_json(geometry).encode("utf-8")).hexdigest()


def _porch_allowance(house: dict) -> list[float]:
    for attachment in house.get("attachments", []):
        if attachment.get("name") == "porch":
            return [float(v) for v in attachment["boundsM"]]
    raise ValueError("house.master.a detail compilation requires porch attachment allowance")


def compile_house_a_detail(geometry: dict, detail_seed: int) -> dict:
    if geometry.get("templateId") != "house.master.a":
        raise ValueError("unsupported template for House A detail compiler")

    house = geometry["house"]
    seed = int(detail_seed)
    rng = random.Random(seed)

    windows = [
        {
            "name": w["name"],
            "facade": w["facade"],
            "widthM": float(w["widthM"]),
            "heightM": float(w["heightM"]),
            "sillHeightM": float(w["sillHeightM"]),
            "lateralPosition": float(w["lateralPosition"]),
        }
        for w in house.get("windows", [])
    ]

    eave = float(house["eaveOverhangM"])
    width = float(house["widthM"])
    porch_max = _porch_allowance(house)

    # A1 keeps variation deliberately tiny. Geometry-owned values never vary
    # with detail_seed. The seed may only choose among explicitly legal detail
    # alternatives.
    side = "LEFT" if seed % 2 else "RIGHT"
    porch_styles = ("OPEN_FRAME", "TWO_POST")
    porch_style = porch_styles[(seed // 2) % len(porch_styles)]

    # Consume the RNG so future A1-compatible additions have a stable local
    # random stream without relying on global random state.
    _ = rng.random()

    porch_bounds = [
        min(2.0, porch_max[0]),
        min(1.0, porch_max[1]),
        min(1.1, porch_max[2]),
    ]

    return {
        "schemaVersion": "hd-iso-detail-v1",
        "templateId": "house.master.a",
        "structuralSeed": int(geometry["structuralSeed"]),
        "detailSeed": seed,
        "sourceGeometrySha256": source_geometry_sha256(geometry),
        "windows": windows,
        "eaves": {
            "ridgeAxis": house["ridgeAxis"],
            "overhangM": eave,
        },
        "fascia": {
            "thicknessM": 0.025,
            "depthM": 0.18,
        },
        "gutter": {
            "facade": "FRONT",
            "lengthM": width + (2.0 * eave),
            "radiusM": 0.055,
        },
        "downpipe": {
            "facade": "FRONT",
            "side": side,
            "diameterM": 0.075,
        },
        "porch": {
            "facade": "FRONT",
            "style": porch_style,
            "boundsM": porch_bounds,
        },
    }
