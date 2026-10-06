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


def _fixture(tmp_path: Path, *, render_scale: int = 4):
    width = height = 512 * render_scale

    fixture = tmp_path / "fixture"
    masks = fixture / "masks"
    masks.mkdir(parents=True)

    candidate = fixture / "candidate.png"
    write_rgba_png(candidate, _solid(1254, 1254, (120, 90, 70, 255)))

    def s(v: int) -> int:
        return v * render_scale

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
        coords = tuple(s(v) for v in (x0, y0, x1, y1))
        write_rgba_png(
            masks / filename,
            _mask_image(width, height, *coords),
        )
        manifest_regions[name] = {
            "file": filename,
            "pixelCount": (coords[2] - coords[0]) * (coords[3] - coords[1]),
        }

    manifest = {
        "schemaVersion": "hd-iso-structural-mask-bundle-v1",
        "templateId": "house.master.a",
        "logicalWidth": 512,
        "logicalHeight": 512,
        "renderScale": render_scale,
        "width": width,
        "height": height,
        "cameraHash": EXPECTED_CAMERA_HASH,
        "projectionAdapter": "mirror_x",
        "regions": manifest_regions,
    }

    manifest_path = masks / "manifest.json"
    manifest_path.write_text(json.dumps(manifest))
    return candidate, manifest_path


def test_four_x_candidate_proof_emits_2048_governed_sprite(tmp_path: Path):
    candidate, mask_manifest = _fixture(tmp_path, render_scale=4)
    out = tmp_path / "proof"

    result = prove_candidate(
        candidate_path=candidate,
        mask_manifest_path=mask_manifest,
        out_dir=out,
    )

    assert result["status"] == "PASS", result
    assert result["logicalCanvas"] == {
        "width": 512,
        "height": 512,
    }
    assert result["renderScale"] == 4

    assert result["normalizedCandidate"]["width"] == 2048
    assert result["normalizedCandidate"]["height"] == 2048
    assert result["normalizedCandidate"]["method"] == (
        "alpha-bbox-uniform-fit-nearest-v1"
    )

    governed = result["governedCandidate"]
    assert governed["width"] == 2048
    assert governed["height"] == 2048

    proof = json.loads((out / "proof.json").read_text())
    assert proof["renderScale"] == 4
    assert proof["governedCandidate"]["width"] == 2048
    assert proof["governedCandidate"]["height"] == 2048


def test_supersampled_proof_refuses_inconsistent_mask_dimensions(tmp_path: Path):
    candidate, mask_manifest = _fixture(tmp_path, render_scale=4)
    manifest = json.loads(mask_manifest.read_text())
    manifest["width"] = 1024
    mask_manifest.write_text(json.dumps(manifest))

    result = prove_candidate(
        candidate_path=candidate,
        mask_manifest_path=mask_manifest,
        out_dir=tmp_path / "proof",
    )

    assert result["status"] == "REFUSE"
    assert "mask_render_dimensions_mismatch" in result["reasons"]
