from __future__ import annotations

import argparse
import copy
import hashlib
import json
import sys
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from tools.hd_iso.compile_geometry import compile_template, manifest_dict  # noqa: E402
from tools.hd_iso.compile_detail import canonical_detail_json, detail_sha256  # noqa: E402
from tools.hd_iso.compile_surface import canonical_surface_json, surface_sha256  # noqa: E402
from tools.hd_iso.geometry.projection import project_ground  # noqa: E402
from tools.hd_iso.proof.verify_geometry import build_geometry_proof  # noqa: E402
from tools.hd_iso.proof.verify_projection import (  # noqa: E402
    EXPECTED_PROJECTION_ADAPTER,
    build_projection_proof,
    canonical_camera_matrix,
)
from tools.hd_iso.proof.calibration_card import write_proof_bundle  # noqa: E402

CAMERA_HASH = "sha256:test-camera-lock"
RENDER_W = 512
RENDER_H = 512


def canonical_scene_manifest(manifest: dict) -> dict:
    h = manifest["house"]
    anchor_world = [
        float(h["widthM"]) * float(h["anchor"][0]),
        float(h["depthM"]) * float(h["anchor"][1]),
        0.0,
    ]
    anchor_ground = project_ground(anchor_world[0], anchor_world[1])
    footprint = [
        project_ground(0.0, 0.0),
        project_ground(float(h["widthM"]), 0.0),
        project_ground(float(h["widthM"]), float(h["depthM"])),
        project_ground(0.0, float(h["depthM"])),
    ]
    return {
        "schemaVersion": "hd-iso-scene-manifest-v1",
        "templateId": manifest["templateId"],
        "structuralSeed": int(manifest["structuralSeed"]),
        "render": {"width": RENDER_W, "height": RENDER_H, "transparent": True},
        "cameraHash": CAMERA_HASH,
        "cameraMatrix": canonical_camera_matrix(),
        "projectionAdapter": EXPECTED_PROJECTION_ADAPTER,
        "anchor": {
            "worldM": anchor_world,
            "pixel": [256.0 + anchor_ground[0], 256.0 + anchor_ground[1]],
        },
        "footprintPixel": [[256.0 + x, 256.0 + y] for x, y in footprint],
    }


def aggregate(manifest: dict, scene_manifest: dict, out: Path) -> dict:
    geometry = build_geometry_proof(manifest)
    projection = build_projection_proof(manifest, scene_manifest)
    return write_proof_bundle(manifest, scene_manifest, geometry, projection, out)


def assert_refuses(manifest: dict, scene_manifest: dict, out: Path) -> None:
    result = aggregate(manifest, scene_manifest, out)
    assert result["status"] == "REFUSE", result
    proof = json.loads((out / "proof.json").read_text())
    assert proof["status"] == "REFUSE"
    assert proof["reasons"]


def _sha256(path: Path) -> str:
    return "sha256:" + hashlib.sha256(path.read_bytes()).hexdigest()


def _canonical_proof(proof: dict) -> dict:
    """Return only deterministic proof truth, excluding filesystem location."""
    return {
        "schemaVersion": proof["schemaVersion"],
        "status": proof["status"],
        "reasons": proof["reasons"],
        "templateId": proof["templateId"],
        "structuralSeed": proof["structuralSeed"],
        "checks": proof["checks"],
        "geometry": proof["geometry"],
        "projection": proof["projection"],
        "scene": proof["scene"],
    }


def compare_real_builds(first_root: Path, second_root: Path) -> dict:
    first_geometry = first_root / "geometry.json"
    second_geometry = second_root / "geometry.json"
    first_scene_path = first_root / "render" / "scene-manifest.json"
    second_scene_path = second_root / "render" / "scene-manifest.json"
    first_proof_path = first_root / "proof" / "proof.json"
    second_proof_path = second_root / "proof" / "proof.json"

    required = (
        first_geometry,
        second_geometry,
        first_scene_path,
        second_scene_path,
        first_proof_path,
        second_proof_path,
    )
    missing = [str(path) for path in required if not path.exists()]
    assert not missing, f"missing build evidence: {missing}"

    first_scene = json.loads(first_scene_path.read_text())
    second_scene = json.loads(second_scene_path.read_text())
    first_proof = json.loads(first_proof_path.read_text())
    second_proof = json.loads(second_proof_path.read_text())

    assert first_geometry.read_bytes() == second_geometry.read_bytes(), "canonical geometry JSON drift"
    geometry_sha = _sha256(first_geometry)
    assert geometry_sha == _sha256(second_geometry), "geometry SHA drift"

    assert first_scene["cameraHash"] == second_scene["cameraHash"], "camera hash drift"
    assert first_scene["projectionAdapter"] == second_scene["projectionAdapter"], "projection adapter drift"
    assert first_scene["render"]["width"] == second_scene["render"]["width"], "render width drift"
    assert first_scene["render"]["height"] == second_scene["render"]["height"], "render height drift"
    assert first_scene["anchor"]["worldM"] == second_scene["anchor"]["worldM"], "anchor world drift"
    assert first_scene["anchor"]["pixel"] == second_scene["anchor"]["pixel"], "anchor pixel drift"
    assert first_scene["footprintPixel"] == second_scene["footprintPixel"], "footprint projection drift"

    assert first_proof["status"] == "PASS", first_proof
    assert second_proof["status"] == "PASS", second_proof
    assert _canonical_proof(first_proof) == _canonical_proof(second_proof), "canonical proof manifest drift"

    return {
        "status": "PASS",
        "geometryArtifactSha256": geometry_artifact_sha,
        "geometryCanonicalSha256": geometry_canonical_sha,
        "cameraHash": first_scene["cameraHash"],
        "projectionAdapter": first_scene["projectionAdapter"],
        "anchorWorldM": first_scene["anchor"]["worldM"],
        "anchorPixel": first_scene["anchor"]["pixel"],
        "footprintPixel": first_scene["footprintPixel"],
        "render": {
            "width": first_scene["render"]["width"],
            "height": first_scene["render"]["height"],
        },
    }



def compare_real_detail_builds(first_root: Path, second_root: Path) -> dict:
    first_detail_path = first_root / "detail.json"
    second_detail_path = second_root / "detail.json"
    first_scene_path = first_root / "render" / "scene-manifest.json"
    second_scene_path = second_root / "render" / "scene-manifest.json"
    first_proof_path = first_root / "proof" / "proof.json"
    second_proof_path = second_root / "proof" / "proof.json"

    required = (
        first_detail_path,
        second_detail_path,
        first_scene_path,
        second_scene_path,
        first_proof_path,
        second_proof_path,
    )
    missing = [str(path) for path in required if not path.exists()]
    assert not missing, f"missing detail build evidence: {missing}"

    first_detail = json.loads(first_detail_path.read_text())
    second_detail = json.loads(second_detail_path.read_text())
    first_scene = json.loads(first_scene_path.read_text())
    second_scene = json.loads(second_scene_path.read_text())
    first_proof = json.loads(first_proof_path.read_text())
    second_proof = json.loads(second_proof_path.read_text())

    assert canonical_detail_json(first_detail) == canonical_detail_json(second_detail), "canonical detail drift"
    assert detail_sha256(first_detail) == detail_sha256(second_detail), "detail SHA drift"

    assert first_scene["detail"] == second_scene["detail"], "scene detail receipt drift"
    assert first_scene["cameraHash"] == second_scene["cameraHash"], "camera hash drift"
    assert first_scene["projectionAdapter"] == second_scene["projectionAdapter"], "projection adapter drift"
    assert first_scene["anchor"] == second_scene["anchor"], "anchor drift"
    assert first_scene["footprintPixel"] == second_scene["footprintPixel"], "footprint projection drift"

    assert first_proof["status"] == "PASS", first_proof
    assert second_proof["status"] == "PASS", second_proof
    assert _canonical_proof(first_proof) == _canonical_proof(second_proof), "canonical proof drift"

    return {
        "status": "PASS",
        "detailSha256": detail_sha256(first_detail),
        "detailSeed": first_detail["detailSeed"],
        "sourceGeometrySha256": first_detail["sourceGeometrySha256"],
        "sceneDetail": first_scene["detail"],
        "cameraHash": first_scene["cameraHash"],
        "projectionAdapter": first_scene["projectionAdapter"],
        "anchorPixel": first_scene["anchor"]["pixel"],
        "footprintPixel": first_scene["footprintPixel"],
    }


def compare_real_surface_builds(first_root: Path, second_root: Path) -> dict:
    first_surface_path = first_root / "surface.json"
    second_surface_path = second_root / "surface.json"
    first_scene_path = first_root / "render" / "scene-manifest.json"
    second_scene_path = second_root / "render" / "scene-manifest.json"
    first_proof_path = first_root / "proof" / "proof.json"
    second_proof_path = second_root / "proof" / "proof.json"

    required = (
        first_surface_path,
        second_surface_path,
        first_scene_path,
        second_scene_path,
        first_proof_path,
        second_proof_path,
    )
    missing = [str(path) for path in required if not path.exists()]
    assert not missing, f"missing surface build evidence: {missing}"

    first_surface = json.loads(first_surface_path.read_text())
    second_surface = json.loads(second_surface_path.read_text())
    first_scene = json.loads(first_scene_path.read_text())
    second_scene = json.loads(second_scene_path.read_text())
    first_proof = json.loads(first_proof_path.read_text())
    second_proof = json.loads(second_proof_path.read_text())

    assert canonical_surface_json(first_surface) == canonical_surface_json(second_surface), "canonical surface drift"
    assert surface_sha256(first_surface) == surface_sha256(second_surface), "surface SHA drift"

    assert first_scene["surface"] == second_scene["surface"], "scene surface receipt drift"
    assert first_scene["cameraHash"] == second_scene["cameraHash"], "camera hash drift"
    assert first_scene["projectionAdapter"] == second_scene["projectionAdapter"], "projection adapter drift"
    assert first_scene["anchor"] == second_scene["anchor"], "anchor drift"
    assert first_scene["footprintPixel"] == second_scene["footprintPixel"], "footprint projection drift"

    assert first_proof["status"] == "PASS", first_proof
    assert second_proof["status"] == "PASS", second_proof
    assert _canonical_proof(first_proof) == _canonical_proof(second_proof), "canonical proof drift"

    return {
        "status": "PASS",
        "surfaceSha256": surface_sha256(first_surface),
        "appearanceSeed": first_surface["appearanceSeed"],
        "decaySeed": first_surface["decaySeed"],
        "sourceGeometrySha256": first_surface["sourceGeometrySha256"],
        "sourceDetailSha256": first_surface["sourceDetailSha256"],
        "sceneSurface": first_scene["surface"],
        "cameraHash": first_scene["cameraHash"],
        "projectionAdapter": first_scene["projectionAdapter"],
        "anchorPixel": first_scene["anchor"]["pixel"],
        "footprintPixel": first_scene["footprintPixel"],
    }


def run_synthetic_proof() -> None:
    manifest = manifest_dict(compile_template("house.master.a", structural_seed=18427, root=ROOT))
    scene_manifest = canonical_scene_manifest(manifest)

    with tempfile.TemporaryDirectory(prefix="house-a-proof-") as tmp:
        out = Path(tmp) / "golden"
        result = aggregate(manifest, scene_manifest, out)
        assert result["status"] == "PASS", result
        assert (out / "proof.json").exists()
        assert (out / "calibration.png").exists()

        proof = json.loads((out / "proof.json").read_text())
        assert proof["status"] == "PASS", proof
        assert proof["checks"]["footprint"] == "PASS"
        assert proof["checks"]["height"] == "PASS"
        assert proof["checks"]["anchor"] == "PASS"
        assert proof["checks"]["doorScale"] == "PASS"
        assert proof["checks"]["camera"] == "PASS"
        assert proof["checks"]["projectionAdapter"] == "PASS"
        assert proof["checks"]["footprintPixels"] == "PASS"
        assert proof["checks"]["anchorPixel"] == "PASS"

        bad = copy.deepcopy(manifest)
        bad["house"]["widthM"] += 0.25
        assert_refuses(bad, scene_manifest, Path(tmp) / "tamper-footprint")

        bad = copy.deepcopy(manifest)
        bad["house"]["wallHeightM"] = float(bad["house"]["maxHeightM"]) + 0.5
        assert_refuses(bad, scene_manifest, Path(tmp) / "tamper-height")

        bad = copy.deepcopy(manifest)
        bad["house"]["door"]["heightM"] = 1.75
        assert_refuses(bad, scene_manifest, Path(tmp) / "tamper-door")

        bad_scene = copy.deepcopy(scene_manifest)
        bad_scene["anchor"]["worldM"][0] += 0.5
        assert_refuses(manifest, bad_scene, Path(tmp) / "tamper-anchor")

        bad_scene = copy.deepcopy(scene_manifest)
        bad_scene["cameraMatrix"][0][0] += 0.01
        assert_refuses(manifest, bad_scene, Path(tmp) / "tamper-camera")

        bad_scene = copy.deepcopy(scene_manifest)
        bad_scene["projectionAdapter"] = "none"
        assert_refuses(manifest, bad_scene, Path(tmp) / "tamper-adapter")

        bad_scene = copy.deepcopy(scene_manifest)
        bad_scene["render"]["width"] += 1
        assert_refuses(manifest, bad_scene, Path(tmp) / "tamper-render")

    print("PASS: House A golden proof bundle and tamper refusal")


def main(argv: list[str] | None = None) -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--compare-builds", nargs=2, type=Path, metavar=("FIRST", "SECOND"))
    parser.add_argument("--compare-detail-builds", nargs=2, type=Path, metavar=("FIRST", "SECOND"))
    parser.add_argument("--compare-surface-builds", nargs=2, type=Path, metavar=("FIRST", "SECOND"))
    args = parser.parse_args(argv)

    if args.compare_builds:
        result = compare_real_builds(*args.compare_builds)
        print(json.dumps(result, sort_keys=True))
        print("PASS: House A real-build determinism murder test")
        return

    if args.compare_detail_builds:
        result = compare_real_detail_builds(*args.compare_detail_builds)
        print(json.dumps(result, sort_keys=True))
        print("PASS: House A architectural-detail determinism murder test")
        return

    if args.compare_surface_builds:
        result = compare_real_surface_builds(*args.compare_surface_builds)
        print(json.dumps(result, sort_keys=True))
        print("PASS: House A surface determinism murder test")
        return

    run_synthetic_proof()


if __name__ == "__main__":
    main()
