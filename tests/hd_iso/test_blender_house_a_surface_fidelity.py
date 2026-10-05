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
from tools.hd_iso.compile_surface_fidelity import compile_house_a_surface_fidelity  # noqa: E402
from tools.hd_iso.blender.build_mesh import build_house_objects  # noqa: E402
from tools.hd_iso.blender.build_detail import build_house_detail_objects  # noqa: E402
from tools.hd_iso.blender.build_surface import apply_house_surface  # noqa: E402
from tools.hd_iso.blender.build_surface_fidelity import apply_house_surface_fidelity  # noqa: E402
from tools.hd_iso.blender.camera import ensure_canonical_camera  # noqa: E402


def _matrix(obj):
    return tuple(tuple(float(v) for v in row) for row in obj.matrix_world)


def _mesh_snapshot(scene):
    return {
        obj.name: {
            "matrix": _matrix(obj),
            "vertices": tuple(
                (float(v.co.x), float(v.co.y), float(v.co.z))
                for v in obj.data.vertices
            ),
            "modifiers": tuple(mod.name for mod in obj.modifiers),
        }
        for obj in sorted((o for o in scene.objects if o.type == "MESH"), key=lambda o: o.name)
    }


def _material(obj):
    mats = [slot.material for slot in obj.material_slots if slot.material is not None]
    assert mats, f"{obj.name} has no material"
    return mats[0]


def _node_types(mat):
    return {node.bl_idname for node in mat.node_tree.nodes}


def _displacement_connected(mat):
    outputs = [n for n in mat.node_tree.nodes if n.bl_idname == "ShaderNodeOutputMaterial"]
    assert outputs, f"{mat.name} has no material output"
    return any(output.inputs["Displacement"].is_linked for output in outputs)


bpy.ops.wm.read_factory_settings(use_empty=True)

geometry = manifest_dict(compile_template("house.master.a", structural_seed=18427, root=ROOT))
detail = compile_house_a_detail(geometry, detail_seed=4104)
surface = compile_house_a_surface(
    geometry,
    detail,
    appearance_seed=7001,
    decay_seed=9907,
)
fidelity = compile_house_a_surface_fidelity(
    geometry,
    detail,
    surface,
    fidelity_seed=27182,
)

camera_proof = ensure_canonical_camera(bpy.context.scene)
assert camera_proof.status == "PASS", camera_proof.reasons
camera_before = _matrix(bpy.context.scene.camera)

core = build_house_objects(bpy, geometry)
detail_objects = build_house_detail_objects(bpy, geometry, detail)
surface_receipt = apply_house_surface(
    bpy,
    geometry,
    detail,
    surface,
    core,
    detail_objects,
)
assert surface_receipt["status"] == "PASS"

before = _mesh_snapshot(bpy.context.scene)

receipt = apply_house_surface_fidelity(
    bpy,
    geometry,
    detail,
    surface,
    fidelity,
    core,
    detail_objects,
)

after = _mesh_snapshot(bpy.context.scene)
camera_after = _matrix(bpy.context.scene.camera)

assert before == after, "surface fidelity mutated mesh transforms, vertices, or modifiers"
assert camera_before == camera_after, "surface fidelity mutated canonical camera"
assert receipt["status"] == "PASS", receipt
assert receipt["fidelitySeed"] == 27182
assert receipt["schemaVersion"] == "hd-iso-surface-fidelity-v1"

walls_mat = _material(core["walls"])
roof_mat = _material(detail_objects["roofDetail"])
metal_mat = _material(detail_objects["gutter"])
glass_mat = _material(detail_objects["windows"][0])
trim_mat = _material(detail_objects["porch"])

for mat in (walls_mat, roof_mat, metal_mat, glass_mat, trim_mat):
    assert not _displacement_connected(mat), f"{mat.name} illegally connects material displacement"

wall_nodes = _node_types(walls_mat)
roof_nodes = _node_types(roof_mat)
metal_nodes = _node_types(metal_mat)
glass_nodes = _node_types(glass_mat)
trim_nodes = _node_types(trim_mat)

assert "ShaderNodeBump" in wall_nodes
assert "ShaderNodeTexNoise" in wall_nodes
assert "ShaderNodeSeparateXYZ" in wall_nodes

assert "ShaderNodeBump" in roof_nodes
assert "ShaderNodeTexNoise" in roof_nodes
assert "ShaderNodeSeparateXYZ" in roof_nodes

assert "ShaderNodeBump" in metal_nodes
assert "ShaderNodeTexNoise" in metal_nodes

assert "ShaderNodeBump" in glass_nodes
assert "ShaderNodeTexNoise" in glass_nodes

assert "ShaderNodeBump" in trim_nodes
assert "ShaderNodeTexNoise" in trim_nodes

assert receipt["roles"]["walls"]["directionalWeathering"] is True
assert receipt["roles"]["roof"]["directionalWeathering"] is True
assert receipt["roles"]["metal"]["rustClustering"] is True
assert receipt["roles"]["glass"]["layeredHaze"] is True
assert receipt["roles"]["trim"]["grainWear"] is True

print(json.dumps(receipt, sort_keys=True))
print("PASS: House A Blender surface fidelity preserves frozen geometry and forbids displacement")
