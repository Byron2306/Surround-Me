from __future__ import annotations

import math


def _mesh_object(bpy, name: str, vertices, faces):
    mesh = bpy.data.meshes.new(f"{name}.mesh")
    mesh.from_pydata(vertices, [], faces)
    mesh.update()
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.scene.collection.objects.link(obj)
    return obj


def _box(bpy, name: str, x0: float, x1: float, y0: float, y1: float, z0: float, z1: float):
    verts = [
        (x0, y0, z0), (x1, y0, z0), (x1, y1, z0), (x0, y1, z0),
        (x0, y0, z1), (x1, y0, z1), (x1, y1, z1), (x0, y1, z1),
    ]
    faces = [
        (0, 1, 2, 3),
        (4, 7, 6, 5),
        (0, 4, 5, 1),
        (1, 5, 6, 2),
        (2, 6, 7, 3),
        (3, 7, 4, 0),
    ]
    return _mesh_object(bpy, name, verts, faces)


def _build_windows(bpy, house: dict, detail: dict) -> list[object]:
    width = float(house["widthM"])
    depth = float(house["depthM"])
    thickness = 0.045
    objects = []
    for index, socket in enumerate(detail["windows"], start=1):
        if socket["facade"] != "FRONT":
            raise ValueError("House A A1 windows must remain on FRONT facade")
        w = float(socket["widthM"])
        h = float(socket["heightM"])
        sill = float(socket["sillHeightM"])
        lateral = float(socket["lateralPosition"])
        cx = width * lateral
        obj = _box(
            bpy,
            f"HouseA.Detail.Window.{index}",
            cx - w / 2.0,
            cx + w / 2.0,
            depth - thickness / 2.0,
            depth + thickness / 2.0,
            sill,
            sill + h,
        )
        obj["facade"] = socket["facade"]
        obj["sillHeightM"] = sill
        obj["lateralPosition"] = lateral
        obj["socketName"] = socket["name"]
        objects.append(obj)
    return objects


def _build_extended_roof(bpy, house: dict, detail: dict):
    width = float(house["widthM"])
    depth = float(house["depthM"])
    wall_h = float(house["wallHeightM"])
    roof_rise = float(house["roofRiseM"])
    pitch = math.radians(float(house["roofPitchDegrees"]))
    eave = float(detail["eaves"]["overhangM"])

    if house["ridgeAxis"] != "X" or detail["eaves"]["ridgeAxis"] != "X":
        raise ValueError("House A A1 supports ridge axis X only")

    ridge_y = depth / 2.0
    peak_z = wall_h + roof_rise
    eave_z = wall_h - eave * math.tan(pitch)

    vertices = [
        (-eave, -eave, eave_z),
        (width + eave, -eave, eave_z),
        (-eave, depth + eave, eave_z),
        (width + eave, depth + eave, eave_z),
        (-eave, ridge_y, peak_z),
        (width + eave, ridge_y, peak_z),
    ]
    faces = [
        (0, 1, 5, 4),
        (4, 5, 3, 2),
        (0, 4, 2),
        (1, 3, 5),
    ]
    obj = _mesh_object(bpy, "HouseA.Detail.RoofExtended", vertices, faces)
    obj["eaveOverhangM"] = eave
    obj["roofPitchDegrees"] = float(house["roofPitchDegrees"])
    obj["sourceRidgeAxis"] = house["ridgeAxis"]
    return obj


def _build_fascia(bpy, house: dict, detail: dict) -> list[object]:
    width = float(house["widthM"])
    depth = float(house["depthM"])
    wall_h = float(house["wallHeightM"])
    pitch = math.radians(float(house["roofPitchDegrees"]))
    eave = float(detail["eaves"]["overhangM"])
    fascia = detail["fascia"]
    thickness = float(fascia["thicknessM"])
    depth_m = float(fascia["depthM"])
    eave_z = wall_h - eave * math.tan(pitch)

    result = []
    for label, y in (("Back", -eave), ("Front", depth + eave)):
        obj = _box(
            bpy,
            f"HouseA.Detail.Fascia.{label}",
            -eave,
            width + eave,
            y - thickness / 2.0,
            y + thickness / 2.0,
            eave_z - depth_m,
            eave_z,
        )
        obj["facade"] = "BACK" if label == "Back" else "FRONT"
        result.append(obj)
    return result


def _build_gutter(bpy, house: dict, detail: dict):
    width = float(house["widthM"])
    depth = float(house["depthM"])
    wall_h = float(house["wallHeightM"])
    pitch = math.radians(float(house["roofPitchDegrees"]))
    eave = float(house["eaveOverhangM"])
    radius = float(detail["gutter"]["radiusM"])
    eave_z = wall_h - eave * math.tan(pitch)

    obj = _box(
        bpy,
        "HouseA.Detail.Gutter.Front",
        -eave,
        width + eave,
        depth + eave - radius,
        depth + eave + radius,
        eave_z - (2.0 * radius),
        eave_z,
    )
    obj["facade"] = "FRONT"
    obj["lengthM"] = float(detail["gutter"]["lengthM"])
    obj["radiusM"] = radius
    return obj


def _build_downpipe(bpy, house: dict, detail: dict):
    width = float(house["widthM"])
    depth = float(house["depthM"])
    wall_h = float(house["wallHeightM"])
    pitch = math.radians(float(house["roofPitchDegrees"]))
    eave = float(house["eaveOverhangM"])
    diameter = float(detail["downpipe"]["diameterM"])
    eave_z = wall_h - eave * math.tan(pitch)
    side = detail["downpipe"]["side"]

    cx = 0.0 if side == "LEFT" else width
    cy = depth + eave
    obj = _box(
        bpy,
        "HouseA.Detail.Downpipe",
        cx - diameter / 2.0,
        cx + diameter / 2.0,
        cy - diameter / 2.0,
        cy + diameter / 2.0,
        0.0,
        eave_z,
    )
    obj["facade"] = "FRONT"
    obj["side"] = side
    obj["diameterM"] = diameter
    return obj


def _build_porch(bpy, house: dict, detail: dict):
    width = float(house["widthM"])
    depth = float(house["depthM"])
    bounds = [float(v) for v in detail["porch"]["boundsM"]]
    porch_w, porch_d, porch_h = bounds
    door = house["door"]
    cx = width * float(door["lateralPosition"])

    x0 = cx - porch_w / 2.0
    x1 = cx + porch_w / 2.0
    y0 = depth
    y1 = depth + porch_d
    z0 = 0.0
    z1 = porch_h

    # A1 porch is a bounded frame envelope. Internal members come later.
    obj = _box(bpy, "HouseA.Detail.PorchFrame", x0, x1, y0, y1, z0, z1)
    obj["facade"] = "FRONT"
    obj["style"] = detail["porch"]["style"]
    obj["boundsM"] = bounds
    return obj


def build_house_detail_objects(bpy, geometry: dict, detail: dict) -> dict[str, object]:
    if geometry.get("templateId") != "house.master.a":
        raise ValueError("unsupported geometry template for House A detail")
    if detail.get("templateId") != "house.master.a":
        raise ValueError("unsupported detail template for House A detail")
    if detail.get("schemaVersion") != "hd-iso-detail-v1":
        raise ValueError("unsupported House A detail schema")

    house = geometry["house"]
    roof_detail = _build_extended_roof(bpy, house, detail)
    windows = _build_windows(bpy, house, detail)
    fascia = _build_fascia(bpy, house, detail)
    gutter = _build_gutter(bpy, house, detail)
    downpipe = _build_downpipe(bpy, house, detail)
    porch = _build_porch(bpy, house, detail)

    return {
        "windows": windows,
        "roofDetail": roof_detail,
        "fascia": fascia,
        "gutter": gutter,
        "downpipe": downpipe,
        "porch": porch,
    }
