from __future__ import annotations


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


def build_house_objects(bpy, manifest: dict) -> dict[str, object]:
    """Build House A mechanically from a validated geometry manifest.

    This adapter has no structural RNG and does not choose dimensions. Every
    authoritative value is read from ``manifest['house']``.
    """
    if manifest.get("templateId") != "house.master.a":
        raise ValueError(f"unsupported template: {manifest.get('templateId')}")

    h = manifest["house"]
    width = float(h["widthM"])
    depth = float(h["depthM"])
    wall_h = float(h["wallHeightM"])
    roof_rise = float(h["roofRiseM"])
    max_h = float(h["maxHeightM"])

    if wall_h + roof_rise > max_h + 1e-9:
        raise ValueError("manifest structural envelope exceeds maxHeightM")

    # Thin slab, included in footprint proof but kept below wall geometry so the
    # structural top remains dictated by wallHeightM + roofRiseM.
    foundation = _box(bpy, "HouseA.Foundation", 0.0, width, 0.0, depth, 0.0, 0.10)

    walls = _box(bpy, "HouseA.Walls", 0.0, width, 0.0, depth, 0.0, wall_h)
    walls["wallHeightM"] = wall_h

    # True gable prism, ridge axis X as declared by the v1 House A template.
    ridge_axis = h["ridgeAxis"]
    if ridge_axis != "X":
        raise ValueError(f"unsupported ridge axis for House A v1: {ridge_axis}")
    ridge_y = depth / 2.0
    peak_z = wall_h + roof_rise
    roof_vertices = [
        (0.0, 0.0, wall_h),
        (width, 0.0, wall_h),
        (0.0, depth, wall_h),
        (width, depth, wall_h),
        (0.0, ridge_y, peak_z),
        (width, ridge_y, peak_z),
    ]
    roof_faces = [
        (0, 1, 5, 4),
        (4, 5, 3, 2),
        (0, 4, 2),
        (1, 3, 5),
    ]
    roof = _mesh_object(bpy, "HouseA.Roof", roof_vertices, roof_faces)
    roof["roofPitchDegrees"] = float(h["roofPitchDegrees"])
    roof["roofRiseM"] = roof_rise

    # FRONT is y=max. Door is a diagnostic/authoring object placed directly on
    # that facade. Its dimensions and lateral position are manifest-owned.
    door_cfg = h["door"]
    if door_cfg["facade"] != "FRONT":
        raise ValueError("House A v1 requires FRONT door")
    door_w = float(door_cfg["widthM"])
    door_h = float(door_cfg["heightM"])
    lateral = float(door_cfg["lateralPosition"])
    door_cx = width * lateral
    door_depth = 0.04
    door = _box(
        bpy,
        "HouseA.Door",
        door_cx - door_w / 2.0,
        door_cx + door_w / 2.0,
        depth - door_depth / 2.0,
        depth + door_depth / 2.0,
        0.0,
        door_h,
    )

    anchor_cfg = h["anchor"]
    anchor = bpy.data.objects.new("HouseA.Anchor", None)
    anchor.empty_display_type = "PLAIN_AXES"
    anchor.location = (width * float(anchor_cfg[0]), depth * float(anchor_cfg[1]), 0.0)
    bpy.context.scene.collection.objects.link(anchor)

    return {
        "foundation": foundation,
        "walls": walls,
        "roof": roof,
        "door": door,
        "anchor": anchor,
    }
