from __future__ import annotations

import json
import subprocess
import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]


def test_production_build_emits_canonical_structural_mask_bundle(tmp_path: Path) -> None:
    out = tmp_path / "house-a-mask-bundle"

    result = subprocess.run(
        [
            sys.executable,
            "-m",
            "tools.hd_iso.cli",
            "build",
            "house.master.a",
            "--seed",
            "18427",
            "--detail-seed",
            "4104",
            "--appearance-seed",
            "7001",
            "--decay-seed",
            "9907",
            "--fidelity-seed",
            "27182",
            "--out",
            str(out),
        ],
        cwd=ROOT,
        text=True,
        capture_output=True,
    )
    assert result.returncode == 0, result.stderr

    masks = out / "render" / "masks"
    manifest_path = masks / "manifest.json"

    assert manifest_path.exists(), f"missing canonical mask manifest: {manifest_path}"

    manifest = json.loads(manifest_path.read_text())
    assert manifest["schemaVersion"] == "hd-iso-structural-mask-bundle-v1"
    assert manifest["templateId"] == "house.master.a"
    assert manifest["width"] == 512
    assert manifest["height"] == 512
    assert manifest["cameraHash"] == (
        "sha256:754dc1d5bec75ea29af7d216c535511d999d882a1576fd3007f2a3f427e027a9"
    )
    assert manifest["projectionAdapter"] == "mirror_x"

    expected = {
        "silhouette",
        "walls",
        "roof",
        "door",
        "windows",
        "porch",
        "fascia",
        "gutter",
        "downpipe",
    }
    assert set(manifest["regions"]) == expected

    for name in expected:
        entry = manifest["regions"][name]
        path = masks / entry["file"]
        assert path.exists(), f"missing mask image for {name}: {path}"
        assert entry["pixelCount"] > 0

    scene = json.loads((out / "render" / "scene-manifest.json").read_text())
    assert scene["structuralMasks"]["schemaVersion"] == "hd-iso-structural-mask-bundle-v1"
    assert scene["structuralMasks"]["manifest"] == "masks/manifest.json"
