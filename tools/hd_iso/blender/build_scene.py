from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

from .build_mesh import build_house_objects
from .camera import ensure_canonical_camera
from .render_passes import render_authoritative_passes


def build_house_scene(bpy, manifest: dict) -> dict[str, object]:
    """Build the canonical House A Blender scene from validated manifest truth."""
    scene = bpy.context.scene
    camera_proof = ensure_canonical_camera(scene)
    if camera_proof.status != "PASS":
        raise RuntimeError(f"canonical camera refused: {camera_proof.reasons}")

    objects = build_house_objects(bpy, manifest)
    return {
        "scene": scene,
        "cameraProof": camera_proof,
        "objects": objects,
    }


def render_from_manifest(bpy, manifest_path: Path | str, out_dir: Path | str) -> dict:
    manifest = json.loads(Path(manifest_path).read_text())
    bpy.ops.wm.read_factory_settings(use_empty=True)
    build_house_scene(bpy, manifest)
    return render_authoritative_passes(bpy, manifest, Path(out_dir))


def cli_main(argv: list[str] | None = None) -> int:
    import bpy

    parser = argparse.ArgumentParser(prog="hd-iso-blender-render")
    parser.add_argument("--manifest", required=True, type=Path)
    parser.add_argument("--out", required=True, type=Path)
    args = parser.parse_args(argv)

    try:
        result = render_from_manifest(bpy, args.manifest, args.out)
    except Exception as exc:
        print(json.dumps({"status": "REFUSE", "reasons": [f"render_exception:{type(exc).__name__}:{exc}"]}))
        return 2

    print(json.dumps(result, sort_keys=True))
    return 0 if result.get("status") == "PASS" else 2


def blender_argv() -> list[str]:
    if "--" not in sys.argv:
        return []
    return sys.argv[sys.argv.index("--") + 1 :]


if __name__ == "__main__":
    raise SystemExit(cli_main(blender_argv()))
