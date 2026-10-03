from __future__ import annotations

import sys
from pathlib import Path

import bpy

ROOT = Path(__file__).resolve().parents[2]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from tools.hd_iso.compile_geometry import compile_template, manifest_dict  # noqa: E402
from tools.hd_iso.blender.build_mesh import build_house_objects  # noqa: E402
from tools.hd_iso.blender.build_scene import build_house_scene  # noqa: E402


def assert_close(a: float, b: float, tol: float = 1e-6) -> None:
    assert abs(a - b) <= tol, f"{a} != {b}"


def world_z_bounds(obj) -> tuple[float, float]:
    zs = [(obj.matrix_world @ v.co).z for v in obj.data.vertices]
    return min(zs), max(zs)


def main() -> None:
    bpy.ops.wm.read_factory_settings(use_empty=True)

    manifest = compile_template("house.master.a", structural_seed=18427, root=ROOT)
    manifest_json = manifest_dict(manifest)
    house = manifest_json["house"]

    objects = build_house_objects(bpy, manifest_json)

    assert set(("foundation", "walls", "roof", "door", "anchor")).issubset(objects)

    foundation = objects["foundation"]
    assert_close(foundation.dimensions.x, 7.5)
    assert_close(foundation.dimensions.y, 6.0)

    door = objects["door"]
    door_min_z, door_max_z = world_z_bounds(door)
    assert_close(door_max_z - door_min_z, 2.0)
    assert_close(door.dimensions.x, 0.9)

    # Anchor is authoritative metadata derived from [0.5, 1.0].
    anchor = objects["anchor"]
    assert_close(anchor.location.x, 3.75)
    assert_close(anchor.location.y, 6.0)
    assert_close(anchor.location.z, 0.0)

    # The adapter may construct multiple structural objects, but none may exceed
    # the compiler's declared structural envelope.
    structural = [objects["foundation"], objects["walls"], objects["roof"]]
    max_z = max(world_z_bounds(obj)[1] for obj in structural)
    assert max_z <= float(house["maxHeightM"]) + 1e-6, (max_z, house["maxHeightM"])

    assert_close(objects["walls"]["wallHeightM"], float(house["wallHeightM"]))
    assert_close(objects["roof"]["roofPitchDegrees"], float(house["roofPitchDegrees"]))
    assert_close(objects["roof"]["roofRiseM"], float(house["roofRiseM"]))

    # Task 7 also requires the thin scene wrapper used by later render passes.
    bpy.ops.wm.read_factory_settings(use_empty=True)
    scene_result = build_house_scene(bpy, manifest_json)
    assert scene_result["cameraProof"].status == "PASS", scene_result["cameraProof"].reasons
    assert bpy.context.scene.camera is not None
    assert set(("foundation", "walls", "roof", "door", "anchor")).issubset(scene_result["objects"])
    assert_close(scene_result["objects"]["foundation"].dimensions.x, 7.5)
    assert_close(scene_result["objects"]["foundation"].dimensions.y, 6.0)

    print("PASS: House A Blender mesh and canonical scene obey deterministic manifest geometry")


if __name__ == "__main__":
    main()
