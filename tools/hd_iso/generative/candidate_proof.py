from __future__ import annotations

import hashlib
import json
import struct
import zlib
from pathlib import Path

from tools.hd_iso.generative.compositor import (
    align_candidate_to_canonical_bbox,
    composite_with_canonical_regions,
)
from tools.hd_iso.generative.validation import (
    EXPECTED_CAMERA_HASH,
    EXPECTED_HEIGHT,
    EXPECTED_PROJECTION_ADAPTER,
    EXPECTED_WIDTH,
)


PNG_SIGNATURE = b"\x89PNG\r\n\x1a\n"
EXPECTED_REGION_NAMES = {
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


def _chunk(kind: bytes, payload: bytes) -> bytes:
    body = kind + payload
    return struct.pack(">I", len(payload)) + body + struct.pack(">I", zlib.crc32(body) & 0xFFFFFFFF)


def write_rgba_png(path: Path, image) -> None:
    height = len(image)
    if height <= 0:
        raise ValueError("image_empty")
    width = len(image[0])
    if width <= 0 or any(len(row) != width for row in image):
        raise ValueError("image_shape_invalid")

    raw = bytearray()
    for row in image:
        raw.append(0)
        for pixel in row:
            if len(pixel) != 4:
                raise ValueError("rgba_pixel_invalid")
            raw.extend(max(0, min(255, int(v))) for v in pixel)

    ihdr = struct.pack(">IIBBBBB", width, height, 8, 6, 0, 0, 0)
    payload = (
        PNG_SIGNATURE
        + _chunk(b"IHDR", ihdr)
        + _chunk(b"IDAT", zlib.compress(bytes(raw), 9))
        + _chunk(b"IEND", b"")
    )
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(payload)


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


def read_png_rgba(path: Path):
    data = path.read_bytes()
    if not data.startswith(PNG_SIGNATURE):
        raise ValueError("png_signature_invalid")

    pos = len(PNG_SIGNATURE)
    width = height = bit_depth = color_type = None
    compressed = bytearray()

    while pos < len(data):
        if pos + 8 > len(data):
            raise ValueError("png_chunk_truncated")
        length = struct.unpack(">I", data[pos:pos + 4])[0]
        kind = data[pos + 4:pos + 8]
        start = pos + 8
        end = start + length
        if end + 4 > len(data):
            raise ValueError("png_chunk_truncated")
        payload = data[start:end]
        pos = end + 4

        if kind == b"IHDR":
            width, height, bit_depth, color_type, comp, filt, interlace = struct.unpack(
                ">IIBBBBB", payload
            )
            if comp != 0 or filt != 0 or interlace != 0:
                raise ValueError("png_format_unsupported")
        elif kind == b"IDAT":
            compressed.extend(payload)
        elif kind == b"IEND":
            break

    if not width or not height or bit_depth != 8:
        raise ValueError("png_format_unsupported")

    channels_by_type = {0: 1, 2: 3, 4: 2, 6: 4}
    channels = channels_by_type.get(color_type)
    if channels is None:
        raise ValueError("png_color_type_unsupported")

    decoded = zlib.decompress(bytes(compressed))
    stride = width * channels
    expected = height * (stride + 1)
    if len(decoded) != expected:
        raise ValueError("png_scanline_size_invalid")

    rows = []
    previous = bytearray(stride)
    offset = 0
    for _y in range(height):
        filter_type = decoded[offset]
        offset += 1
        scan = bytearray(decoded[offset:offset + stride])
        offset += stride

        for i in range(stride):
            left = scan[i - channels] if i >= channels else 0
            up = previous[i]
            upper_left = previous[i - channels] if i >= channels else 0

            if filter_type == 0:
                value = scan[i]
            elif filter_type == 1:
                value = (scan[i] + left) & 0xFF
            elif filter_type == 2:
                value = (scan[i] + up) & 0xFF
            elif filter_type == 3:
                value = (scan[i] + ((left + up) // 2)) & 0xFF
            elif filter_type == 4:
                value = (scan[i] + _paeth(left, up, upper_left)) & 0xFF
            else:
                raise ValueError("png_filter_unsupported")
            scan[i] = value

        row = []
        for x in range(width):
            base = x * channels
            if color_type == 6:
                r, g, b, a = scan[base:base + 4]
            elif color_type == 2:
                r, g, b = scan[base:base + 3]
                a = 255
            elif color_type == 4:
                gray, a = scan[base:base + 2]
                r = g = b = gray
            else:
                gray = scan[base]
                r = g = b = gray
                a = 255
            row.append((int(r), int(g), int(b), int(a)))

        rows.append(row)
        previous = scan

    return rows


def _mask_from_png(path: Path):
    image = read_png_rgba(path)
    return [[pixel[3] > 127 or max(pixel[:3]) > 127 for pixel in row] for row in image]


def _sha256_file(path: Path) -> str:
    return "sha256:" + hashlib.sha256(path.read_bytes()).hexdigest()


def _refuse(*reasons: str) -> dict:
    return {"status": "REFUSE", "reasons": list(dict.fromkeys(reasons))}


def prove_candidate(
    *,
    candidate_path: Path,
    mask_manifest_path: Path,
    out_dir: Path,
) -> dict:
    candidate_path = Path(candidate_path)
    mask_manifest_path = Path(mask_manifest_path)
    out_dir = Path(out_dir)

    if not candidate_path.exists():
        return _refuse("candidate_missing")
    if not mask_manifest_path.exists():
        return _refuse("mask_manifest_missing")

    try:
        manifest = json.loads(mask_manifest_path.read_text())
    except Exception:
        return _refuse("mask_manifest_invalid")

    reasons = []
    if manifest.get("schemaVersion") != "hd-iso-structural-mask-bundle-v1":
        reasons.append("mask_schema_mismatch")
    if manifest.get("templateId") != "house.master.a":
        reasons.append("mask_template_mismatch")
    if manifest.get("width") != EXPECTED_WIDTH or manifest.get("height") != EXPECTED_HEIGHT:
        reasons.append("mask_canvas_mismatch")
    if manifest.get("cameraHash") != EXPECTED_CAMERA_HASH:
        reasons.append("mask_camera_hash_mismatch")
    if manifest.get("projectionAdapter") != EXPECTED_PROJECTION_ADAPTER:
        reasons.append("mask_projection_adapter_mismatch")

    regions = manifest.get("regions")
    if not isinstance(regions, dict) or set(regions) != EXPECTED_REGION_NAMES:
        reasons.append("mask_region_set_mismatch")

    if reasons:
        return _refuse(*reasons)

    try:
        candidate = read_png_rgba(candidate_path)
    except Exception:
        return _refuse("candidate_png_invalid")

    raw_height = len(candidate)
    raw_width = len(candidate[0])
    raw_reasons = []
    if raw_width != EXPECTED_WIDTH or raw_height != EXPECTED_HEIGHT:
        raw_reasons.append("canvas_size_mismatch")

    mask_root = mask_manifest_path.parent
    canonical = {}
    for name in sorted(EXPECTED_REGION_NAMES):
        entry = regions[name]
        if not isinstance(entry, dict) or not isinstance(entry.get("file"), str):
            return _refuse("mask_region_entry_invalid")
        mask_path = mask_root / entry["file"]
        if not mask_path.exists():
            return _refuse("mask_region_file_missing")
        try:
            mask = _mask_from_png(mask_path)
        except Exception:
            return _refuse("mask_region_png_invalid")
        if len(mask) != EXPECTED_HEIGHT or len(mask[0]) != EXPECTED_WIDTH:
            return _refuse("mask_region_canvas_mismatch")
        if not any(any(row) for row in mask):
            return _refuse("mask_region_empty")
        canonical[name] = mask

    silhouette = canonical.pop("silhouette")

    try:
        normalized = align_candidate_to_canonical_bbox(
            candidate,
            canonical_silhouette=silhouette,
            width=EXPECTED_WIDTH,
            height=EXPECTED_HEIGHT,
        )
    except ValueError as exc:
        return _refuse(f"candidate_alignment_failed:{exc}")

    governed = composite_with_canonical_regions(
        normalized,
        canonical_silhouette=silhouette,
        canonical_regions=canonical,
    )

    out_dir.mkdir(parents=True, exist_ok=True)
    governed_path = out_dir / "governed-candidate.png"
    write_rgba_png(governed_path, governed)

    proof = {
        "schemaVersion": "hd-iso-generative-proof-v1",
        "status": "PASS",
        "templateId": "house.master.a",
        "rawCandidate": {
            "status": "REFUSE" if raw_reasons else "PASS",
            "reasons": raw_reasons,
            "width": raw_width,
            "height": raw_height,
            "sha256": _sha256_file(candidate_path),
        },
        "normalizedCandidate": {
            "width": EXPECTED_WIDTH,
            "height": EXPECTED_HEIGHT,
            "method": "alpha-bbox-uniform-fit-nearest-v1",
        },
        "canonicalAuthority": {
            "alpha": "silhouette",
            "regions": True,
            "maskManifestSha256": _sha256_file(mask_manifest_path),
            "cameraHash": EXPECTED_CAMERA_HASH,
            "projectionAdapter": EXPECTED_PROJECTION_ADAPTER,
        },
        "governedCandidate": {
            "file": governed_path.name,
            "width": EXPECTED_WIDTH,
            "height": EXPECTED_HEIGHT,
            "sha256": _sha256_file(governed_path),
        },
    }
    (out_dir / "proof.json").write_text(json.dumps(proof, sort_keys=True, indent=2) + "\n")
    return proof
