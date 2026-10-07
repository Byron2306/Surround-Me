from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

from .build_mesh import build_house_objects
from .build_detail import build_house_detail_objects
from .build_surface import apply_house_surface
from .build_surface_fidelity import apply_house_surface_fidelity
from .camera import ensure_canonical_camera
from tools.hd_iso.detail.validation import validate_house_a_detail
from tools.hd_iso.render_config import DEFAULT_RENDER_SCALE
from .render_passes import render_authoritative_passes


def build_house_scene(
    bpy,
    manifest: dict,
    detail_manifest: dict | None = None,
    surface_manifest: dict | None = None,
    fidelity_manifest: dict | None = None,
) -> dict[str, object]:
    """Build the canonical House A Blender scene from validated manifest truth."""
    if "variantId" in manifest:
        from tools.hd_iso.variants import compile_variant
        from tools.hd_iso.compile_geometry import manifest_dict
        if manifest != manifest_dict(compile_variant(manifest["variantId"])[0]):
            raise RuntimeError("variant geometry differs from governed contract")
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
        detail_objects = build_house_detail_objects(bpy, manifest, detail_manifest)

    surface_receipt = None
    if surface_manifest is not None:
        if detail_manifest is None or detail_objects is None:
            raise RuntimeError("surface manifest requires validated architectural detail")
        surface_receipt = apply_house_surface(
            bpy, manifest, detail_manifest, surface_manifest, objects, detail_objects
        )

    fidelity_receipt = None
    if fidelity_manifest is not None:
        if surface_manifest is None or detail_manifest is None or detail_objects is None:
            raise RuntimeError("surface fidelity requires validated surface and detail manifests")
        fidelity_receipt = apply_house_surface_fidelity(
            bpy,
            manifest,
            detail_manifest,
            surface_manifest,
            fidelity_manifest,
            objects,
            detail_objects,
        )

    if manifest.get("variantId") == "house.a.02" and surface_manifest is not None:
        from .variant_finish import apply_variant_finish
        finish=apply_variant_finish(manifest,objects,detail_objects)
        scene["hdIsoVariantFinish"]=json.dumps(finish,sort_keys=True)

    return {
        "scene": scene,
        "cameraProof": camera_proof,
        "objects": objects,
        "detailObjects": detail_objects,
        "surfaceReceipt": surface_receipt,
        "fidelityReceipt": fidelity_receipt,
    }


def render_from_manifest(
    bpy,
    manifest_path: Path | str,
    out_dir: Path | str,
    detail_manifest_path: Path | str | None = None,
    surface_manifest_path: Path | str | None = None,
    fidelity_manifest_path: Path | str | None = None,
    render_scale: int = DEFAULT_RENDER_SCALE,
) -> dict:
    manifest = json.loads(Path(manifest_path).read_text())
    detail_manifest = None
    if detail_manifest_path is not None:
        detail_manifest = json.loads(Path(detail_manifest_path).read_text())
    surface_manifest = None
    if surface_manifest_path is not None:
        surface_manifest = json.loads(Path(surface_manifest_path).read_text())
    fidelity_manifest = None
    if fidelity_manifest_path is not None:
        fidelity_manifest = json.loads(Path(fidelity_manifest_path).read_text())
    bpy.ops.wm.read_factory_settings(use_empty=True)
    built = build_house_scene(
        bpy,
        manifest,
        detail_manifest,
        surface_manifest,
        fidelity_manifest,
    )
    return render_authoritative_passes(
        bpy,
        manifest,
        Path(out_dir),
        detail_manifest=detail_manifest,
        core_objects=built["objects"],
        detail_objects=built["detailObjects"],
        surface_manifest=surface_manifest,
        surface_receipt=built["surfaceReceipt"],
        fidelity_manifest=fidelity_manifest,
        fidelity_receipt=built["fidelityReceipt"],
        render_scale=render_scale,
    )


def cli_main(argv: list[str] | None = None) -> int:
    import bpy

    parser = argparse.ArgumentParser(prog="hd-iso-blender-render")
    parser.add_argument("--manifest", required=True, type=Path)
    parser.add_argument("--detail-manifest", type=Path)
    parser.add_argument("--surface-manifest", type=Path)
    parser.add_argument("--surface-fidelity-manifest", type=Path)
    parser.add_argument("--out", required=True, type=Path)
    parser.add_argument("--render-scale", type=int, default=DEFAULT_RENDER_SCALE)
    args = parser.parse_args(argv)

    try:
        result = render_from_manifest(
            bpy,
            args.manifest,
            args.out,
            args.detail_manifest,
            args.surface_manifest,
            args.surface_fidelity_manifest,
            args.render_scale,
        )
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
