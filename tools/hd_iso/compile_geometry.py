from __future__ import annotations

import hashlib
import json
from pathlib import Path

from .geometry.house_a import compile_house_a
from .geometry.model import GeometryManifest


def _repo_root() -> Path:
    return Path(__file__).resolve().parents[2]


def compile_template(template_id: str, structural_seed: int = 0, root: Path | None = None) -> GeometryManifest:
    root = Path(root) if root is not None else _repo_root()
    if template_id != "house.master.a":
        raise ValueError(f"unknown template id: {template_id}")
    path = root / "world-art/hd-iso-v1/templates/house-master-a.json"
    template = json.loads(path.read_text())
    return compile_house_a(template, structural_seed)


def _opening_dict(opening) -> dict:
    return {
        "name": opening.name,
        "facade": opening.facade,
        "widthM": opening.width_m,
        "heightM": opening.height_m,
        "sillHeightM": opening.sill_height_m,
        "lateralPosition": opening.lateral_position,
    }


def manifest_dict(manifest: GeometryManifest) -> dict:
    h = manifest.house
    return {
        **({"variantId": manifest.variant_id} if manifest.variant_id is not None else {}),
        "schemaVersion": manifest.schema_version,
        "templateId": manifest.template_id,
        "structuralSeed": manifest.structural_seed,
        "house": {
            "templateId": h.template_id,
            "widthM": h.width_m,
            "depthM": h.depth_m,
            "maxHeightM": h.max_height_m,
            "anchor": list(h.anchor),
            "facadeOrientation": h.facade_orientation,
            "wallHeightM": h.wall_height_m,
            "roofPitchDegrees": h.roof_pitch_degrees,
            "roofRiseM": h.roof_rise_m,
            "ridgeAxis": h.ridge_axis,
            "eaveOverhangM": h.eave_overhang_m,
            "door": _opening_dict(h.door),
            "windows": [_opening_dict(w) for w in h.windows],
            "attachments": [
                {"name": a.name, "facade": a.facade, "boundsM": list(a.bounds_m)} for a in h.attachments
            ],
        },
    }


def canonical_geometry_json(manifest: GeometryManifest) -> str:
    return json.dumps(manifest_dict(manifest), sort_keys=True, separators=(",", ":"), ensure_ascii=False)


def geometry_sha256(manifest: GeometryManifest) -> str:
    return "sha256:" + hashlib.sha256(canonical_geometry_json(manifest).encode("utf-8")).hexdigest()
