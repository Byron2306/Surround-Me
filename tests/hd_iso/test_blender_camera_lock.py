from __future__ import annotations

import math
import sys
from pathlib import Path

import bpy

ROOT = Path(__file__).resolve().parents[2]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from tools.hd_iso.blender.camera import (  # noqa: E402
    CAMERA_NAME,
    ensure_canonical_camera,
    verify_canonical_camera,
)


def assert_close(a: float, b: float, tol: float = 1e-7) -> None:
    assert abs(a - b) <= tol, f"{a} != {b}"


def main() -> None:
    bpy.ops.wm.read_factory_settings(use_empty=True)
    scene = bpy.context.scene

    proof = ensure_canonical_camera(scene)
    assert proof.status == "PASS", proof.reasons
    assert scene.camera is not None
    assert scene.camera.name == CAMERA_NAME
    assert scene.camera.data.type == "ORTHO"

    # Camera law is frozen to the approved dimetric view: azimuth 45°, elevation 30°,
    # zero roll, with an orthographic projection. The proof exposes the projected
    # two-metre ground basis in logical-pixel units so it can be compared directly
    # with Surround Me's 64x32 tile law.
    assert_close(proof.azimuth_degrees, 45.0)
    assert_close(proof.elevation_degrees, 30.0)
    assert_close(proof.roll_degrees, 0.0)
    assert_close(proof.ground_basis_x[0], 32.0)
    assert_close(proof.ground_basis_x[1], 16.0)
    assert_close(proof.ground_basis_y[0], -32.0)
    assert_close(proof.ground_basis_y[1], 16.0)
    assert proof.camera_hash.startswith("sha256:")

    # Verification of an untouched camera must remain PASS and preserve the hash.
    verified = verify_canonical_camera(scene)
    assert verified.status == "PASS", verified.reasons
    assert verified.camera_hash == proof.camera_hash

    # Fail closed on camera drift. Verification must not repair the camera.
    original_x = scene.camera.location.x
    scene.camera.location.x += 0.125
    refused = verify_canonical_camera(scene)
    assert refused.status == "REFUSE"
    assert refused.reasons
    assert_close(scene.camera.location.x, original_x + 0.125)

    print("PASS: canonical Blender camera lock and drift refusal")


if __name__ == "__main__":
    main()
