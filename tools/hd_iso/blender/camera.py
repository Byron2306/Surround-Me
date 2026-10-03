from __future__ import annotations

from dataclasses import dataclass
import hashlib
import json
import math

import bpy
from mathutils import Vector

CAMERA_NAME = "HDISO_CANONICAL_CAMERA"
AZIMUTH_DEGREES = 45.0
ELEVATION_DEGREES = 30.0
ROLL_DEGREES = 0.0
# 512px render with 45deg azimuth must resolve to the canonical 16px/m
# horizontal ground component and 8px/m vertical ground component.
ORTHO_SCALE = 16.0 * math.sqrt(2.0)
CAMERA_DISTANCE = 20.0
GROUND_BASIS_X = (32.0, 16.0)
GROUND_BASIS_Y = (-32.0, 16.0)
# Blender stores several camera properties at float precision. Keep the drift
# verifier tighter than any meaningful camera nudge, but loose enough to accept
# Blender's round-trip representation of the canonical values.
_TOL = 1e-6


@dataclass(frozen=True)
class CameraProof:
    status: str
    reasons: tuple[str, ...]
    azimuth_degrees: float
    elevation_degrees: float
    roll_degrees: float
    ground_basis_x: tuple[float, float]
    ground_basis_y: tuple[float, float]
    camera_hash: str


def _canonical_location() -> Vector:
    az = math.radians(AZIMUTH_DEGREES)
    el = math.radians(ELEVATION_DEGREES)
    horizontal = CAMERA_DISTANCE * math.cos(el)
    return Vector((
        horizontal * math.cos(az),
        horizontal * math.sin(az),
        CAMERA_DISTANCE * math.sin(el),
    ))


def _canonical_rotation(location: Vector):
    direction = -location
    return direction.to_track_quat('-Z', 'Y').to_euler('XYZ')


def _canonical_payload() -> dict:
    loc = _canonical_location()
    rot = _canonical_rotation(loc)
    return {
        "name": CAMERA_NAME,
        "type": "ORTHO",
        "location": [round(v, 12) for v in loc],
        "rotation_euler": [round(v, 12) for v in rot],
        "ortho_scale": ORTHO_SCALE,
        "azimuth_degrees": AZIMUTH_DEGREES,
        "elevation_degrees": ELEVATION_DEGREES,
        "roll_degrees": ROLL_DEGREES,
        "ground_basis_x": list(GROUND_BASIS_X),
        "ground_basis_y": list(GROUND_BASIS_Y),
    }


def _camera_hash() -> str:
    raw = json.dumps(_canonical_payload(), sort_keys=True, separators=(",", ":")).encode("utf-8")
    return "sha256:" + hashlib.sha256(raw).hexdigest()


def _proof(status: str, reasons: tuple[str, ...] = ()) -> CameraProof:
    return CameraProof(
        status=status,
        reasons=reasons,
        azimuth_degrees=AZIMUTH_DEGREES,
        elevation_degrees=ELEVATION_DEGREES,
        roll_degrees=ROLL_DEGREES,
        ground_basis_x=GROUND_BASIS_X,
        ground_basis_y=GROUND_BASIS_Y,
        camera_hash=_camera_hash(),
    )


def ensure_canonical_camera(scene) -> CameraProof:
    existing = bpy.data.objects.get(CAMERA_NAME)
    if existing is not None:
        bpy.data.objects.remove(existing, do_unlink=True)

    data = bpy.data.cameras.new(CAMERA_NAME)
    camera = bpy.data.objects.new(CAMERA_NAME, data)
    scene.collection.objects.link(camera)
    scene.camera = camera

    location = _canonical_location()
    camera.location = location
    camera.rotation_mode = 'XYZ'
    camera.rotation_euler = _canonical_rotation(location)
    data.type = 'ORTHO'
    data.ortho_scale = ORTHO_SCALE

    return verify_canonical_camera(scene)


def verify_canonical_camera(scene) -> CameraProof:
    reasons: list[str] = []
    camera = scene.camera
    if camera is None:
        return _proof("REFUSE", ("scene has no active camera",))
    if camera.name != CAMERA_NAME:
        reasons.append(f"camera name drift: {camera.name}")
    if camera.data.type != 'ORTHO':
        reasons.append(f"camera type drift: {camera.data.type}")

    expected_loc = _canonical_location()
    expected_rot = _canonical_rotation(expected_loc)
    for axis, actual, expected in zip("xyz", camera.location, expected_loc):
        if abs(actual - expected) > _TOL:
            reasons.append(f"camera location {axis} drift: {actual} != {expected}")
    for axis, actual, expected in zip("xyz", camera.rotation_euler, expected_rot):
        if abs(actual - expected) > _TOL:
            reasons.append(f"camera rotation {axis} drift: {actual} != {expected}")
    if abs(camera.data.ortho_scale - ORTHO_SCALE) > _TOL:
        reasons.append(f"ortho scale drift: {camera.data.ortho_scale} != {ORTHO_SCALE}")

    return _proof("PASS" if not reasons else "REFUSE", tuple(reasons))
