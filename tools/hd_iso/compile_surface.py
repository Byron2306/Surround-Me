from __future__ import annotations

import hashlib
import json

from .surface.house_a import compile_house_a_surface


def canonical_surface_json(surface: dict) -> str:
    return json.dumps(surface, sort_keys=True, separators=(",", ":"), ensure_ascii=False)


def surface_sha256(surface: dict) -> str:
    return "sha256:" + hashlib.sha256(canonical_surface_json(surface).encode("utf-8")).hexdigest()


__all__ = ["compile_house_a_surface", "canonical_surface_json", "surface_sha256"]
