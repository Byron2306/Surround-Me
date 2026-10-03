from __future__ import annotations

import argparse
import json
import os
import subprocess
from pathlib import Path

from .compile_geometry import compile_template, manifest_dict
from .geometry.validation import validate_house_a
from .proof.calibration_card import write_proof_bundle
from .proof.verify_geometry import build_geometry_proof
from .proof.verify_projection import build_projection_proof


def _repo_root() -> Path:
    return Path(__file__).resolve().parents[2]


def _template_data(root: Path) -> dict:
    return json.loads((root / "world-art/hd-iso-v1/templates/house-master-a.json").read_text())


def _default_geometry_out(root: Path, template_id: str) -> Path:
    return root / "build" / "hd-iso" / template_id / "geometry.json"


def _default_build_out(root: Path, template_id: str) -> Path:
    return root / "build" / "hd-iso" / template_id


def _write_manifest(path: Path, manifest) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(manifest_dict(manifest), indent=2, sort_keys=True) + "\n")


def _emit(payload: dict) -> int:
    print(json.dumps(payload, sort_keys=True))
    return 0 if payload.get("status") == "PASS" else 2


def _compile_and_validate(root: Path, template_id: str, seed: int, geometry_path: Path):
    try:
        manifest = compile_template(template_id, seed, root)
    except ValueError:
        return None, {"status": "REFUSE", "reasons": ["unknown_template"]}

    _write_manifest(geometry_path, manifest)
    validation = validate_house_a(manifest, _template_data(root))
    if validation.status != "PASS":
        return manifest, {
            "status": "REFUSE",
            "reasons": list(validation.reasons),
            "stage": "validate",
            "output": str(geometry_path),
        }
    return manifest, None


def _run_blender(root: Path, geometry_path: Path, render_dir: Path) -> dict:
    blender = os.environ.get("BLENDER_BIN", "blender")
    expr = (
        "import sys; "
        + f"sys.path.insert(0, {str(root)!r}); "
        + "from tools.hd_iso.blender.build_scene import cli_main; "
        + "raise SystemExit(cli_main(sys.argv[sys.argv.index('--')+1:]))"
    )
    cmd = [
        blender,
        "-b",
        "--factory-startup",
        "--python-expr",
        expr,
        "--",
        "--manifest",
        str(geometry_path),
        "--out",
        str(render_dir),
    ]
    try:
        proc = subprocess.run(cmd, cwd=root, text=True, capture_output=True)
    except OSError as exc:
        return {
            "status": "REFUSE",
            "stage": "render",
            "reasons": [f"blender_launch_failed:{type(exc).__name__}:{exc}"],
        }

    if proc.returncode != 0:
        tail = (proc.stderr or proc.stdout or "blender render failed").strip().splitlines()
        return {
            "status": "REFUSE",
            "stage": "render",
            "reasons": [tail[-1] if tail else "blender render failed"],
        }

    scene_path = render_dir / "scene-manifest.json"
    if not scene_path.exists():
        return {"status": "REFUSE", "stage": "render", "reasons": ["scene_manifest_missing"]}
    return {"status": "PASS", "stage": "render", "sceneManifest": str(scene_path)}


def _prove(geometry_path: Path, scene_path: Path, proof_dir: Path) -> dict:
    try:
        manifest = json.loads(geometry_path.read_text())
        scene_manifest = json.loads(scene_path.read_text())
    except (OSError, json.JSONDecodeError) as exc:
        return {"status": "REFUSE", "stage": "prove", "reasons": [f"proof_input_error:{type(exc).__name__}:{exc}"]}

    geometry = build_geometry_proof(manifest)
    projection = build_projection_proof(manifest, scene_manifest)
    result = write_proof_bundle(manifest, scene_manifest, geometry, projection, proof_dir)
    result["stage"] = "prove"
    return result


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(prog="hd-iso")
    parser.add_argument("command", choices=("compile", "validate", "render", "prove", "build"))
    parser.add_argument("template_id")
    parser.add_argument("--seed", type=int, default=0)
    parser.add_argument("--out", type=Path)
    args = parser.parse_args(argv)

    root = _repo_root()

    if args.command in ("compile", "validate"):
        out = args.out or _default_geometry_out(root, args.template_id)
        try:
            manifest = compile_template(args.template_id, args.seed, root)
        except ValueError:
            return _emit({"status": "REFUSE", "reasons": ["unknown_template"]})

        _write_manifest(out, manifest)
        if args.command == "compile":
            return _emit({"status": "PASS", "output": str(out)})

        result = validate_house_a(manifest, _template_data(root))
        return _emit({"status": result.status, "reasons": list(result.reasons), "output": str(out)})

    build_root = args.out or _default_build_out(root, args.template_id)
    geometry_path = build_root / "geometry.json"
    render_dir = build_root / "render"
    proof_dir = build_root / "proof"

    manifest, refused = _compile_and_validate(root, args.template_id, args.seed, geometry_path)
    if refused:
        return _emit(refused)

    if args.command in ("render", "build"):
        render_result = _run_blender(root, geometry_path, render_dir)
        if render_result["status"] != "PASS":
            return _emit(render_result)
        if args.command == "render":
            return _emit({
                "status": "PASS",
                "templateId": args.template_id,
                "structuralSeed": args.seed,
                "output": str(render_dir),
            })

    scene_path = render_dir / "scene-manifest.json"
    if args.command == "prove" and not scene_path.exists():
        return _emit({"status": "REFUSE", "stage": "prove", "reasons": ["scene_manifest_missing"]})

    proof_result = _prove(geometry_path, scene_path, proof_dir)
    if proof_result["status"] != "PASS":
        return _emit(proof_result)

    return _emit({
        "status": "PASS",
        "templateId": args.template_id,
        "structuralSeed": args.seed,
        "output": str(build_root),
        "geometry": str(geometry_path),
        "render": str(render_dir),
        "proof": str(proof_dir),
    })


if __name__ == "__main__":
    raise SystemExit(main())
