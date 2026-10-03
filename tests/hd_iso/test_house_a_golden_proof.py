from __future__ import annotations

import copy
import json
import sys
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from tools.hd_iso.compile_geometry import compile_template, manifest_dict  # noqa: E402
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


def main() -> None:
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


if __name__ == "__main__":
    main()
