from __future__ import annotations

import sys
from pathlib import Path

import bpy

ROOT = Path(__file__).resolve().parents[2]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from tools.hd_iso.compile_geometry import compile_template, manifest_dict  # noqa: E402
from tools.hd_iso.compile_detail import compile_house_a_detail  # noqa: E402
from tools.hd_iso.blender.build_mesh import build_house_objects  # noqa: E402
from tools.hd_iso.blender.build_detail import build_house_detail_objects  # noqa: E402


def assert_close(a: float, b: float, tol: float = 1e-6) -> None:
    assert abs(a - b) <= tol, f"{a} != {b}"


def world_bounds(obj):
    coords = [obj.matrix_world @ v.co for v in obj.data.vertices]
    xs = [v.x for v in coords]
    ys = [v.y for v in coords]
    zs = [v.z for v in coords]
    return min(xs), max(xs), min(ys), max(ys), min(zs), max(zs)


def main() -> None:
    bpy.ops.wm.read_factory_settings(use_empty=True)

    geometry_obj = compile_template("house.master.a", structural_seed=18427, root=ROOT)
    geometry = manifest_dict(geometry_obj)
    detail = compile_house_a_detail(geometry, detail_seed=4104)

    core = build_house_objects(bpy, geometry)
    detail_objects = build_house_detail_objects(bpy, geometry, detail)

    # Core law remains untouched.
    assert_close(core["foundation"].dimensions.x, 7.5)
    assert_close(core["foundation"].dimensions.y, 6.0)
    assert_close(core["anchor"].location.x, 3.75)
    assert_close(core["anchor"].location.y, 6.0)
    assert_close(core["anchor"].location.z, 0.0)

    # Windows become explicit geometry and exactly mirror socket dimensions.
    windows = detail_objects["windows"]
    assert len(windows) == len(geometry["house"]["windows"])
    for obj, socket in zip(windows, geometry["house"]["windows"]):
        assert_close(obj.dimensions.x, float(socket["widthM"]))
        assert_close(obj.dimensions.z, float(socket["heightM"]))
        assert obj["facade"] == socket["facade"]
        assert_close(obj["sillHeightM"], float(socket["sillHeightM"]))
        assert_close(obj["lateralPosition"], float(socket["lateralPosition"]))

    # Real eave extension must exceed the immutable core width/depth by the
    # manifest-owned overhang, without changing the foundation itself.
    roof_detail = detail_objects["roofDetail"]
    x0, x1, y0, y1, _, z1 = world_bounds(roof_detail)
    eave = float(geometry["house"]["eaveOverhangM"])
    assert_close(x0, -eave)
    assert_close(x1, float(geometry["house"]["widthM"]) + eave)
    assert_close(y0, -eave)
    assert_close(y1, float(geometry["house"]["depthM"]) + eave)
    assert z1 <= float(geometry["house"]["maxHeightM"]) + 1e-6

    # Deterministic architectural dressing is present.
    assert len(detail_objects["fascia"]) == 2
    assert detail_objects["gutter"]["facade"] == "FRONT"
    assert detail_objects["downpipe"]["facade"] == "FRONT"
    assert detail_objects["downpipe"]["side"] == detail["downpipe"]["side"]
    assert detail_objects["porch"]["style"] == detail["porch"]["style"]

    # Porch remains inside its governed attachment allowance.
    porch = detail_objects["porch"]
    px0, px1, py0, py1, pz0, pz1 = world_bounds(porch)
    allowed = next(a["boundsM"] for a in geometry["house"]["attachments"] if a["name"] == "porch")
    assert (px1 - px0) <= float(allowed[0]) + 1e-6
    assert (py1 - py0) <= float(allowed[1]) + 1e-6
    assert (pz1 - pz0) <= float(allowed[2]) + 1e-6

    # Detail may extend laterally/forward via eaves/attachments, but never above
    # the accepted structural max envelope.
    mesh_objects = [
        obj
        for value in detail_objects.values()
        for obj in (value if isinstance(value, list) else [value])
        if getattr(obj, "type", None) == "MESH"
    ]
    max_z = max(world_bounds(obj)[5] for obj in mesh_objects)
    assert max_z <= float(geometry["house"]["maxHeightM"]) + 1e-6

    print("PASS: House A Blender architectural detail obeys frozen geometry law")


if __name__ == "__main__":
    main()
