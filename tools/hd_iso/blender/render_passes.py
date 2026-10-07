from __future__ import annotations

import json
from pathlib import Path

from bpy_extras.object_utils import world_to_camera_view
from mathutils import Vector

from .camera import verify_canonical_camera
from .lighting import apply_house_a_visual_calibration
from tools.hd_iso.render_config import DEFAULT_RENDER_SCALE, MIN_RENDER_SCALE

CANONICAL_RENDER_WIDTH = 512
CANONICAL_RENDER_HEIGHT = 512
CANONICAL_CYCLES_SAMPLES = 64
PROJECTION_ADAPTER = "mirror_x"


def verify_render_contract(scene, render_scale: int = DEFAULT_RENDER_SCALE) -> dict:
    reasons: list[str] = []

    camera_proof = verify_canonical_camera(scene)
    if camera_proof.status != "PASS":
        reasons.extend(camera_proof.reasons)

    expected_width = CANONICAL_RENDER_WIDTH * int(render_scale)
    expected_height = CANONICAL_RENDER_HEIGHT * int(render_scale)
    if scene.render.resolution_x != expected_width:
        reasons.append(f"render width drift: {scene.render.resolution_x} != {expected_width}")
    if scene.render.resolution_y != expected_height:
        reasons.append(f"render height drift: {scene.render.resolution_y} != {expected_height}")
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


def _configure_render(scene, render_scale: int = DEFAULT_RENDER_SCALE) -> None:
    scene.render.engine = "CYCLES"
    scene.cycles.device = "CPU"
    scene.cycles.samples = CANONICAL_CYCLES_SAMPLES
    scene.cycles.use_denoising = False
    scene.render.resolution_x = CANONICAL_RENDER_WIDTH * int(render_scale)
    scene.render.resolution_y = CANONICAL_RENDER_HEIGHT * int(render_scale)
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
    return [obj for obj in scene.objects if obj.type == "MESH" and not obj.hide_render]


def _assign_material(obj, mat) -> None:
    obj.data.materials.clear()
    obj.data.materials.append(mat)
    for polygon in obj.data.polygons:
        polygon.material_index = 0


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



def _image_alpha_pixel_count(bpy, path: Path, threshold: float = 0.5) -> int:
    image = bpy.data.images.load(str(path), check_existing=False)
    try:
        pixels = image.pixels[:]
        return sum(1 for index in range(3, len(pixels), 4) if pixels[index] >= threshold)
    finally:
        bpy.data.images.remove(image)


def _render_region_mask(
    bpy,
    out_path: Path,
    meshes,
    owned_objects,
    white_material,
) -> int:
    owned_names = {obj.name for obj in owned_objects}
    prior_hidden = {obj.name: bool(obj.hide_render) for obj in meshes}

    try:
        for obj in meshes:
            obj.hide_render = obj.name not in owned_names
            if obj.name in owned_names:
                _assign_material(obj, white_material)

        _render_png(bpy, out_path)
    finally:
        for obj in meshes:
            obj.hide_render = prior_hidden[obj.name]

    return _image_alpha_pixel_count(bpy, out_path)


def _render_structural_mask_bundle(
    bpy,
    scene,
    out: Path,
    meshes,
    *,
    core_objects: dict,
    detail_objects: dict,
    camera_hash: str,
    render_scale: int,
    variant_id: str | None = None,
) -> dict:
    if detail_objects is None:
        raise RuntimeError("structural mask bundle requires architectural detail objects")

    masks_dir = out / "masks"
    masks_dir.mkdir(parents=True, exist_ok=True)

    white = _material(
        bpy,
        "HDISO_STRUCTURAL_MASK_WHITE",
        (1.0, 1.0, 1.0, 1.0),
        emission=True,
    )

    regions = {
        "silhouette": list(meshes),
        "walls": [core_objects["walls"]],
        "roof": [detail_objects["roofDetail"]],
        "door": [core_objects["door"]],
        "windows": list(detail_objects["windows"]),
        "porch": [detail_objects["porch"]] if detail_objects["porch"] is not None else [],
        "fascia": list(detail_objects["fascia"]),
        "gutter": [detail_objects["gutter"]],
        "downpipe": [detail_objects["downpipe"]],
    }

    manifest_regions = {}
    for name in (
        "silhouette",
        "walls",
        "roof",
        "door",
        "windows",
        "porch",
        "fascia",
        "gutter",
        "downpipe",
    ):
        filename = f"{name}.png"
        path = masks_dir / filename
        pixel_count = _render_region_mask(
            bpy,
            path,
            meshes,
            regions[name],
            white,
        )
        if pixel_count <= 0 and not (name == "porch" and not regions[name]):
            raise RuntimeError(f"structural mask region is empty: {name}")
        manifest_regions[name] = {
            "file": filename,
            "pixelCount": int(pixel_count),
            "objects": [obj.name for obj in regions[name]],
        }

    manifest = {
        **({"variantId": variant_id} if variant_id else {}),
        "schemaVersion": "hd-iso-structural-mask-bundle-v1",
        "templateId": "house.master.a",
        "logicalWidth": CANONICAL_RENDER_WIDTH,
        "logicalHeight": CANONICAL_RENDER_HEIGHT,
        "renderScale": int(render_scale),
        "width": CANONICAL_RENDER_WIDTH * int(render_scale),
        "height": CANONICAL_RENDER_HEIGHT * int(render_scale),
        "cameraHash": camera_hash,
        "projectionAdapter": PROJECTION_ADAPTER,
        "regions": manifest_regions,
    }
    (masks_dir / "manifest.json").write_text(
        json.dumps(manifest, sort_keys=True, indent=2) + "\n"
    )
    return manifest

def _blender_pixel(scene, world_xyz) -> list[float]:
    co = world_to_camera_view(scene, scene.camera, Vector(world_xyz))
    return [
        float(co.x * CANONICAL_RENDER_WIDTH),
        float((1.0 - co.y) * CANONICAL_RENDER_HEIGHT),
    ]


def _game_pixel(scene, world_xyz) -> list[float]:
    """Convert Blender's right-handed image X into the game's left-handed X.

    The game projection is sx=(X-Y)*16 while the canonical Blender camera
    produces the same magnitude with opposite horizontal handedness. The
    authoritative adapter mirrors X around the 512px render centre and leaves
    Y unchanged.
    """
    x, y = _blender_pixel(scene, world_xyz)
    return [float(CANONICAL_RENDER_WIDTH - x), y]


def _camera_matrix(scene) -> list[list[float]]:
    return [[float(v) for v in row] for row in scene.camera.matrix_world]


def render_authoritative_passes(
    bpy,
    manifest: dict,
    out_dir: Path | str,
    detail_manifest: dict | None = None,
    core_objects: dict | None = None,
    detail_objects: dict | None = None,
    surface_manifest: dict | None = None,
    surface_receipt: dict | None = None,
    fidelity_manifest: dict | None = None,
    fidelity_receipt: dict | None = None,
    render_scale: int = DEFAULT_RENDER_SCALE,
) -> dict:
    out = Path(out_dir)
    out.mkdir(parents=True, exist_ok=True)
    scene = bpy.context.scene

    if int(render_scale) < MIN_RENDER_SCALE:
        return {"status": "REFUSE", "reasons": ["render_scale_must_be_positive"]}
    _configure_render(scene, render_scale)
    contract = verify_render_contract(scene, render_scale)
    if contract["status"] != "PASS":
        return contract

    meshes = _mesh_objects(scene)
    if not meshes:
        return {"status": "REFUSE", "reasons": ["scene has no mesh objects"]}

    _ensure_light(bpy, scene)
    visual_calibration_receipt = apply_house_a_visual_calibration(bpy, scene, manifest)

    grey = _material(bpy, "HDISO_NEUTRAL_GREY", (0.45, 0.45, 0.45, 1.0))
    if surface_manifest is None:
        for obj in meshes:
            _assign_material(obj, grey)
    else:
        # Preserve validated governed materials for the beauty pass. Any mesh
        # without a surface assignment remains diagnostically neutral.
        for obj in meshes:
            if not obj.material_slots:
                _assign_material(obj, grey)
    _render_png(bpy, out / "beauty.png")

    # Diagnostic/proof passes do not need path-traced convergence. Keep the
    # governed beauty pass at canonical quality, then drop proof-only passes
    # to a single deterministic sample to avoid multiplying supersample cost.
    scene.cycles.samples = 1

    structural_masks = None
    if detail_manifest is not None:
        if core_objects is None or detail_objects is None:
            return {
                "status": "REFUSE",
                "reasons": ["canonical structural mask objects missing"],
            }
        structural_masks = _render_structural_mask_bundle(
            bpy,
            scene,
            out,
            meshes,
            core_objects=core_objects,
            detail_objects=detail_objects,
            variant_id=manifest.get("variantId"),
            camera_hash=contract["cameraHash"],
            render_scale=render_scale,
        )

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
        **({"variantId": manifest["variantId"]} if "variantId" in manifest else {}),
        "schemaVersion": "hd-iso-scene-manifest-v1",
        "templateId": manifest["templateId"],
        "structuralSeed": int(manifest["structuralSeed"]),
        "render": {
            "logicalWidth": CANONICAL_RENDER_WIDTH,
            "logicalHeight": CANONICAL_RENDER_HEIGHT,
            "renderScale": int(render_scale),
            "width": CANONICAL_RENDER_WIDTH * int(render_scale),
            "height": CANONICAL_RENDER_HEIGHT * int(render_scale),
            "transparent": True,
            "engine": "CYCLES",
            "device": "CPU",
            "samples": CANONICAL_CYCLES_SAMPLES,
            "denoising": False,
        },
        "cameraHash": contract["cameraHash"],
        "cameraMatrix": _camera_matrix(scene),
        "projectionAdapter": PROJECTION_ADAPTER,
        "anchor": {
            "worldM": anchor_world,
            "pixel": _game_pixel(scene, anchor_world),
            "blenderPixel": _blender_pixel(scene, anchor_world),
            "renderPixel": [v * int(render_scale) for v in _game_pixel(scene, anchor_world)],
            "blenderRenderPixel": [v * int(render_scale) for v in _blender_pixel(scene, anchor_world)],
        },
        "footprintPixel": [_game_pixel(scene, p) for p in footprint_world],
        "footprintBlenderPixel": [_blender_pixel(scene, p) for p in footprint_world],
        "footprintRenderPixel": [
            [v * int(render_scale) for v in _game_pixel(scene, p)]
            for p in footprint_world
        ],
        "footprintBlenderRenderPixel": [
            [v * int(render_scale) for v in _blender_pixel(scene, p)]
            for p in footprint_world
        ],
    }
    if detail_manifest is not None:
        if detail_objects is None:
            return {"status": "REFUSE", "reasons": ["detail objects missing after detail manifest build"]}
        scene_manifest["detail"] = {
            "schemaVersion": detail_manifest["schemaVersion"],
            "detailSeed": int(detail_manifest["detailSeed"]),
            "sourceGeometrySha256": detail_manifest["sourceGeometrySha256"],
            "objectCounts": {
                "windows": len(detail_objects["windows"]),
                "fascia": len(detail_objects["fascia"]),
                "gutter": 1,
                "downpipe": 1,
                "porch": int(detail_objects["porch"] is not None),
            },
        }

    if surface_manifest is not None:
        if surface_receipt is None or surface_receipt.get("status") != "PASS":
            return {"status": "REFUSE", "reasons": ["surface receipt missing or refused"]}
        scene_manifest["surface"] = {
            "schemaVersion": surface_manifest["schemaVersion"],
            "appearanceSeed": int(surface_manifest["appearanceSeed"]),
            "decaySeed": int(surface_manifest["decaySeed"]),
            "sourceGeometrySha256": surface_manifest["sourceGeometrySha256"],
            "sourceDetailSha256": surface_manifest["sourceDetailSha256"],
            "assignments": surface_receipt["assignments"],
        }

    if fidelity_manifest is not None:
        if fidelity_receipt is None or fidelity_receipt.get("status") != "PASS":
            return {"status": "REFUSE", "reasons": ["surface fidelity receipt missing or refused"]}
        scene_manifest["surfaceFidelity"] = {
            "schemaVersion": fidelity_manifest["schemaVersion"],
            "fidelitySeed": int(fidelity_manifest["fidelitySeed"]),
            "sourceGeometrySha256": fidelity_manifest["sourceGeometrySha256"],
            "sourceDetailSha256": fidelity_manifest["sourceDetailSha256"],
            "sourceSurfaceSha256": fidelity_manifest["sourceSurfaceSha256"],
            "roles": fidelity_receipt["roles"],
        }

    if visual_calibration_receipt.get("status") != "PASS":
        return {"status": "REFUSE", "reasons": ["visual calibration receipt missing or refused"]}
    scene_manifest["visualCalibration"] = {
        "profile": visual_calibration_receipt["profile"],
        "world": visual_calibration_receipt["world"],
        "exposure": visual_calibration_receipt["exposure"],
        "lights": visual_calibration_receipt["lights"],
    }

    if structural_masks is not None:
        scene_manifest["structuralMasks"] = {
            "schemaVersion": structural_masks["schemaVersion"],
            "manifest": "masks/manifest.json",
        }

    if manifest.get("variantId"):
        scene.cycles.samples = CANONICAL_CYCLES_SAMPLES
        if scene.get("hdIsoVariantFinish") is not None:
            scene_manifest["variantFinish"] = json.loads(scene["hdIsoVariantFinish"])
        scene_manifest["renderContract"] = verify_render_contract(scene, render_scale)
        if scene_manifest["renderContract"]["status"] != "PASS":
            return scene_manifest["renderContract"]
    (out / "scene-manifest.json").write_text(json.dumps(scene_manifest, sort_keys=True, indent=2) + "\n")

    # Restore canonical beauty quality before the final contract check.
    scene.cycles.samples = CANONICAL_CYCLES_SAMPLES
    final_contract = verify_render_contract(scene, render_scale)
    if final_contract["status"] != "PASS":
        return final_contract

    return {
        "status": "PASS",
        "reasons": [],
        "output": str(out),
        "sceneManifest": scene_manifest,
    }
