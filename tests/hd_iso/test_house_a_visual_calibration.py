from __future__ import annotations

import json
import os
import struct
import subprocess
import sys
import zlib
from pathlib import Path

import pytest


ROOT = Path(__file__).resolve().parents[2]

TEMPLATE_ID = "house.master.a"
STRUCTURAL_SEED = 18427
DETAIL_SEED = 4104
APPEARANCE_SEED = 7001
DECAY_SEED = 9907
FIDELITY_SEED = 27182

EXPECTED_CAMERA_HASH = (
    "sha256:754dc1d5bec75ea29af7d216c535511d999d882a1576fd3007f2a3f427e027a9"
)
EXPECTED_PROJECTION_ADAPTER = "mirror_x"
EXPECTED_ANCHOR_PIXEL = (219.99993896484375, 334.0000457763672)
EXPECTED_FOOTPRINT = (
    (255.99990844726562, 256.00006103515625),
    (375.9999542236328, 316.00001525878906),
    (279.9999694824219, 364.0000305175781),
    (159.99993896484375, 304.00006103515625),
)


def _run_build(out_dir: Path) -> subprocess.CompletedProcess[str]:
    env = os.environ.copy()
    return subprocess.run(
        [
            sys.executable,
            "-m",
            "tools.hd_iso.cli",
            "build",
            TEMPLATE_ID,
            "--seed",
            str(STRUCTURAL_SEED),
            "--detail-seed",
            str(DETAIL_SEED),
            "--appearance-seed",
            str(APPEARANCE_SEED),
            "--decay-seed",
            str(DECAY_SEED),
            "--fidelity-seed",
            str(FIDELITY_SEED),
            "--out",
            str(out_dir),
        ],
        cwd=ROOT,
        text=True,
        capture_output=True,
        env=env,
    )


def _parse_png_rgba(path: Path) -> tuple[int, int, bytearray]:
    data = path.read_bytes()
    signature = b"\x89PNG\r\n\x1a\n"
    assert data.startswith(signature), f"{path} is not a PNG"

    pos = len(signature)
    width = height = None
    bit_depth = color_type = interlace = None
    idat = bytearray()

    while pos < len(data):
        length = struct.unpack(">I", data[pos : pos + 4])[0]
        pos += 4
        chunk_type = data[pos : pos + 4]
        pos += 4
        chunk = data[pos : pos + length]
        pos += length
        pos += 4

        if chunk_type == b"IHDR":
            width, height, bit_depth, color_type, _comp, _filt, interlace = struct.unpack(
                ">IIBBBBB", chunk
            )
        elif chunk_type == b"IDAT":
            idat.extend(chunk)
        elif chunk_type == b"IEND":
            break

    assert width is not None and height is not None, "PNG missing IHDR"
    assert bit_depth == 8, f"unsupported bit depth: {bit_depth}"
    assert color_type == 6, f"expected RGBA PNG, got color type {color_type}"
    assert interlace == 0, "interlaced PNG not supported by test helper"

    raw = zlib.decompress(bytes(idat))
    stride = width * 4
    out = bytearray(height * stride)

    src = 0
    prev = bytearray(stride)

    for y in range(height):
        filter_type = raw[src]
        src += 1
        scanline = bytearray(raw[src : src + stride])
        src += stride
        recon = _undo_png_filter(filter_type, scanline, prev, 4)
        out[y * stride : (y + 1) * stride] = recon
        prev = recon

    return width, height, out


def _undo_png_filter(
    filter_type: int,
    scanline: bytearray,
    prev: bytearray,
    bpp: int,
) -> bytearray:
    out = bytearray(len(scanline))

    for i, raw_x in enumerate(scanline):
        left = out[i - bpp] if i >= bpp else 0
        up = prev[i]
        up_left = prev[i - bpp] if i >= bpp else 0

        if filter_type == 0:
            out[i] = raw_x
        elif filter_type == 1:
            out[i] = (raw_x + left) & 0xFF
        elif filter_type == 2:
            out[i] = (raw_x + up) & 0xFF
        elif filter_type == 3:
            out[i] = (raw_x + ((left + up) // 2)) & 0xFF
        elif filter_type == 4:
            out[i] = (raw_x + _paeth(left, up, up_left)) & 0xFF
        else:
            raise AssertionError(f"unsupported PNG filter: {filter_type}")

    return out


def _paeth(a: int, b: int, c: int) -> int:
    p = a + b - c
    pa = abs(p - a)
    pb = abs(p - b)
    pc = abs(p - c)
    if pa <= pb and pa <= pc:
        return a
    if pb <= pc:
        return b
    return c


def _iter_pixels(width: int, height: int, rgba: bytearray):
    stride = width * 4
    for y in range(height):
        row = y * stride
        for x in range(width):
            i = row + (x * 4)
            yield x, y, rgba[i], rgba[i + 1], rgba[i + 2], rgba[i + 3]


def _luminance(r: int, g: int, b: int) -> float:
    return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255.0


def _visible_bbox(
    width: int,
    height: int,
    rgba: bytearray,
    alpha_min: int = 4,
) -> tuple[int, int, int, int]:
    xs: list[int] = []
    ys: list[int] = []
    for x, y, _r, _g, _b, a in _iter_pixels(width, height, rgba):
        if a >= alpha_min:
            xs.append(x)
            ys.append(y)

    assert xs and ys, "beauty render contains no visible non-transparent pixels"
    return min(xs), min(ys), max(xs), max(ys)


def _roi_luminances(
    width: int,
    height: int,
    rgba: bytearray,
    bbox: tuple[int, int, int, int],
    *,
    rx0: float,
    ry0: float,
    rx1: float,
    ry1: float,
    alpha_min: int = 4,
) -> list[float]:
    min_x, min_y, max_x, max_y = bbox
    span_x = max_x - min_x + 1
    span_y = max_y - min_y + 1

    x0 = max(0, min(width - 1, int(min_x + rx0 * span_x)))
    y0 = max(0, min(height - 1, int(min_y + ry0 * span_y)))
    x1 = max(0, min(width, int(min_x + rx1 * span_x)))
    y1 = max(0, min(height, int(min_y + ry1 * span_y)))

    values: list[float] = []
    stride = width * 4
    for y in range(y0, y1):
        row = y * stride
        for x in range(x0, x1):
            i = row + (x * 4)
            r, g, b, a = rgba[i], rgba[i + 1], rgba[i + 2], rgba[i + 3]
            if a >= alpha_min:
                values.append(_luminance(r, g, b))
    return values


def _median(values: list[float]) -> float:
    assert values, "expected non-empty sample set"
    values = sorted(values)
    mid = len(values) // 2
    if len(values) % 2:
        return values[mid]
    return (values[mid - 1] + values[mid]) / 2.0


def _compute_visual_metrics(
    beauty_path: Path,
) -> dict[str, float | tuple[int, int, int, int]]:
    width, height, rgba = _parse_png_rgba(beauty_path)
    bbox = _visible_bbox(width, height, rgba, alpha_min=4)

    total_pixels = width * height
    alpha_zero = 0
    visible_pixels = 0
    bright_visible = 0

    for _x, _y, r, g, b, a in _iter_pixels(width, height, rgba):
        if a == 0:
            alpha_zero += 1
        if a >= 4:
            visible_pixels += 1
            if _luminance(r, g, b) >= 0.08:
                bright_visible += 1

    front_wall = _roi_luminances(
        width,
        height,
        rgba,
        bbox,
        rx0=0.28,
        ry0=0.48,
        rx1=0.76,
        ry1=0.92,
    )
    side_wall = _roi_luminances(
        width,
        height,
        rgba,
        bbox,
        rx0=0.08,
        ry0=0.42,
        rx1=0.36,
        ry1=0.84,
    )
    roof = _roi_luminances(
        width,
        height,
        rgba,
        bbox,
        rx0=0.06,
        ry0=0.02,
        rx1=0.94,
        ry1=0.52,
    )

    front_wall_median = _median(front_wall)
    side_wall_median = _median(side_wall)
    roof_median = _median(roof)

    return {
        "bbox": bbox,
        "transparent_ratio": alpha_zero / total_pixels,
        "bright_visible_ratio": bright_visible / max(1, visible_pixels),
        "front_wall_median": front_wall_median,
        "side_wall_median": side_wall_median,
        "roof_median": roof_median,
        "roof_to_front_ratio": roof_median / max(front_wall_median, 1e-6),
        "roof_to_side_ratio": roof_median / max(side_wall_median, 1e-6),
    }


def test_build_cli_visual_calibration_red(tmp_path: Path) -> None:
    out = tmp_path / "house-a-visual-calibration-red"
    result = _run_build(out)

    assert result.returncode == 0, (
        "Build failed.\n"
        f"STDOUT:\n{result.stdout}\n\n"
        f"STDERR:\n{result.stderr}"
    )

    manifest_path = out / "render" / "scene-manifest.json"
    beauty_path = out / "render" / "beauty.png"

    assert manifest_path.exists(), f"missing scene manifest: {manifest_path}"
    assert beauty_path.exists(), f"missing beauty render: {beauty_path}"

    manifest = json.loads(manifest_path.read_text())

    assert manifest["cameraHash"] == EXPECTED_CAMERA_HASH
    assert manifest["projectionAdapter"] == EXPECTED_PROJECTION_ADAPTER
    assert manifest["render"]["transparent"] is True

    anchor = manifest["anchor"]["pixel"]
    assert anchor[0] == pytest.approx(EXPECTED_ANCHOR_PIXEL[0], abs=1e-3)
    assert anchor[1] == pytest.approx(EXPECTED_ANCHOR_PIXEL[1], abs=1e-3)

    footprint = manifest["footprintPixel"]
    assert len(footprint) == len(EXPECTED_FOOTPRINT)
    for actual, expected in zip(footprint, EXPECTED_FOOTPRINT, strict=True):
        assert actual[0] == pytest.approx(expected[0], abs=1e-3)
        assert actual[1] == pytest.approx(expected[1], abs=1e-3)

    metrics = _compute_visual_metrics(beauty_path)

    debug = {
        "beauty": str(beauty_path),
        "metrics": metrics,
        "cameraHash": manifest["cameraHash"],
        "projectionAdapter": manifest["projectionAdapter"],
        "anchorPixel": manifest["anchor"]["pixel"],
        "footprintPixel": manifest["footprintPixel"],
    }

    failures: list[str] = []

    if metrics["transparent_ratio"] < 0.75:
        failures.append("background_not_transparent_enough")

    if metrics["bright_visible_ratio"] < 0.35:
        failures.append("beauty_too_dark_overall")

    if metrics["front_wall_median"] < 0.10:
        failures.append("front_wall_too_dark")
    if metrics["side_wall_median"] < 0.08:
        failures.append("side_wall_too_dark")

    if metrics["roof_to_front_ratio"] > 2.50:
        failures.append("roof_front_balance_out_of_range")
    if metrics["roof_to_side_ratio"] > 3.00:
        failures.append("roof_side_balance_out_of_range")

    assert not failures, json.dumps(
        {
            "status": "REFUSE",
            "stage": "visual_calibration",
            "reasons": failures,
            "debug": debug,
        },
        indent=2,
    )
