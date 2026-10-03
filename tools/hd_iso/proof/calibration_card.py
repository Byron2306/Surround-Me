from __future__ import annotations

import json
import struct
import zlib
from pathlib import Path

_CARD_W = 512
_CARD_H = 256


def _chunk(kind: bytes, data: bytes) -> bytes:
    return struct.pack(">I", len(data)) + kind + data + struct.pack(">I", zlib.crc32(kind + data) & 0xFFFFFFFF)


def _write_rgb_png(path: Path, width: int, height: int, pixels: bytearray) -> None:
    rows = bytearray()
    stride = width * 3
    for y in range(height):
        rows.append(0)
        start = y * stride
        rows.extend(pixels[start : start + stride])
    png = bytearray(b"\x89PNG\r\n\x1a\n")
    png.extend(_chunk(b"IHDR", struct.pack(">IIBBBBB", width, height, 8, 2, 0, 0, 0)))
    png.extend(_chunk(b"IDAT", zlib.compress(bytes(rows), level=9)))
    png.extend(_chunk(b"IEND", b""))
    path.write_bytes(png)


def _set_pixel(pixels: bytearray, x: int, y: int, rgb: tuple[int, int, int]) -> None:
    if not (0 <= x < _CARD_W and 0 <= y < _CARD_H):
        return
    i = (y * _CARD_W + x) * 3
    pixels[i : i + 3] = bytes(rgb)


def _line(pixels: bytearray, a: tuple[int, int], b: tuple[int, int], rgb: tuple[int, int, int]) -> None:
    x0, y0 = a
    x1, y1 = b
    dx = abs(x1 - x0)
    sx = 1 if x0 < x1 else -1
    dy = -abs(y1 - y0)
    sy = 1 if y0 < y1 else -1
    err = dx + dy
    while True:
        _set_pixel(pixels, x0, y0, rgb)
        if x0 == x1 and y0 == y1:
            break
        e2 = 2 * err
        if e2 >= dy:
            err += dy
            x0 += sx
        if e2 <= dx:
            err += dx
            y0 += sy


def _write_calibration_png(path: Path, projection: dict, status: str) -> None:
    bg = (20, 22, 26)
    pixels = bytearray(bg * (_CARD_W * _CARD_H))

    # Header bar: green-ish for PASS, red-ish for REFUSE. This is deterministic
    # evidence decoration, not a source of truth; proof.json remains authoritative.
    bar = (38, 120, 72) if status == "PASS" else (150, 46, 46)
    for y in range(24):
        for x in range(_CARD_W):
            _set_pixel(pixels, x, y, bar)

    expected = projection.get("expected", {})
    footprint = expected.get("footprintPixel", [])
    anchor = expected.get("anchorPixel", [])

    # Scene coordinates are 512x512. Compress Y by 0.42 and offset into card.
    def map_point(p):
        return int(round(float(p[0]))), int(round(36 + float(p[1]) * 0.42))

    if len(footprint) == 4:
        pts = [map_point(p) for p in footprint]
        for i in range(4):
            _line(pixels, pts[i], pts[(i + 1) % 4], (220, 224, 232))

    if len(anchor) == 2:
        ax, ay = map_point(anchor)
        for d in range(-7, 8):
            _set_pixel(pixels, ax + d, ay, (255, 196, 64))
            _set_pixel(pixels, ax, ay + d, (255, 196, 64))

    _write_rgb_png(path, _CARD_W, _CARD_H, pixels)


def write_proof_bundle(
    manifest: dict,
    scene_manifest: dict,
    geometry: dict,
    projection: dict,
    out_dir: Path | str,
) -> dict:
    out = Path(out_dir)
    out.mkdir(parents=True, exist_ok=True)

    reasons = list(geometry.get("reasons", [])) + list(projection.get("reasons", []))
    reasons = list(dict.fromkeys(reasons))
    status = "PASS" if geometry.get("status") == "PASS" and projection.get("status") == "PASS" else "REFUSE"

    checks = {}
    checks.update(geometry.get("checks", {}))
    checks.update(projection.get("checks", {}))

    proof = {
        "schemaVersion": "hd-iso-proof-v1",
        "status": status,
        "reasons": reasons,
        "templateId": manifest.get("templateId"),
        "structuralSeed": int(manifest.get("structuralSeed", -1)),
        "checks": checks,
        "geometry": geometry,
        "projection": projection,
        "scene": {
            "cameraHash": scene_manifest.get("cameraHash"),
            "render": scene_manifest.get("render"),
        },
    }

    (out / "proof.json").write_text(json.dumps(proof, sort_keys=True, indent=2) + "\n")
    _write_calibration_png(out / "calibration.png", projection, status)

    return {
        "status": status,
        "reasons": reasons,
        "output": str(out),
        "proof": proof,
    }
