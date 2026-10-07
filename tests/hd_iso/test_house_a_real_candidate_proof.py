from __future__ import annotations

import json
from pathlib import Path

from tools.hd_iso.generative.candidate_proof import prove_candidate, write_rgba_png
from tools.hd_iso.generative.validation import EXPECTED_CAMERA_HASH


def _solid(width: int, height: int, rgba):
    return [[tuple(rgba) for _ in range(width)] for _ in range(height)]


def _mask_image(width: int, height: int, x0: int, y0: int, x1: int, y1: int):
    image = _solid(width, height, (0, 0, 0, 0))
    for y in range(y0, y1):
        for x in range(x0, x1):
            image[y][x] = (255, 255, 255, 255)
    return image


def _fixture(tmp_path: Path):
    fixture = tmp_path / "fixture"
    masks = fixture / "masks"
    masks.mkdir(parents=True)

    candidate = fixture / "candidate.png"
    write_rgba_png(candidate, _solid(600, 600, (120, 90, 70, 255)))

    regions = {
        "silhouette": (80, 80, 430, 430),
        "walls": (110, 190, 400, 420),
        "roof": (90, 90, 420, 210),
        "door": (220, 250, 280, 420),
        "windows": (130, 230, 210, 320),
        "porch": (180, 330, 340, 430),
        "fascia": (95, 180, 415, 205),
        "gutter": (100, 200, 410, 218),
        "downpipe": (380, 210, 400, 410),
    }

    manifest_regions = {}
    for name, (x0, y0, x1, y1) in regions.items():
        filename = f"{name}.png"
        write_rgba_png(masks / filename, _mask_image(512, 512, x0, y0, x1, y1))
        manifest_regions[name] = {
            "file": filename,
            "pixelCount": (x1 - x0) * (y1 - y0),
        }

    manifest = {
        "schemaVersion": "hd-iso-structural-mask-bundle-v1",
        "templateId": "house.master.a",
        "width": 512,
        "height": 512,
        "cameraHash": EXPECTED_CAMERA_HASH,
        "projectionAdapter": "mirror_x",
        "regions": manifest_regions,
    }
    manifest_path = masks / "manifest.json"
    manifest_path.write_text(json.dumps(manifest))

    import hashlib

    calibration = {
        "schemaVersion": "hd-iso-donor-footprint-calibration-v2",
        "variantId": "house.a.02",
        "source": {
            "file": candidate.name,
            "width": 600,
            "height": 600,
            "sha256": hashlib.sha256(candidate.read_bytes()).hexdigest(),
        },
        "contacts": {
            "rearLeft": {"x": 120, "y": 180, "worldCorner": "x0_yDepth"},
            "frontLeft": {"x": 160, "y": 430, "worldCorner": "xWidth_yDepth"},
            "frontRight": {"x": 430, "y": 500, "worldCorner": "xWidth_y0"},
        },
    }
    calibration_path = fixture / "calibration.json"
    calibration_path.write_text(json.dumps(calibration))

    return candidate, manifest_path, calibration_path



def _variant_contract(tmp_path: Path) -> Path:
    path = tmp_path / "variant-contract.json"
    path.write_text(json.dumps({
        "variantId": "house.a.02",
        "footprintM": [6.0, 6.0],
    }))
    return path


def test_real_candidate_proof_normalizes_and_emits_governed_sprite(tmp_path: Path):
    candidate, mask_manifest, calibration = _fixture(tmp_path)
    out = tmp_path / "proof"

    result = prove_candidate(
        candidate_path=candidate,
        mask_manifest_path=mask_manifest,
        variant_contract_path=_variant_contract(tmp_path),
        calibration_path=calibration,
        out_dir=out,
    )

    assert result["status"] == "PASS", result
    assert result["rawCandidate"]["status"] == "REFUSE"
    assert "canvas_size_mismatch" in result["rawCandidate"]["reasons"]

    assert result["normalizedCandidate"]["width"] == 512
    assert result["normalizedCandidate"]["height"] == 512

    governed = out / "governed-candidate.png"
    proof = out / "proof.json"

    assert governed.exists()
    assert proof.exists()

    payload = json.loads(proof.read_text())
    assert payload["status"] == "PASS"
    assert payload["canonicalAuthority"]["alpha"] == "silhouette"
    assert payload["canonicalAuthority"]["regions"] is True
    assert payload["governedCandidate"]["width"] == 512
    assert payload["governedCandidate"]["height"] == 512


def test_candidate_proof_refuses_missing_mask_bundle(tmp_path: Path):
    candidate, _mask_manifest, _calibration = _fixture(tmp_path)

    result = prove_candidate(
        candidate_path=candidate,
        mask_manifest_path=tmp_path / "missing.json",
        variant_contract_path=_variant_contract(tmp_path),
        out_dir=tmp_path / "proof",
    )

    assert result["status"] == "REFUSE"
    assert "mask_manifest_missing" in result["reasons"]


def test_candidate_proof_refuses_mask_contract_drift(tmp_path: Path):
    candidate, mask_manifest, calibration = _fixture(tmp_path)
    source_manifest = json.loads(mask_manifest.read_text())

    source_manifest["cameraHash"] = "sha256:" + ("0" * 64)
    bad_manifest = tmp_path / "manifest.json"
    bad_manifest.write_text(json.dumps(source_manifest))

    result = prove_candidate(
        candidate_path=candidate,
        mask_manifest_path=bad_manifest,
        variant_contract_path=_variant_contract(tmp_path),
        calibration_path=calibration,
        out_dir=tmp_path / "proof",
    )

    assert result["status"] == "REFUSE"
    assert "mask_camera_hash_mismatch" in result["reasons"]


def test_candidate_proof_refuses_missing_donor_calibration(tmp_path: Path):
    candidate, mask_manifest, _calibration = _fixture(tmp_path)

    result = prove_candidate(
        candidate_path=candidate,
        mask_manifest_path=mask_manifest,
        variant_contract_path=_variant_contract(tmp_path),
        out_dir=tmp_path / "proof",
    )

    assert result["status"] == "REFUSE"
    assert "donor_calibration_missing" in result["reasons"]


def test_candidate_proof_refuses_wrong_donor_sha256(tmp_path: Path):
    candidate, mask_manifest, calibration = _fixture(tmp_path)

    payload = json.loads(calibration.read_text())
    payload["source"]["sha256"] = "0" * 64
    calibration.write_text(json.dumps(payload))

    result = prove_candidate(
        candidate_path=candidate,
        mask_manifest_path=mask_manifest,
        variant_contract_path=_variant_contract(tmp_path),
        calibration_path=calibration,
        out_dir=tmp_path / "proof",
    )

    assert result["status"] == "REFUSE"
    assert "donor_calibration_sha256_mismatch" in result["reasons"]


def test_candidate_proof_refuses_degenerate_donor_contacts(tmp_path: Path):
    candidate, mask_manifest, calibration = _fixture(tmp_path)

    payload = json.loads(calibration.read_text())
    payload["contacts"] = {
        "rearLeft": {
            "x": 100, "y": 100,
            "worldCorner": "x0_yDepth",
        },
        "frontLeft": {
            "x": 200, "y": 200,
            "worldCorner": "xWidth_yDepth",
        },
        "frontRight": {
            "x": 300, "y": 300,
            "worldCorner": "xWidth_y0",
        },
    }
    calibration.write_text(json.dumps(payload))

    result = prove_candidate(
        candidate_path=candidate,
        mask_manifest_path=mask_manifest,
        variant_contract_path=_variant_contract(tmp_path),
        calibration_path=calibration,
        out_dir=tmp_path / "proof",
    )

    assert result["status"] == "REFUSE"
    assert "donor_calibration_contacts_degenerate" in result["reasons"]


def test_candidate_proof_target_contacts_follow_variant_footprint(tmp_path: Path):
    candidate, mask_manifest, calibration = _fixture(tmp_path)

    payload = json.loads(calibration.read_text())
    payload["contacts"] = {
        # Exact translated copy of the expected 8m x 5m canonical contacts.
        # This keeps this test focused on target authority rather than
        # projection incompatibility.
        "rearLeft": {
            "x": 276, "y": 196,
            "worldCorner": "x0_yDepth",
        },
        "frontLeft": {
            "x": 404, "y": 260,
            "worldCorner": "xWidth_yDepth",
        },
        "frontRight": {
            "x": 484, "y": 220,
            "worldCorner": "xWidth_y0",
        },
    }
    calibration.write_text(json.dumps(payload))

    contract = tmp_path / "asymmetric-variant-contract.json"
    contract.write_text(json.dumps({
        "variantId": "house.a.02",
        "footprintM": [8.0, 5.0],
    }))

    result = prove_candidate(
        candidate_path=candidate,
        mask_manifest_path=mask_manifest,
        calibration_path=calibration,
        variant_contract_path=contract,
        out_dir=tmp_path / "proof",
    )

    assert result["status"] == "PASS", result

    donor = result["normalizedCandidate"]["donorCalibration"]

    assert donor["footprintM"] == [8.0, 5.0]

    # Frozen project_ground:
    #   x = (world_x - world_y) * 16
    #   y = (world_x + world_y) * 8
    #
    # Logical origin = (256, 256), renderScale = 1.
    assert donor["worldCornerMapping"] == {
        "left": "xWidth_yDepth",
        "right": "xWidth_y0",
        "rear": "x0_yDepth",
    }

    assert donor["targetPoints"] == {
        "left": {"x": 304.0, "y": 360.0},
        "right": {"x": 384.0, "y": 320.0},
        "rear": {"x": 176.0, "y": 296.0},
    }


def test_similarity_compatibility_accepts_exact_similarity():
    from tools.hd_iso.generative.candidate_proof import (
        _similarity_compatibility,
    )

    source = {
        "left": {"x": 10.0, "y": 20.0},
        "right": {"x": 30.0, "y": 20.0},
        "rear": {"x": 10.0, "y": 40.0},
    }

    # Uniform 4x scale + translation. No shear or anisotropic scaling.
    target = {
        "left": {"x": 140.0, "y": 280.0},
        "right": {"x": 220.0, "y": 280.0},
        "rear": {"x": 140.0, "y": 360.0},
    }

    result = _similarity_compatibility(
        source,
        target,
        render_scale=4,
    )

    assert result["status"] == "PASS"
    assert result["rmsLogicalPx"] < 1e-9
    assert result["maxLogicalPx"] < 1e-9


def test_similarity_compatibility_refuses_house_a02_incompatible_donor():
    from tools.hd_iso.generative.candidate_proof import (
        _similarity_compatibility,
    )

    # Measured native donor contacts.
    source = {
        "left": {"x": 552.0, "y": 1090.0},
        "right": {"x": 1114.0, "y": 814.0},
        "rear": {"x": 116.0, "y": 842.0},
    }

    # Canonical A-02 targets derived from footprintM + project_ground()
    # at renderScale=4.
    target = {
        "left": {"x": 640.0, "y": 1216.0},
        "right": {"x": 1024.0, "y": 1408.0},
        "rear": {"x": 1024.0, "y": 1024.0},
    }

    result = _similarity_compatibility(
        source,
        target,
        render_scale=4,
    )

    assert result["status"] == "REFUSE"
    assert result["rmsLogicalPx"] > result["limits"]["rmsLogicalPx"]
    assert result["maxLogicalPx"] > result["limits"]["maxLogicalPx"]


def test_candidate_proof_refuses_missing_world_corner(tmp_path: Path):
    candidate, mask_manifest, calibration = _fixture(tmp_path)

    payload = json.loads(calibration.read_text())
    del payload["contacts"]["frontLeft"]["worldCorner"]
    calibration.write_text(json.dumps(payload))

    result = prove_candidate(
        candidate_path=candidate,
        mask_manifest_path=mask_manifest,
        calibration_path=calibration,
        variant_contract_path=_variant_contract(tmp_path),
        out_dir=tmp_path / "proof",
    )

    assert result["status"] == "REFUSE"
    assert "donor_calibration_contacts_invalid" in result["reasons"]


def test_candidate_proof_refuses_duplicate_world_corners(tmp_path: Path):
    candidate, mask_manifest, calibration = _fixture(tmp_path)

    payload = json.loads(calibration.read_text())
    payload["contacts"]["frontRight"]["worldCorner"] = \
        payload["contacts"]["frontLeft"]["worldCorner"]
    calibration.write_text(json.dumps(payload))

    result = prove_candidate(
        candidate_path=candidate,
        mask_manifest_path=mask_manifest,
        calibration_path=calibration,
        variant_contract_path=_variant_contract(tmp_path),
        out_dir=tmp_path / "proof",
    )

    assert result["status"] == "REFUSE"
    assert "donor_calibration_world_corners_duplicate" in result["reasons"]
