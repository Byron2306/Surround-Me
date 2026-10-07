from __future__ import annotations

from tools.hd_iso.surface_fidelity.validation import validate_house_a_surface_fidelity


_PREFIX = "HDISO_FIDELITY_"


def _material(obj):
    mats = [slot.material for slot in obj.material_slots if slot.material is not None]
    if not mats:
        raise RuntimeError(f"{obj.name} has no material for fidelity upgrade")
    return mats[0]


def _remove_prior_fidelity_nodes(mat) -> None:
    nodes = mat.node_tree.nodes
    for node in list(nodes):
        if node.name.startswith(_PREFIX):
            nodes.remove(node)


def _principled(mat):
    for node in mat.node_tree.nodes:
        if node.bl_idname == "ShaderNodeBsdfPrincipled":
            return node
    raise RuntimeError(f"{mat.name} is missing Principled BSDF")


def _tag(node, suffix: str):
    node.name = f"{_PREFIX}{suffix}"
    node.label = suffix
    return node


def _connect_bump(mat, height_socket, strength: float, distance: float):
    nodes = mat.node_tree.nodes
    links = mat.node_tree.links
    bsdf = _principled(mat)
    bump = _tag(nodes.new("ShaderNodeBump"), "BUMP")
    bump.inputs["Strength"].default_value = max(0.0, min(1.0, float(strength)))
    bump.inputs["Distance"].default_value = max(0.0005, float(distance))
    links.new(height_socket, bump.inputs["Height"])
    links.new(bump.outputs["Normal"], bsdf.inputs["Normal"])
    return bump


def _directional_wall_graph(mat, channels: dict):
    nodes = mat.node_tree.nodes
    links = mat.node_tree.links

    tex = _tag(nodes.new("ShaderNodeTexCoord"), "WALL_TEXCOORD")
    mapping = _tag(nodes.new("ShaderNodeMapping"), "WALL_MAPPING")
    separate = _tag(nodes.new("ShaderNodeSeparateXYZ"), "WALL_SEPARATE")
    noise = _tag(nodes.new("ShaderNodeTexNoise"), "WALL_STREAK_NOISE")
    lower = _tag(nodes.new("ShaderNodeMapRange"), "WALL_LOWER_DIRT")
    mix = _tag(nodes.new("ShaderNodeMath"), "WALL_COMBINE")
    mix.operation = "MULTIPLY"

    scale = float(channels["microScale"])
    streak_bias = float(channels["verticalStreakBias"])
    mapping.inputs["Scale"].default_value = (
        scale * (0.55 + 0.45 * (1.0 - streak_bias)),
        scale * (0.55 + 0.45 * (1.0 - streak_bias)),
        max(0.5, scale * (0.10 + 0.30 * (1.0 - streak_bias))),
    )
    noise.inputs["Scale"].default_value = 1.0
    noise.inputs["Detail"].default_value = 6.0
    noise.inputs["Roughness"].default_value = 0.72

    lower.inputs["From Min"].default_value = 0.0
    lower.inputs["From Max"].default_value = 1.0
    lower.inputs["To Min"].default_value = float(channels["lowerWallDirtBias"])
    lower.inputs["To Max"].default_value = 0.05
    lower.clamp = True

    links.new(tex.outputs["Generated"], mapping.inputs["Vector"])
    links.new(mapping.outputs["Vector"], separate.inputs["Vector"])
    links.new(mapping.outputs["Vector"], noise.inputs["Vector"])
    links.new(separate.outputs["Z"], lower.inputs["Value"])
    links.new(noise.outputs["Fac"], mix.inputs[0])
    links.new(lower.outputs["Result"], mix.inputs[1])

    _connect_bump(
        mat,
        mix.outputs[0],
        strength=float(channels["microStrength"]),
        distance=0.018,
    )

    return {
        "directionalWeathering": True,
        "microScale": float(channels["microScale"]),
        "verticalStreakBias": float(channels["verticalStreakBias"]),
        "lowerWallDirtBias": float(channels["lowerWallDirtBias"]),
    }


def _directional_roof_graph(mat, channels: dict):
    nodes = mat.node_tree.nodes
    links = mat.node_tree.links

    tex = _tag(nodes.new("ShaderNodeTexCoord"), "ROOF_TEXCOORD")
    mapping = _tag(nodes.new("ShaderNodeMapping"), "ROOF_MAPPING")
    separate = _tag(nodes.new("ShaderNodeSeparateXYZ"), "ROOF_SEPARATE")
    macro = _tag(nodes.new("ShaderNodeTexNoise"), "ROOF_MACRO")
    runoff = _tag(nodes.new("ShaderNodeTexNoise"), "ROOF_RUNOFF")
    combine = _tag(nodes.new("ShaderNodeMath"), "ROOF_COMBINE")
    combine.operation = "MULTIPLY"

    macro_scale = float(channels["macroVariationScale"])
    runoff_bias = float(channels["runoffBias"])
    mapping.inputs["Scale"].default_value = (
        macro_scale,
        max(0.5, macro_scale * (0.22 + 0.45 * (1.0 - runoff_bias))),
        macro_scale,
    )
    macro.inputs["Scale"].default_value = 1.0
    macro.inputs["Detail"].default_value = 5.0
    runoff.inputs["Scale"].default_value = float(channels["stainClusterScale"])
    runoff.inputs["Detail"].default_value = 3.0
    runoff.inputs["Roughness"].default_value = 0.68

    links.new(tex.outputs["Generated"], mapping.inputs["Vector"])
    links.new(mapping.outputs["Vector"], separate.inputs["Vector"])
    links.new(mapping.outputs["Vector"], macro.inputs["Vector"])
    links.new(mapping.outputs["Vector"], runoff.inputs["Vector"])
    links.new(macro.outputs["Fac"], combine.inputs[0])
    links.new(runoff.outputs["Fac"], combine.inputs[1])

    _connect_bump(
        mat,
        combine.outputs[0],
        strength=0.16 + 0.24 * float(channels["edgeWearBias"]),
        distance=0.012,
    )

    return {
        "directionalWeathering": True,
        "macroVariationScale": macro_scale,
        "runoffBias": runoff_bias,
        "stainClusterScale": float(channels["stainClusterScale"]),
    }


def _metal_graph(mat, channels: dict):
    nodes = mat.node_tree.nodes
    links = mat.node_tree.links

    tex = _tag(nodes.new("ShaderNodeTexCoord"), "METAL_TEXCOORD")
    noise = _tag(nodes.new("ShaderNodeTexNoise"), "METAL_RUST_CLUSTER")
    noise.inputs["Scale"].default_value = float(channels["rustClusterScale"])
    noise.inputs["Detail"].default_value = 5.0
    noise.inputs["Roughness"].default_value = 0.76
    links.new(tex.outputs["Generated"], noise.inputs["Vector"])

    _connect_bump(
        mat,
        noise.outputs["Fac"],
        strength=0.08 + 0.28 * float(channels["rustEdgeBias"]),
        distance=0.006,
    )

    return {
        "rustClustering": True,
        "rustClusterScale": float(channels["rustClusterScale"]),
        "rustEdgeBias": float(channels["rustEdgeBias"]),
        "runoffBias": float(channels["runoffBias"]),
    }


def _glass_graph(mat, channels: dict):
    nodes = mat.node_tree.nodes
    links = mat.node_tree.links

    tex = _tag(nodes.new("ShaderNodeTexCoord"), "GLASS_TEXCOORD")
    haze = _tag(nodes.new("ShaderNodeTexNoise"), "GLASS_HAZE")
    streak = _tag(nodes.new("ShaderNodeTexNoise"), "GLASS_STREAKS")
    mapping = _tag(nodes.new("ShaderNodeMapping"), "GLASS_STREAK_MAPPING")
    combine = _tag(nodes.new("ShaderNodeMath"), "GLASS_COMBINE")
    combine.operation = "MULTIPLY"

    haze.inputs["Scale"].default_value = float(channels["hazeScale"])
    haze.inputs["Detail"].default_value = 4.0

    s = float(channels["streakScale"])
    mapping.inputs["Scale"].default_value = (s, s, max(0.8, s * 0.15))
    streak.inputs["Scale"].default_value = 1.0
    streak.inputs["Detail"].default_value = 3.0

    links.new(tex.outputs["Generated"], haze.inputs["Vector"])
    links.new(tex.outputs["Generated"], mapping.inputs["Vector"])
    links.new(mapping.outputs["Vector"], streak.inputs["Vector"])
    links.new(haze.outputs["Fac"], combine.inputs[0])
    links.new(streak.outputs["Fac"], combine.inputs[1])

    _connect_bump(
        mat,
        combine.outputs[0],
        strength=0.02 + 0.10 * float(channels["streakStrength"]),
        distance=0.002,
    )

    return {
        "layeredHaze": True,
        "hazeScale": float(channels["hazeScale"]),
        "hazeStrength": float(channels["hazeStrength"]),
        "streakScale": s,
        "streakStrength": float(channels["streakStrength"]),
    }


def _trim_graph(mat, channels: dict):
    nodes = mat.node_tree.nodes
    links = mat.node_tree.links

    tex = _tag(nodes.new("ShaderNodeTexCoord"), "TRIM_TEXCOORD")
    mapping = _tag(nodes.new("ShaderNodeMapping"), "TRIM_GRAIN_MAPPING")
    grain = _tag(nodes.new("ShaderNodeTexNoise"), "TRIM_GRAIN")

    scale = float(channels["grainScale"])
    mapping.inputs["Scale"].default_value = (scale, max(0.5, scale * 0.16), max(0.5, scale * 0.16))
    grain.inputs["Scale"].default_value = 1.0
    grain.inputs["Detail"].default_value = 4.0
    grain.inputs["Roughness"].default_value = 0.62

    links.new(tex.outputs["Generated"], mapping.inputs["Vector"])
    links.new(mapping.outputs["Vector"], grain.inputs["Vector"])

    _connect_bump(
        mat,
        grain.outputs["Fac"],
        strength=0.04 + 0.18 * float(channels["wearEdgeBias"]),
        distance=0.004,
    )

    return {
        "grainWear": True,
        "grainScale": scale,
        "wearEdgeBias": float(channels["wearEdgeBias"]),
    }


def apply_house_surface_fidelity(
    bpy,
    geometry: dict,
    detail: dict,
    surface: dict,
    fidelity: dict,
    core_objects: dict,
    detail_objects: dict,
) -> dict:
    validation = validate_house_a_surface_fidelity(geometry, detail, surface, fidelity)
    if validation.status != "PASS":
        raise RuntimeError(f"surface fidelity manifest refused: {validation.reasons}")

    walls_mat = _material(core_objects["walls"])
    roof_mat = _material(detail_objects["roofDetail"])
    metal_mats = {
        _material(detail_objects["gutter"]),
        _material(detail_objects["downpipe"]),
    }
    glass_mats = {_material(obj) for obj in detail_objects["windows"]}
    trim_mats = {
        _material(core_objects["door"]),
        *(_material(obj) for obj in detail_objects["fascia"]),
        *([_material(detail_objects["porch"])] if detail_objects["porch"] is not None else []),
    }

    for mat in {walls_mat, roof_mat, *metal_mats, *glass_mats, *trim_mats}:
        _remove_prior_fidelity_nodes(mat)

    channels = fidelity["channels"]
    roles = {
        "walls": _directional_wall_graph(walls_mat, channels["walls"]),
        "roof": _directional_roof_graph(roof_mat, channels["roof"]),
        "metal": None,
        "glass": None,
        "trim": None,
    }

    metal_role = None
    for mat in metal_mats:
        role = _metal_graph(mat, channels["metal"])
        metal_role = role if metal_role is None else metal_role
    roles["metal"] = metal_role

    glass_role = None
    for mat in glass_mats:
        role = _glass_graph(mat, channels["glass"])
        glass_role = role if glass_role is None else glass_role
    roles["glass"] = glass_role

    trim_role = None
    for mat in trim_mats:
        role = _trim_graph(mat, channels["trim"])
        trim_role = role if trim_role is None else trim_role
    roles["trim"] = trim_role

    for mat in {walls_mat, roof_mat, *metal_mats, *glass_mats, *trim_mats}:
        mat["hdIsoFidelitySchema"] = fidelity["schemaVersion"]
        mat["hdIsoFidelitySeed"] = int(fidelity["fidelitySeed"])

    return {
        "status": "PASS",
        "schemaVersion": fidelity["schemaVersion"],
        "fidelitySeed": int(fidelity["fidelitySeed"]),
        "sourceGeometrySha256": fidelity["sourceGeometrySha256"],
        "sourceDetailSha256": fidelity["sourceDetailSha256"],
        "sourceSurfaceSha256": fidelity["sourceSurfaceSha256"],
        "roles": roles,
    }
