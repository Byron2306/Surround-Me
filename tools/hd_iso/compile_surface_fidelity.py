from __future__ import annotations

import hashlib
import json

from .surface_fidelity.house_a import compile_house_a_surface_fidelity


def canonical_surface_fidelity_json(fidelity: dict) -> str:
    return json.dumps(fidelity, sort_keys=True, separators=(",", ":"), ensure_ascii=False)


def surface_fidelity_sha256(fidelity: dict) -> str:
    return "sha256:" + hashlib.sha256(
        canonical_surface_fidelity_json(fidelity).encode("utf-8")
    ).hexdigest()


__all__ = [
    "compile_house_a_surface_fidelity",
    "canonical_surface_fidelity_json",
    "surface_fidelity_sha256",
]
