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
    return candidate, manifest_path


def test_real_candidate_proof_normalizes_and_emits_governed_sprite(tmp_path: Path):
    candidate, mask_manifest = _fixture(tmp_path)
    out = tmp_path / "proof"

    result = prove_candidate(
        candidate_path=candidate,
        mask_manifest_path=mask_manifest,
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
    candidate, _mask_manifest = _fixture(tmp_path)

    result = prove_candidate(
        candidate_path=candidate,
        mask_manifest_path=tmp_path / "missing.json",
        out_dir=tmp_path / "proof",
    )

    assert result["status"] == "REFUSE"
    assert "mask_manifest_missing" in result["reasons"]


def test_candidate_proof_refuses_mask_contract_drift(tmp_path: Path):
    candidate, mask_manifest = _fixture(tmp_path)
    source_manifest = json.loads(mask_manifest.read_text())

    source_manifest["cameraHash"] = "sha256:" + ("0" * 64)
    bad_manifest = tmp_path / "manifest.json"
    bad_manifest.write_text(json.dumps(source_manifest))

    result = prove_candidate(
        candidate_path=candidate,
        mask_manifest_path=bad_manifest,
        out_dir=tmp_path / "proof",
    )

    assert result["status"] == "REFUSE"
    assert "mask_camera_hash_mismatch" in result["reasons"]
