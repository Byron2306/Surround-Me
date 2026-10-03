from __future__ import annotations

import math

from tools.hd_iso.geometry.projection import project_ground

CANONICAL_RENDER_WIDTH = 512
CANONICAL_RENDER_HEIGHT = 512
_TOL = 1e-5


def canonical_camera_matrix() -> list[list[float]]:
    e = math.radians(30.0)
    s2 = math.sqrt(2.0)
    right = (1.0 / s2, -1.0 / s2, 0.0)
    up = (-math.sin(e) / s2, -math.sin(e) / s2, math.cos(e))
    back = (math.cos(e) / s2, math.cos(e) / s2, math.sin(e))
    loc = tuple(20.0 * v for v in back)
    return [
        [right[0], up[0], back[0], loc[0]],
        [right[1], up[1], back[1], loc[1]],
        [right[2], up[2], back[2], loc[2]],
        [0.0, 0.0, 0.0, 1.0],
    ]


def _close(a: float, b: float) -> bool:
    return abs(float(a) - float(b)) <= _TOL


def _pair_close(a, b) -> bool:
    return len(a) == 2 and len(b) == 2 and _close(a[0], b[0]) and _close(a[1], b[1])


def _matrix_close(actual, expected) -> bool:
    if len(actual) != len(expected):
        return False
    for ar, er in zip(actual, expected):
        if len(ar) != len(er):
            return False
        for av, ev in zip(ar, er):
            if not _close(av, ev):
                return False
    return True


def build_projection_proof(manifest: dict, scene_manifest: dict) -> dict:
    reasons: list[str] = []
    checks: dict[str, str] = {}

    h = manifest["house"]
    width = float(h["widthM"])
    depth = float(h["depthM"])
    anchor = h["anchor"]
    anchor_world = [width * float(anchor[0]), depth * float(anchor[1]), 0.0]
    anchor_ground = project_ground(anchor_world[0], anchor_world[1])
    expected_anchor_pixel = [
        CANONICAL_RENDER_WIDTH / 2.0 + anchor_ground[0],
        CANONICAL_RENDER_HEIGHT / 2.0 + anchor_ground[1],
    ]

    expected_footprint = [
        project_ground(0.0, 0.0),
        project_ground(width, 0.0),
        project_ground(width, depth),
        project_ground(0.0, depth),
    ]
    expected_footprint_pixel = [
        [CANONICAL_RENDER_WIDTH / 2.0 + x, CANONICAL_RENDER_HEIGHT / 2.0 + y]
        for x, y in expected_footprint
    ]

    render = scene_manifest.get("render", {})
    render_ok = (
        int(render.get("width", -1)) == CANONICAL_RENDER_WIDTH
        and int(render.get("height", -1)) == CANONICAL_RENDER_HEIGHT
    )
    if not render_ok:
        reasons.append("render_dimensions_mismatch")

    camera_hash = scene_manifest.get("cameraHash")
    camera_matrix = scene_manifest.get("cameraMatrix")
    expected_matrix = canonical_camera_matrix()
    camera_ok = (
        isinstance(camera_hash, str)
        and camera_hash.startswith("sha256:")
        and isinstance(camera_matrix, list)
        and _matrix_close(camera_matrix, expected_matrix)
        and render_ok
    )
    checks["camera"] = "PASS" if camera_ok else "REFUSE"
    if not camera_ok:
        reasons.append("camera_contract_mismatch")

    scene_anchor = scene_manifest.get("anchor", {})
    scene_world = scene_anchor.get("worldM", [])
    anchor_world_ok = (
        len(scene_world) == 3
        and _close(scene_world[0], anchor_world[0])
        and _close(scene_world[1], anchor_world[1])
        and _close(scene_world[2], 0.0)
    )
    checks["anchor"] = "PASS" if anchor_world_ok else "REFUSE"
    if not anchor_world_ok:
        reasons.append("anchor_world_mismatch")

    actual_anchor_pixel = scene_anchor.get("pixel", [])
    anchor_pixel_ok = _pair_close(actual_anchor_pixel, expected_anchor_pixel)
    checks["anchorPixel"] = "PASS" if anchor_pixel_ok else "REFUSE"
    if not anchor_pixel_ok:
        reasons.append("anchor_pixel_mismatch")

    actual_footprint = scene_manifest.get("footprintPixel", [])
    footprint_pixel_ok = (
        len(actual_footprint) == len(expected_footprint_pixel)
        and all(_pair_close(a, e) for a, e in zip(actual_footprint, expected_footprint_pixel))
    )
    checks["footprintPixels"] = "PASS" if footprint_pixel_ok else "REFUSE"
    if not footprint_pixel_ok:
        reasons.append("footprint_pixel_mismatch")

    return {
        "status": "PASS" if not reasons else "REFUSE",
        "reasons": list(dict.fromkeys(reasons)),
        "checks": checks,
        "observed": {
            "anchorWorldM": scene_world,
            "anchorPixel": actual_anchor_pixel,
            "footprintPixel": actual_footprint,
            "render": render,
            "cameraHash": camera_hash,
            "cameraMatrix": camera_matrix,
        },
        "expected": {
            "anchorWorldM": anchor_world,
            "anchorPixel": expected_anchor_pixel,
            "footprintPixel": expected_footprint_pixel,
            "render": {"width": CANONICAL_RENDER_WIDTH, "height": CANONICAL_RENDER_HEIGHT},
            "cameraMatrix": expected_matrix,
        },
    }
