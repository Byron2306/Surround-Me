from __future__ import annotations

import json
import pathlib
import sys
from typing import Any

REQUIRED_TOP_LEVEL = {"schema", "projection", "lighting", "scale", "runtime", "assets"}
REQUIRED_ASSET_FIELDS = {
    "id", "category", "source", "runtimeSource", "footprintTiles", "anchor",
    "nominalHeightM", "masterPixels", "runtimePixels", "transparent", "status",
}
REQUIRED_PHASE_A_CATEGORIES = {
    "road", "building", "vehicle", "street_furniture", "utility", "clutter",
    "vegetation", "atmosphere",
}


def _is_relative_repo_path(value: str) -> bool:
    p = pathlib.PurePosixPath(value)
    return bool(value) and not p.is_absolute() and ".." not in p.parts


def _valid_pair(value: Any) -> bool:
    return (
        isinstance(value, list)
        and len(value) == 2
        and all(isinstance(v, (int, float)) and not isinstance(v, bool) for v in value)
    )


def validate_manifest(path: pathlib.Path) -> list[str]:
    errors: list[str] = []
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except FileNotFoundError:
        return [f"manifest not found: {path}"]
    except json.JSONDecodeError as exc:
        return [f"invalid JSON: {exc}"]

    missing_top = REQUIRED_TOP_LEVEL - set(data)
    if missing_top:
        errors.append(f"missing top-level fields: {sorted(missing_top)}")
        return errors

    if data.get("schema") != "surround-me-world-art-v1":
        errors.append("schema must be surround-me-world-art-v1")
    if data.get("projection", {}).get("type") != "orthographic_isometric":
        errors.append("projection.type must be orthographic_isometric")

    assets = data.get("assets")
    if not isinstance(assets, list):
        return errors + ["assets must be a list"]

    seen: set[str] = set()
    categories: set[str] = set()
    for index, asset in enumerate(assets):
        prefix = f"assets[{index}]"
        if not isinstance(asset, dict):
            errors.append(f"{prefix} must be an object")
            continue
        missing = REQUIRED_ASSET_FIELDS - set(asset)
        if missing:
            errors.append(f"{prefix} missing fields: {sorted(missing)}")
            continue

        asset_id = asset["id"]
        if not isinstance(asset_id, str) or not asset_id:
            errors.append(f"{prefix}.id must be non-empty string")
        elif asset_id in seen:
            errors.append(f"duplicate asset id: {asset_id}")
        else:
            seen.add(asset_id)

        category = asset["category"]
        if isinstance(category, str):
            categories.add(category)
        else:
            errors.append(f"{prefix}.category must be string")

        for field in ("source", "runtimeSource"):
            value = asset[field]
            if not isinstance(value, str) or not _is_relative_repo_path(value):
                errors.append(f"{prefix}.{field} path must be repo-relative and cannot contain '..'")

        anchor = asset["anchor"]
        if not _valid_pair(anchor):
            errors.append(f"{prefix}.anchor must be [x,y]")
        else:
            x, y = anchor
            if not (0 <= x <= 1 and 0 <= y <= 1):
                errors.append(f"{prefix}.anchor must be normalized to [0,1]")
            if y != 1:
                errors.append(f"{prefix}.anchor must use bottom contact y=1")

        footprint = asset["footprintTiles"]
        if not _valid_pair(footprint) or any(v <= 0 for v in footprint):
            errors.append(f"{prefix}.footprintTiles must be two positive numbers")

        master = asset["masterPixels"]
        runtime = asset["runtimePixels"]
        if not _valid_pair(master) or any(v <= 0 for v in master):
            errors.append(f"{prefix}.masterPixels must be two positive numbers")
        if not _valid_pair(runtime) or any(v <= 0 for v in runtime):
            errors.append(f"{prefix}.runtimePixels must be two positive numbers")
        if _valid_pair(master) and _valid_pair(runtime):
            if master[0] < runtime[0] or master[1] < runtime[1]:
                errors.append(f"{prefix} master resolution cannot be smaller than runtime resolution")

        if not isinstance(asset["nominalHeightM"], (int, float)) or asset["nominalHeightM"] < 0:
            errors.append(f"{prefix}.nominalHeightM must be non-negative")
        if not isinstance(asset["transparent"], bool):
            errors.append(f"{prefix}.transparent must be boolean")
        if asset["status"] not in {"planned", "candidate", "approved", "refused"}:
            errors.append(f"{prefix}.status is invalid")

    missing_categories = REQUIRED_PHASE_A_CATEGORIES - categories
    if missing_categories:
        errors.append(f"missing Phase A categories: {sorted(missing_categories)}")
    return errors


def main(argv: list[str]) -> int:
    if len(argv) != 2:
        print("usage: validate_world_art_manifest.py <manifest.json>", file=sys.stderr)
        return 2
    errors = validate_manifest(pathlib.Path(argv[1]))
    if errors:
        for error in errors:
            print(f"REFUSE: {error}")
        return 1
    print("PASS: world-art manifest contract valid")
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv))
