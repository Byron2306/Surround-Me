from __future__ import annotations

import json
import pathlib
import sys

MANDATORY_IDS = {
    "projection_consistency",
    "aliza_door_car_scale",
    "closest_zoom_texture_readability",
    "transparent_edge_quality",
    "ground_contact",
    "depth_sorting",
    "collision_navigation",
    "road_continuity",
    "missing_asset_diagnostics",
    "fog_layering",
    "legacy_world_regression",
}

VALID_STATES = {"PASS", "REFUSE", "NEEDS_REVIEW"}


def verify_acceptance(path: pathlib.Path) -> list[str]:
    try:
        payload = json.loads(path.read_text(encoding="utf-8"))
    except FileNotFoundError:
        return [f"acceptance checklist not found: {path}"]
    except json.JSONDecodeError as exc:
        return [f"invalid acceptance JSON: {exc}"]

    checks = payload.get("checks")
    if not isinstance(checks, list):
        return ["checks must be a list"]

    seen: dict[str, dict] = {}
    errors: list[str] = []
    for check in checks:
        if not isinstance(check, dict):
            errors.append("each acceptance check must be an object")
            continue
        check_id = check.get("id")
        state = check.get("state")
        if check_id in seen:
            errors.append(f"duplicate acceptance check: {check_id}")
            continue
        if check_id:
            seen[check_id] = check
        if state not in VALID_STATES:
            errors.append(f"{check_id or '<unknown>'}: invalid state {state!r}")

    missing = MANDATORY_IDS - set(seen)
    if missing:
        errors.append(f"missing mandatory checks: {sorted(missing)}")

    for check_id in sorted(MANDATORY_IDS & set(seen)):
        state = seen[check_id].get("state")
        if state != "PASS":
            errors.append(f"{check_id}: {state}")

    return errors


def main(argv: list[str]) -> int:
    if len(argv) != 2:
        print("usage: verify_phase_a_acceptance.py <acceptance-checklist.json>", file=sys.stderr)
        return 2
    errors = verify_acceptance(pathlib.Path(argv[1]))
    if errors:
        for error in errors:
            print(f"REFUSE: {error}")
        return 1
    print("PASS: Phase A acceptance complete")
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv))
