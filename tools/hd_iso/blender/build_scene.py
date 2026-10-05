from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

from .build_mesh import build_house_objects
from .build_detail import build_house_detail_objects\nfrom .build_surface import apply_house_surface\nfrom .camera import ensure_canonical_camera
from tools.hd_iso.detail.validation import validate_house_a_detail
from .render_passes import render_authoritative_passes


def build_house_scene(\n    bpy,\n    manifest: dict,\n    detail_manifest: dict | None = None,\n    surface_manifest: dict | None = None,\n) -> dict[str, object]:
    """Build the canonical House A Blender scene from validated manifest truth."""
    scene = bpy.context.scene
    camera_proof = ensure_canonical_camera(scene)
    if camera_proof.status != "PASS":
        raise RuntimeError(f"canonical camera refused: {camera_proof.reasons}")

    objects = build_house_objects(bpy, manifest)
    detail_objects = None
    if detail_manifest is not None:
        detail_validation = validate_house_a_detail(manifest, detail_manifest)
        if detail_validation.status != "PASS":
            raise RuntimeError(f"detail manifest refused: {detail_validation.reasons}")
        detail_objects = build_house_detail_objects(bpy, manifest, detail_manifest)\n\n    surface_receipt = None\n    if surface_manifest is not None:\n        if detail_manifest is None or detail_objects is None:\n            raise RuntimeError("surface manifest requires validated architectural detail")\n        surface_receipt = apply_house_surface(\n            bpy, manifest, detail_manifest, surface_manifest, objects, detail_objects\n        )\n\n    return {\n        "scene": scene,\n        "cameraProof": camera_proof,\n        "objects": objects,\n        "detailObjects": detail_objects,\n        "surfaceReceipt": surface_receipt,\n    }


def render_from_manifest(
    bpy,
    manifest_path: Path | str,
    out_dir: Path | str,
    detail_manifest_path: Path | str | None = None,\n    surface_manifest_path: Path | str | None = None,\n) -> dict:
    manifest = json.loads(Path(manifest_path).read_text())
    detail_manifest = None
    if detail_manifest_path is not None:\n        detail_manifest = json.loads(Path(detail_manifest_path).read_text())\n    surface_manifest = None\n    if surface_manifest_path is not None:\n        surface_manifest = json.loads(Path(surface_manifest_path).read_text())\n    bpy.ops.wm.read_factory_settings(use_empty=True)\n    built = build_house_scene(bpy, manifest, detail_manifest, surface_manifest)
    return render_authoritative_passes(
        bpy,
        manifest,
        Path(out_dir),
        detail_manifest=detail_manifest,\n        detail_objects=built["detailObjects"],\n        surface_manifest=surface_manifest,\n        surface_receipt=built["surfaceReceipt"],\n    )


def cli_main(argv: list[str] | None = None) -> int:
    import bpy

    parser = argparse.ArgumentParser(prog="hd-iso-blender-render")
    parser.add_argument("--manifest", required=True, type=Path)
    parser.add_argument("--detail-manifest", type=Path)\n    parser.add_argument("--surface-manifest", type=Path)\n    parser.add_argument("--out", required=True, type=Path)
    args = parser.parse_args(argv)

    try:
        result = render_from_manifest(\n            bpy, args.manifest, args.out, args.detail_manifest, args.surface_manifest\n        )
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
