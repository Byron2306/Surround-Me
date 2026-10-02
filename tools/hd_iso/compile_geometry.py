from __future__ import annotations

import hashlib
import json
from dataclasses import asdict
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


def manifest_dict(manifest: GeometryManifest) -> dict:
    return asdict(manifest)


def canonical_geometry_json(manifest: GeometryManifest) -> str:
    return json.dumps(manifest_dict(manifest), sort_keys=True, separators=(",", ":"), ensure_ascii=False)


def geometry_sha256(manifest: GeometryManifest) -> str:
    return "sha256:" + hashlib.sha256(canonical_geometry_json(manifest).encode("utf-8")).hexdigest()
