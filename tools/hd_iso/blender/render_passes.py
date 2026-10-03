from __future__ import annotations

import json
from pathlib import Path

from bpy_extras.object_utils import world_to_camera_view
from mathutils import Vector

from .camera import verify_canonical_camera

CANONICAL_RENDER_WIDTH = 512
CANONICAL_RENDER_HEIGHT = 512
CANONICAL_CYCLES_SAMPLES = 64


def verify_render_contract(scene) -> dict:
    reasons: list[str] = []

    camera_proof = verify_canonical_camera(scene)
    if camera_proof.status != "PASS":
        reasons.extend(camera_proof.reasons)

    if scene.render.resolution_x != CANONICAL_RENDER_WIDTH:
        reasons.append(f"render width drift: {scene.render.resolution_x} != {CANONICAL_RENDER_WIDTH}")
    if scene.render.resolution_y != CANONICAL_RENDER_HEIGHT:
        reasons.append(f"render height drift: {scene.render.resolution_y} != {CANONICAL_RENDER_HEIGHT}")
    if scene.render.resolution_percentage != 100:
        reasons.append(f"render percentage drift: {scene.render.resolution_percentage} != 100")
    if scene.render.film_transparent is not True:
        reasons.append("transparent film is disabled")
    if scene.render.engine != "CYCLES":
        reasons.append(f"render engine drift: {scene.render.engine} != CYCLES")
    if scene.cycles.device != "CPU":
        reasons.append(f"cycles device drift: {scene.cycles.device} != CPU")
    if scene.cycles.use_denoising is not False:
        reasons.append("scene cycles denoising is enabled")

    return {
        "status": "PASS" if not reasons else "REFUSE",
        "reasons": reasons,
        "cameraHash": camera_proof.camera_hash,
    }


def _configure_render(scene) -> None:
    scene.render.engine = "CYCLES"
    scene.cycles.device = "CPU"
    scene.cycles.samples = CANONICAL_CYCLES_SAMPLES
    scene.cycles.use_denoising = False
    scene.render.resolution_x = CANONICAL_RENDER_WIDTH
    scene.render.resolution_y = CANONICAL_RENDER_HEIGHT
    scene.render.resolution_percentage = 100
    scene.render.film_transparent = True
    scene.render.image_settings.file_format = "PNG"
    scene.render.image_settings.color_mode = "RGBA"
    for view_layer in scene.view_layers:
        view_layer.cycles.use_denoising = False


def _material(bpy, name: str, rgba, emission: bool = False):
    mat = bpy.data.materials.get(name) or bpy.data.materials.new(name)
    mat.use_nodes = True
    nodes = mat.node_tree.nodes
    links = mat.node_tree.links
    nodes.clear()
    out = nodes.new("ShaderNodeOutputMaterial")
    if emission:
        shader = nodes.new("ShaderNodeEmission")
        shader.inputs["Color"].default_value = rgba
        shader.inputs["Strength"].default_value = 1.0
    else:
        shader = nodes.new("ShaderNodeBsdfPrincipled")
        shader.inputs["Base Color"].default_value = rgba
        shader.inputs["Roughness"].default_value = 0.85
    links.new(shader.outputs[0], out.inputs["Surface"])
    return mat


def _mesh_objects(scene):
    return [obj for obj in scene.objects if obj.type == "MESH"]


def _assign_material(obj, mat) -> None:
    obj.data.materials.clear()
    obj.data.materials.append(mat)


def _ensure_light(bpy, scene) -> None:
    if bpy.data.objects.get("HDISO_KEY_LIGHT") is not None:
        return
    light_data = bpy.data.lights.new("HDISO_KEY_LIGHT", type="SUN")
    light_data.energy = 2.0
    light = bpy.data.objects.new("HDISO_KEY_LIGHT", light_data)
    light.rotation_euler = (0.75, 0.0, -0.75)
    scene.collection.objects.link(light)


def _render_png(bpy, path: Path) -> None:
    scene = bpy.context.scene
    scene.render.image_settings.file_format = "PNG"
    scene.render.image_settings.color_mode = "RGBA"
    scene.render.filepath = str(path)
    bpy.ops.render.render(write_still=True)


def _render_data_passes(bpy, out: Path) -> None:
    scene = bpy.context.scene
    layer = bpy.context.view_layer
    layer.use_pass_z = True
    layer.use_pass_normal = True
    layer.cycles.use_denoising = False

    scene.use_nodes = True
    tree = scene.node_tree
    tree.nodes.clear()
    render_layers = tree.nodes.new("CompositorNodeRLayers")

    depth_out = tree.nodes.new("CompositorNodeOutputFile")
    depth_out.base_path = str(out)
    depth_out.format.file_format = "OPEN_EXR"
    depth_out.format.color_depth = "32"
    depth_out.file_slots[0].path = "depth"
    tree.links.new(render_layers.outputs["Depth"], depth_out.inputs[0])

    normal_out = tree.nodes.new("CompositorNodeOutputFile")
    normal_out.base_path = str(out)
    normal_out.format.file_format = "OPEN_EXR"
    normal_out.format.color_depth = "32"
    normal_out.file_slots[0].path = "normals"
    tree.links.new(render_layers.outputs["Normal"], normal_out.inputs[0])

    bpy.ops.render.render()

    depth_candidates = sorted(out.glob("depth*.exr"))
    normal_candidates = sorted(out.glob("normals*.exr"))
    if not depth_candidates or not normal_candidates:
        raise RuntimeError("Blender did not emit required depth/normal EXR passes")
    depth_candidates[-1].replace(out / "depth.exr")
    normal_candidates[-1].replace(out / "normals.exr")
    scene.use_nodes = False


def _pixel(scene, world_xyz) -> list[float]:
    co = world_to_camera_view(scene, scene.camera, Vector(world_xyz))
    return [
        float(co.x * CANONICAL_RENDER_WIDTH),
        float((1.0 - co.y) * CANONICAL_RENDER_HEIGHT),
    ]


def _camera_matrix(scene) -> list[list[float]]:
    return [[float(v) for v in row] for row in scene.camera.matrix_world]


def render_authoritative_passes(bpy, manifest: dict, out_dir: Path | str) -> dict:
    out = Path(out_dir)
    out.mkdir(parents=True, exist_ok=True)
    scene = bpy.context.scene

    _configure_render(scene)
    contract = verify_render_contract(scene)
    if contract["status"] != "PASS":
        return contract

    meshes = _mesh_objects(scene)
    if not meshes:
        return {"status": "REFUSE", "reasons": ["scene has no mesh objects"]}

    _ensure_light(bpy, scene)

    grey = _material(bpy, "HDISO_NEUTRAL_GREY", (0.45, 0.45, 0.45, 1.0))
    for obj in meshes:
        _assign_material(obj, grey)
    _render_png(bpy, out / "beauty.png")

    white = _material(bpy, "HDISO_SILHOUETTE", (1.0, 1.0, 1.0, 1.0), emission=True)
    for obj in meshes:
        _assign_material(obj, white)
    _render_png(bpy, out / "silhouette.png")

    object_colours = [
        (1.0, 0.0, 0.0, 1.0),
        (0.0, 1.0, 0.0, 1.0),
        (0.0, 0.0, 1.0, 1.0),
        (1.0, 1.0, 0.0, 1.0),
        (1.0, 0.0, 1.0, 1.0),
    ]
    for index, obj in enumerate(meshes):
        mat = _material(bpy, f"HDISO_OBJECT_ID_{index}", object_colours[index % len(object_colours)], emission=True)
        _assign_material(obj, mat)
    _render_png(bpy, out / "object-id.png")

    for obj in meshes:
        _assign_material(obj, grey)
    _render_data_passes(bpy, out)

    h = manifest["house"]
    width = float(h["widthM"])
    depth = float(h["depthM"])
    anchor_world = [width * float(h["anchor"][0]), depth * float(h["anchor"][1]), 0.0]
    footprint_world = [
        (0.0, 0.0, 0.0),
        (width, 0.0, 0.0),
        (width, depth, 0.0),
        (0.0, depth, 0.0),
    ]

    scene_manifest = {
        "schemaVersion": "hd-iso-scene-manifest-v1",
        "templateId": manifest["templateId"],
        "structuralSeed": int(manifest["structuralSeed"]),
        "render": {
            "width": CANONICAL_RENDER_WIDTH,
            "height": CANONICAL_RENDER_HEIGHT,
            "transparent": True,
            "engine": "CYCLES",
            "device": "CPU",
            "samples": CANONICAL_CYCLES_SAMPLES,
            "denoising": False,
        },
        "cameraHash": contract["cameraHash"],
        "cameraMatrix": _camera_matrix(scene),
        "anchor": {"worldM": anchor_world, "pixel": _pixel(scene, anchor_world)},
        "footprintPixel": [_pixel(scene, p) for p in footprint_world],
    }
    (out / "scene-manifest.json").write_text(json.dumps(scene_manifest, sort_keys=True, indent=2) + "\n")

    final_contract = verify_render_contract(scene)
    if final_contract["status"] != "PASS":
        return final_contract

    return {
        "status": "PASS",
        "reasons": [],
        "output": str(out),
        "sceneManifest": scene_manifest,
    }
