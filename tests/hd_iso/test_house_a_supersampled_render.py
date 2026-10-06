from __future__ import annotations

import json
import struct
import subprocess
import sys
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[2]

EXPECTED_CAMERA_HASH = (
    "sha256:754dc1d5bec75ea29af7d216c535511d999d882a1576fd3007f2a3f427e027a9"
)
EXPECTED_PROJECTION_ADAPTER = "mirror_x"


def _png_size(path: Path) -> tuple[int, int]:
    data = path.read_bytes()
    assert data[:8] == b"\x89PNG\r\n\x1a\n"
    assert data[12:16] == b"IHDR"
    return struct.unpack(">II", data[16:24])


def test_build_cli_emits_four_x_supersampled_render_bundle(tmp_path: Path) -> None:
    out = tmp_path / "house-a-super"

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
            "--render-scale",
            "4",
            "--out",
            str(out),
        ],
        cwd=ROOT,
        text=True,
        capture_output=True,
    )

    assert result.returncode == 0, (
        f"STDOUT:\n{result.stdout}\nSTDERR:\n{result.stderr}"
    )

    scene = json.loads((out / "render" / "scene-manifest.json").read_text())
    masks = json.loads((out / "render" / "masks" / "manifest.json").read_text())

    render = scene["render"]
    assert render["logicalWidth"] == 512
    assert render["logicalHeight"] == 512
    assert render["renderScale"] == 4
    assert render["width"] == 2048
    assert render["height"] == 2048
    assert scene["cameraHash"] == EXPECTED_CAMERA_HASH
    assert scene["projectionAdapter"] == EXPECTED_PROJECTION_ADAPTER

    assert _png_size(out / "render" / "beauty.png") == (2048, 2048)
    assert _png_size(out / "render" / "silhouette.png") == (2048, 2048)

    assert masks["logicalWidth"] == 512
    assert masks["logicalHeight"] == 512
    assert masks["renderScale"] == 4
    assert masks["width"] == 2048
    assert masks["height"] == 2048

    anchor = scene["anchor"]
    assert anchor["renderPixel"][0] == pytest.approx(anchor["pixel"][0] * 4, abs=1e-3)
    assert anchor["renderPixel"][1] == pytest.approx(anchor["pixel"][1] * 4, abs=1e-3)

    for logical, rendered in zip(
        scene["footprintPixel"],
        scene["footprintRenderPixel"],
        strict=True,
    ):
        assert rendered[0] == pytest.approx(logical[0] * 4, abs=1e-3)
        assert rendered[1] == pytest.approx(logical[1] * 4, abs=1e-3)


def test_render_scale_defaults_to_one_without_second_blender_build() -> None:
    import inspect

    from tools.hd_iso.blender.build_scene import render_from_manifest
    from tools.hd_iso.blender.render_passes import render_authoritative_passes

    assert inspect.signature(render_from_manifest).parameters["render_scale"].default == 1
    assert inspect.signature(render_authoritative_passes).parameters["render_scale"].default == 1
