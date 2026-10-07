from __future__ import annotations

from tools.hd_iso.surface.validation import validate_house_a_surface


def _clear_materials(obj) -> None:
    obj.data.materials.clear()


def _assign(obj, material) -> None:
    _clear_materials(obj)
    obj.data.materials.append(material)


def _rgba(value):
    return tuple(float(v) for v in value)


def _principled_material(
    bpy,
    name: str,
    base_rgba,
    roughness: float,
    *,
    decay: float = 0.0,
    decay_kind: str = "grime",
):
    mat = bpy.data.materials.get(name) or bpy.data.materials.new(name)
    mat.use_nodes = True
    nodes = mat.node_tree.nodes
    links = mat.node_tree.links
    nodes.clear()

    out = nodes.new("ShaderNodeOutputMaterial")
    bsdf = nodes.new("ShaderNodeBsdfPrincipled")
    texcoord = nodes.new("ShaderNodeTexCoord")
    noise = nodes.new("ShaderNodeTexNoise")
    ramp = nodes.new("ShaderNodeValToRGB")

    base = _rgba(base_rgba)
    decay = max(0.0, min(1.0, float(decay)))

    noise.inputs["Scale"].default_value = 3.5 + (decay * 5.0)
    noise.inputs["Detail"].default_value = 4.0
    noise.inputs["Roughness"].default_value = 0.65

    dark = tuple(max(0.0, channel * (0.42 + 0.28 * (1.0 - decay))) for channel in base[:3]) + (1.0,)
    ramp.color_ramp.elements[0].color = dark
    ramp.color_ramp.elements[1].color = base

    bsdf.inputs["Roughness"].default_value = max(0.0, min(1.0, float(roughness) + (0.12 * decay)))

    links.new(texcoord.outputs["Generated"], noise.inputs["Vector"])
    links.new(noise.outputs["Fac"], ramp.inputs["Fac"])
    links.new(ramp.outputs["Color"], bsdf.inputs["Base Color"])
    links.new(bsdf.outputs["BSDF"], out.inputs["Surface"])

    mat["hdIsoSurfaceRole"] = decay_kind
    mat["hdIsoDecay"] = decay
    return mat


def _glass_material(bpy, name: str, glass: dict, decay: dict):
    mat = bpy.data.materials.get(name) or bpy.data.materials.new(name)
    mat.use_nodes = True
    nodes = mat.node_tree.nodes
    links = mat.node_tree.links
    nodes.clear()

    out = nodes.new("ShaderNodeOutputMaterial")
    bsdf = nodes.new("ShaderNodeBsdfPrincipled")
    noise = nodes.new("ShaderNodeTexNoise")
    texcoord = nodes.new("ShaderNodeTexCoord")
    ramp = nodes.new("ShaderNodeValToRGB")

    base = _rgba(glass["baseColorRgba"])
    dirt = float(decay["glassDirt"])
    noise.inputs["Scale"].default_value = 7.0
    noise.inputs["Detail"].default_value = 3.0
    ramp.color_ramp.elements[0].color = (
        max(0.0, base[0] * 0.45),
        max(0.0, base[1] * 0.45),
        max(0.0, base[2] * 0.45),
        1.0,
    )
    ramp.color_ramp.elements[1].color = base

    bsdf.inputs["Roughness"].default_value = max(
        0.0,
        min(1.0, float(glass["roughness"]) + (0.35 * dirt)),
    )

    links.new(texcoord.outputs["Generated"], noise.inputs["Vector"])
    links.new(noise.outputs["Fac"], ramp.inputs["Fac"])
    links.new(ramp.outputs["Color"], bsdf.inputs["Base Color"])
    links.new(bsdf.outputs["BSDF"], out.inputs["Surface"])

    mat["hdIsoGlassState"] = glass["state"]
    mat["hdIsoGlassDirt"] = dirt
    return mat


def apply_house_surface(
    bpy,
    geometry: dict,
    detail: dict,
    surface: dict,
    core_objects: dict,
    detail_objects: dict,
) -> dict:
    validation = validate_house_a_surface(geometry, detail, surface)
    if validation.status != "PASS":
        raise RuntimeError(f"surface manifest refused: {validation.reasons}")

    materials = surface["materials"]
    decay = surface["decay"]

    wall_mat = _principled_material(
        bpy,
        f"HDISO.Surface.Walls.{materials['walls']['family']}",
        materials["walls"]["baseColorRgba"],
        materials["walls"]["roughness"],
        decay=max(decay["paintWear"], decay["crackedPlaster"], decay["dampStreaks"], decay["grime"]),
        decay_kind="wall_weathering",
    )
    roof_mat = _principled_material(
        bpy,
        f"HDISO.Surface.Roof.{materials['roof']['family']}",
        materials["roof"]["baseColorRgba"],
        materials["roof"]["roughness"],
        decay=max(decay["roofStaining"], decay["mossMildew"]),
        decay_kind="roof_weathering",
    )
    trim_mat = _principled_material(
        bpy,
        f"HDISO.Surface.Trim.{materials['trim']['family']}",
        materials["trim"]["baseColorRgba"],
        materials["trim"]["roughness"],
        decay=decay["paintWear"],
        decay_kind="trim_weathering",
    )
    metal_mat = _principled_material(
        bpy,
        f"HDISO.Surface.Metal.{materials['metal']['family']}",
        materials["metal"]["baseColorRgba"],
        materials["metal"]["roughness"],
        decay=max(decay["rust"], decay["gutterStaining"]),
        decay_kind="metal_weathering",
    )
    foundation_mat = _principled_material(
        bpy,
        "HDISO.Surface.Foundation",
        (0.25, 0.24, 0.22, 1.0),
        0.9,
        decay=decay["foundationDirt"],
        decay_kind="foundation_dirt",
    )
    glass_mat = _glass_material(
        bpy,
        f"HDISO.Surface.Glass.{materials['glass']['state']}",
        materials["glass"],
        decay,
    )

    _assign(core_objects["foundation"], foundation_mat)
    _assign(core_objects["walls"], wall_mat)
    _assign(core_objects["door"], trim_mat)

    # The accepted A1 extended roof is the visible roof skin. The original
    # greybox roof remains structural evidence and is not modified here.
    _assign(detail_objects["roofDetail"], roof_mat)
    for obj in detail_objects["windows"]:
        _assign(obj, glass_mat)
    for obj in detail_objects["fascia"]:
        _assign(obj, trim_mat)
    _assign(detail_objects["gutter"], metal_mat)
    _assign(detail_objects["downpipe"], metal_mat)
    if detail_objects["porch"] is not None:
        _assign(detail_objects["porch"], trim_mat)

    return {
        "status": "PASS",
        "surfaceSchemaVersion": surface["schemaVersion"],
        "appearanceSeed": int(surface["appearanceSeed"]),
        "decaySeed": int(surface["decaySeed"]),
        "sourceGeometrySha256": surface["sourceGeometrySha256"],
        "sourceDetailSha256": surface["sourceDetailSha256"],
        "assignments": {
            "walls": {"family": materials["walls"]["family"], "object": core_objects["walls"].name},
            "roof": {"family": materials["roof"]["family"], "object": detail_objects["roofDetail"].name},
            "trim": {
                "family": materials["trim"]["family"],
                "objects": [
                    core_objects["door"].name,
                    *[obj.name for obj in detail_objects["fascia"]],
                    *([detail_objects["porch"].name] if detail_objects["porch"] is not None else []),
                ],
            },
            "metal": {
                "family": materials["metal"]["family"],
                "objects": [
                    detail_objects["gutter"].name,
                    detail_objects["downpipe"].name,
                ],
            },
            "glass": {
                "state": materials["glass"]["state"],
                "objects": [obj.name for obj in detail_objects["windows"]],
            },
            "foundation": {
                "object": core_objects["foundation"].name,
                "dirt": float(decay["foundationDirt"]),
            },
        },
    }
