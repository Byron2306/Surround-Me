from __future__ import annotations

import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

import bpy  # noqa: E402

from tools.hd_iso.compile_geometry import compile_template, manifest_dict  # noqa: E402
from tools.hd_iso.compile_detail import compile_house_a_detail  # noqa: E402
from tools.hd_iso.compile_surface import compile_house_a_surface  # noqa: E402
from tools.hd_iso.blender.build_mesh import build_house_objects  # noqa: E402
from tools.hd_iso.blender.build_detail import build_house_detail_objects  # noqa: E402
from tools.hd_iso.blender.build_surface import apply_house_surface  # noqa: E402
from tools.hd_iso.blender.camera import ensure_canonical_camera  # noqa: E402


def _matrix(obj):
    return tuple(tuple(float(v) for v in row) for row in obj.matrix_world)


def _mesh_snapshot(scene):
    result = {}
    for obj in sorted((o for o in scene.objects if o.type == "MESH"), key=lambda o: o.name):
        result[obj.name] = {
            "matrix": _matrix(obj),
            "vertices": tuple(
                (float(v.co.x), float(v.co.y), float(v.co.z))
                for v in obj.data.vertices
            ),
        }
    return result


def _material_names(obj):
    return tuple(slot.material.name for slot in obj.material_slots if slot.material is not None)


bpy.ops.wm.read_factory_settings(use_empty=True)

geometry = manifest_dict(compile_template("house.master.a", structural_seed=18427, root=ROOT))
detail = compile_house_a_detail(geometry, detail_seed=4104)
surface = compile_house_a_surface(
    geometry,
    detail,
    appearance_seed=7001,
    decay_seed=9907,
)

camera_proof = ensure_canonical_camera(bpy.context.scene)
assert camera_proof.status == "PASS", camera_proof.reasons
camera_before = _matrix(bpy.context.scene.camera)

core = build_house_objects(bpy, geometry)
detail_objects = build_house_detail_objects(bpy, geometry, detail)

before = _mesh_snapshot(bpy.context.scene)
before_names = tuple(before)

receipt = apply_house_surface(
    bpy,
    geometry,
    detail,
    surface,
    core,
    detail_objects,
)

after = _mesh_snapshot(bpy.context.scene)
after_names = tuple(after)
camera_after = _matrix(bpy.context.scene.camera)

assert before_names == after_names, "surface application changed mesh object set"
assert before == after, "surface application mutated mesh transforms or vertices"
assert camera_before == camera_after, "surface application mutated canonical camera"

assert receipt["status"] == "PASS", receipt
assert receipt["surfaceSchemaVersion"] == "hd-iso-surface-v1"
assert receipt["appearanceSeed"] == 7001
assert receipt["decaySeed"] == 9907

walls = core["walls"]
roof = detail_objects["roofDetail"]
windows = detail_objects["windows"]
fascia = detail_objects["fascia"]
gutter = detail_objects["gutter"]
downpipe = detail_objects["downpipe"]
porch = detail_objects["porch"]

assert _material_names(walls), "walls received no material"
assert _material_names(roof), "roof received no material"
assert all(_material_names(obj) for obj in windows), "window received no material"
assert all(_material_names(obj) for obj in fascia), "fascia received no material"
assert _material_names(gutter), "gutter received no material"
assert _material_names(downpipe), "downpipe received no material"
assert _material_names(porch), "porch received no material"

assert receipt["assignments"]["walls"]["family"] == surface["materials"]["walls"]["family"]
assert receipt["assignments"]["roof"]["family"] == surface["materials"]["roof"]["family"]
assert receipt["assignments"]["glass"]["state"] == surface["materials"]["glass"]["state"]
assert receipt["assignments"]["metal"]["family"] == surface["materials"]["metal"]["family"]

print(json.dumps(receipt, sort_keys=True))
print("PASS: House A Blender surface application preserves frozen geometry")
