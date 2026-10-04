from __future__ import annotations

import hashlib
import json

from .detail.house_a import compile_house_a_detail


def canonical_detail_json(detail: dict) -> str:
    return json.dumps(detail, sort_keys=True, separators=(",", ":"), ensure_ascii=False)


def detail_sha256(detail: dict) -> str:
    return "sha256:" + hashlib.sha256(canonical_detail_json(detail).encode("utf-8")).hexdigest()


__all__ = ["compile_house_a_detail", "canonical_detail_json", "detail_sha256"]
