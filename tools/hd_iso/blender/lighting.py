from __future__ import annotations

from mathutils import Vector


PROFILE = "house-a-s3-overcast-readable-v1"

WORLD_COLOR = (0.42, 0.47, 0.55, 1.0)
WORLD_STRENGTH = 0.42
EXPOSURE = 0.55

KEY_ENERGY = 1.65
FRONT_FILL_ENERGY = 850.0
SIDE_FILL_ENERGY = 650.0
FILL_SIZE_M = 5.0


def _aim_at(obj, target) -> None:
    direction = Vector(target) - obj.location
    obj.rotation_euler = direction.to_track_quat("-Z", "Y").to_euler()


def _ensure_area_light(
    bpy,
    scene,
    *,
    name: str,
    location,
    target,
    energy: float,
    size: float,
):
    obj = bpy.data.objects.get(name)
    if obj is None:
        data = bpy.data.lights.new(name, type="AREA")
        obj = bpy.data.objects.new(name, data)
        scene.collection.objects.link(obj)
    else:
        data = obj.data

    data.type = "AREA"
    data.energy = float(energy)
    data.shape = "DISK"
    data.size = float(size)
    obj.location = tuple(float(v) for v in location)
    _aim_at(obj, target)
    return obj


def apply_house_a_visual_calibration(bpy, scene, manifest: dict) -> dict:
    if manifest.get("templateId") != "house.master.a":
        raise ValueError("unsupported template for House A visual calibration")

    h = manifest["house"]
    centre = (
        float(h["widthM"]) * 0.5,
        float(h["depthM"]) * 0.5,
        float(h["wallHeightM"]) * 0.55,
    )

    world = scene.world
    if world is None:
        world = bpy.data.worlds.new("HDISO_WORLD")
        scene.world = world

    world.use_nodes = True
    nodes = world.node_tree.nodes
    links = world.node_tree.links
    nodes.clear()
    output = nodes.new("ShaderNodeOutputWorld")
    background = nodes.new("ShaderNodeBackground")
    background.inputs["Color"].default_value = WORLD_COLOR
    background.inputs["Strength"].default_value = WORLD_STRENGTH
    links.new(background.outputs["Background"], output.inputs["Surface"])

    key = bpy.data.objects.get("HDISO_KEY_LIGHT")
    if key is None:
        key_data = bpy.data.lights.new("HDISO_KEY_LIGHT", type="SUN")
        key = bpy.data.objects.new("HDISO_KEY_LIGHT", key_data)
        scene.collection.objects.link(key)
        key.rotation_euler = (0.75, 0.0, -0.75)
    key.data.energy = KEY_ENERGY

    front = _ensure_area_light(
        bpy,
        scene,
        name="HDISO_FRONT_FILL",
        location=(centre[0], float(h["depthM"]) + 6.0, 5.5),
        target=centre,
        energy=FRONT_FILL_ENERGY,
        size=FILL_SIZE_M,
    )
    side = _ensure_area_light(
        bpy,
        scene,
        name="HDISO_SIDE_FILL",
        location=(float(h["widthM"]) + 6.0, centre[1], 4.5),
        target=centre,
        energy=SIDE_FILL_ENERGY,
        size=FILL_SIZE_M,
    )

    scene.view_settings.exposure = EXPOSURE

    return {
        "status": "PASS",
        "profile": PROFILE,
        "world": {
            "color": list(WORLD_COLOR),
            "strength": WORLD_STRENGTH,
        },
        "exposure": EXPOSURE,
        "lights": {
            "key": {
                "name": key.name,
                "type": key.data.type,
                "energy": float(key.data.energy),
            },
            "frontFill": {
                "name": front.name,
                "type": front.data.type,
                "energy": float(front.data.energy),
                "sizeM": float(front.data.size),
            },
            "sideFill": {
                "name": side.name,
                "type": side.data.type,
                "energy": float(side.data.energy),
                "sizeM": float(side.data.size),
            },
        },
    }
