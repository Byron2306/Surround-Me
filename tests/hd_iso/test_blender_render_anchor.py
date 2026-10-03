from __future__ import annotations

import json
import sys
import tempfile
from pathlib import Path

import bpy

ROOT = Path(__file__).resolve().parents[2]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from tools.hd_iso.compile_geometry import compile_template, manifest_dict  # noqa: E402
from tools.hd_iso.blender.build_scene import build_house_scene  # noqa: E402
from tools.hd_iso.blender.render_passes import (  # noqa: E402
    CANONICAL_RENDER_HEIGHT,
    CANONICAL_RENDER_WIDTH,
    render_authoritative_passes,
    verify_render_contract,
)


def main() -> None:
    bpy.ops.wm.read_factory_settings(use_empty=True)
    manifest = manifest_dict(compile_template("house.master.a", structural_seed=18427, root=ROOT))
    build_house_scene(bpy, manifest)

    with tempfile.TemporaryDirectory(prefix="house-a-render-") as tmp:
        out = Path(tmp)
        result = render_authoritative_passes(bpy, manifest, out)

        assert result["status"] == "PASS", result
        assert bpy.context.scene.render.film_transparent is True
        assert bpy.context.scene.render.resolution_x == CANONICAL_RENDER_WIDTH
        assert bpy.context.scene.render.resolution_y == CANONICAL_RENDER_HEIGHT
        assert bpy.context.scene.render.resolution_percentage == 100

        required = {
            "beauty.png",
            "silhouette.png",
            "object-id.png",
            "depth.exr",
            "normals.exr",
            "scene-manifest.json",
        }
        assert required.issubset({p.name for p in out.iterdir()})

        scene_manifest = json.loads((out / "scene-manifest.json").read_text())
        assert scene_manifest["templateId"] == "house.master.a"
        assert scene_manifest["structuralSeed"] == 18427
        assert scene_manifest["render"]["width"] == CANONICAL_RENDER_WIDTH
        assert scene_manifest["render"]["height"] == CANONICAL_RENDER_HEIGHT
        assert scene_manifest["anchor"]["worldM"] == [3.75, 6.0, 0.0]
        assert len(scene_manifest["anchor"]["pixel"]) == 2

        untouched = verify_render_contract(bpy.context.scene)
        assert untouched["status"] == "PASS", untouched

        # Fail closed on render-size drift and do not repair it.
        bpy.context.scene.render.resolution_x += 1
        drifted_width = bpy.context.scene.render.resolution_x
        refused = verify_render_contract(bpy.context.scene)
        assert refused["status"] == "REFUSE"
        assert refused["reasons"]
        assert bpy.context.scene.render.resolution_x == drifted_width

        # Fail closed on camera drift too.
        bpy.context.scene.render.resolution_x = CANONICAL_RENDER_WIDTH
        bpy.context.scene.camera.location.y += 0.125
        drifted_y = bpy.context.scene.camera.location.y
        refused_camera = verify_render_contract(bpy.context.scene)
        assert refused_camera["status"] == "REFUSE"
        assert refused_camera["reasons"]
        assert bpy.context.scene.camera.location.y == drifted_y

    print("PASS: authoritative Blender render passes and anchor metadata")


if __name__ == "__main__":
    main()
