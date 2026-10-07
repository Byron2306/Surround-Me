from __future__ import annotations

import hashlib
import json
import math
import struct
import zlib
from pathlib import Path

from tools.hd_iso.generative.compositor import (
    align_candidate_to_canonical_footprint,
    composite_with_canonical_regions,
)
from tools.hd_iso.geometry.projection import project_ground

# Perspective-compatibility gate. Residuals are evaluated in logical pixels
# so supersampling cannot change the verdict.
MAX_SIMILARITY_RMS_LOGICAL_PX = 16.0
MAX_SIMILARITY_ERROR_LOGICAL_PX = 24.0


def _similarity_compatibility(
    source_points: dict,
    target_points: dict,
    *,
    render_scale: float,
) -> dict:
    """Measure how well three donor contacts fit without shear/nonuniform scale."""

    names = ("left", "right", "rear")

    source = [
        (
            float(source_points[name]["x"]),
            float(source_points[name]["y"]),
        )
        for name in names
    ]
    target = [
        (
            float(target_points[name]["x"]),
            float(target_points[name]["y"]),
        )
        for name in names
    ]

    sx = sum(p[0] for p in source) / len(source)
    sy = sum(p[1] for p in source) / len(source)
    tx = sum(p[0] for p in target) / len(target)
    ty = sum(p[1] for p in target) / len(target)

    numerator_a = 0.0
    numerator_b = 0.0
    denominator = 0.0

    for (x, y), (u, v) in zip(source, target):
        x -= sx
        y -= sy
        u -= tx
        v -= ty

        numerator_a += x * u + y * v
        numerator_b += x * v - y * u
        denominator += x * x + y * y

    if denominator <= 1e-12:
        raise ValueError("degenerate_source_contacts")

    a = numerator_a / denominator
    b = numerator_b / denominator

    scale = math.hypot(a, b)
    rotation_degrees = math.degrees(math.atan2(b, a))

    errors_render_px = []

    for (x, y), (u, v) in zip(source, target):
        px = a * (x - sx) - b * (y - sy) + tx
        py = b * (x - sx) + a * (y - sy) + ty
        errors_render_px.append(math.hypot(px - u, py - v))

    rms_render_px = math.sqrt(
        sum(error * error for error in errors_render_px)
        / len(errors_render_px)
    )
    max_render_px = max(errors_render_px)

    if render_scale <= 0:
        raise ValueError("invalid_render_scale")

    rms_logical_px = rms_render_px / render_scale
    max_logical_px = max_render_px / render_scale

    return {
        "method": "orientation-preserving-least-squares-similarity-v1",
        "scale": scale,
        "rotationDegrees": rotation_degrees,
        "rmsRenderPx": rms_render_px,
        "maxRenderPx": max_render_px,
        "rmsLogicalPx": rms_logical_px,
        "maxLogicalPx": max_logical_px,
        "limits": {
            "rmsLogicalPx": MAX_SIMILARITY_RMS_LOGICAL_PX,
            "maxLogicalPx": MAX_SIMILARITY_ERROR_LOGICAL_PX,
        },
        "status": (
            "PASS"
            if (
                rms_logical_px <= MAX_SIMILARITY_RMS_LOGICAL_PX
                and max_logical_px <= MAX_SIMILARITY_ERROR_LOGICAL_PX
            )
            else "REFUSE"
        ),
    }

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


def _clear_border_connected_black_matte(image, threshold: int = 3):
    """Remove only border-connected near-black matte from otherwise opaque donors."""
    height = len(image)
    if height <= 0:
        return image
    width = len(image[0])
    if width <= 0:
        return image

    out = [list(row) for row in image]
    visited = [[False for _ in range(width)] for _ in range(height)]
    queue = []

    def enqueue(x: int, y: int) -> None:
        if x < 0 or x >= width or y < 0 or y >= height or visited[y][x]:
            return
        visited[y][x] = True
        r, g, b, a = out[y][x]
        # Traverse existing transparent margins and near-black opaque matte.
        # This mirrors the browser compatibility cleanup and allows a transparent
        # outer border to reach a black matte immediately inside it.
        if a > 0 and (r > threshold or g > threshold or b > threshold):
            return
        queue.append((x, y))

    for x in range(width):
        enqueue(x, 0)
        enqueue(x, height - 1)
    for y in range(height):
        enqueue(0, y)
        enqueue(width - 1, y)

    head = 0
    while head < len(queue):
        x, y = queue[head]
        head += 1
        r, g, b, a = out[y][x]
        if a > 0:
            out[y][x] = (r, g, b, 0)
        enqueue(x - 1, y)
        enqueue(x + 1, y)
        enqueue(x, y - 1)
        enqueue(x, y + 1)

    return out


def _refuse(*reasons: str, **evidence) -> dict:
    result = {
        "status": "REFUSE",
        "reasons": list(dict.fromkeys(reasons)),
    }
    result.update(evidence)
    return result


def _region_allows_empty_mask(entry: dict) -> bool:
    """Allow an empty canonical region only when the manifest declares it absent."""
    return (
        isinstance(entry, dict)
        and int(entry.get("pixelCount", -1)) == 0
        and entry.get("objects") == []
    )


def prove_candidate(
    *,
    candidate_path: Path,
    mask_manifest_path: Path,
    calibration_path: Path | None = None,
    variant_contract_path: Path | None = None,
    out_dir: Path,
) -> dict:
    candidate_path = Path(candidate_path)
    mask_manifest_path = Path(mask_manifest_path)
    out_dir = Path(out_dir)

    if not candidate_path.exists():
        return _refuse("candidate_missing")
    if not mask_manifest_path.exists():
        return _refuse("mask_manifest_missing")
    if variant_contract_path is None:
        return _refuse("variant_contract_missing")

    variant_contract_path = Path(variant_contract_path)
    if not variant_contract_path.exists():
        return _refuse("variant_contract_missing")

    try:
        variant_contract = json.loads(variant_contract_path.read_text())
    except Exception:
        return _refuse("variant_contract_invalid")

    if variant_contract.get("variantId") != "house.a.02":
        return _refuse("variant_contract_variant_mismatch")

    footprint_m = variant_contract.get("footprintM")
    if (
        not isinstance(footprint_m, list)
        or len(footprint_m) != 2
    ):
        return _refuse("variant_contract_footprint_invalid")

    try:
        width_m = float(footprint_m[0])
        depth_m = float(footprint_m[1])
    except (TypeError, ValueError):
        return _refuse("variant_contract_footprint_invalid")

    if width_m <= 0.0 or depth_m <= 0.0:
        return _refuse("variant_contract_footprint_invalid")

    if calibration_path is None:
        return _refuse("donor_calibration_missing")

    calibration_path = Path(calibration_path)
    if not calibration_path.exists():
        return _refuse("donor_calibration_missing")

    try:
        calibration = json.loads(calibration_path.read_text())
    except Exception:
        return _refuse("donor_calibration_invalid")

    if calibration.get("schemaVersion") != "hd-iso-donor-footprint-calibration-v2":
        return _refuse("donor_calibration_schema_mismatch")

    if calibration.get("variantId") != "house.a.02":
        return _refuse("donor_calibration_variant_mismatch")

    source = calibration.get("source")
    contacts = calibration.get("contacts")

    if not isinstance(source, dict) or not isinstance(contacts, dict):
        return _refuse("donor_calibration_invalid")

    if source.get("file") != candidate_path.name:
        return _refuse("donor_calibration_source_mismatch")

    expected_sha = source.get("sha256")
    if not isinstance(expected_sha, str):
        return _refuse("donor_calibration_invalid")

    actual_sha = hashlib.sha256(candidate_path.read_bytes()).hexdigest()
    if actual_sha != expected_sha:
        return _refuse("donor_calibration_sha256_mismatch")

    try:
        manifest = json.loads(mask_manifest_path.read_text())
    except Exception:
        return _refuse("mask_manifest_invalid")

    reasons = []
    if manifest.get("schemaVersion") != "hd-iso-structural-mask-bundle-v1":
        reasons.append("mask_schema_mismatch")
    if manifest.get("templateId") != "house.master.a":
        reasons.append("mask_template_mismatch")
    logical_width = int(manifest.get("logicalWidth", EXPECTED_WIDTH))
    logical_height = int(manifest.get("logicalHeight", EXPECTED_HEIGHT))
    render_scale = int(manifest.get("renderScale", 1))
    render_width = int(manifest.get("width", -1))
    render_height = int(manifest.get("height", -1))

    if logical_width != EXPECTED_WIDTH or logical_height != EXPECTED_HEIGHT:
        reasons.append("mask_logical_canvas_mismatch")
    if render_scale < 1:
        reasons.append("mask_render_scale_invalid")
    if (
        render_width != logical_width * render_scale
        or render_height != logical_height * render_scale
    ):
        reasons.append("mask_render_dimensions_mismatch")
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
    if raw_width != render_width or raw_height != render_height:
        raw_reasons.append("canvas_size_mismatch")

    try:
        expected_source_width = int(source["width"])
        expected_source_height = int(source["height"])
    except (KeyError, TypeError, ValueError):
        return _refuse("donor_calibration_dimensions_invalid")

    if raw_width != expected_source_width or raw_height != expected_source_height:
        return _refuse("donor_calibration_dimensions_mismatch")

    allowed_world_corners = {
        "x0_y0",
        "xWidth_y0",
        "xWidth_yDepth",
        "x0_yDepth",
    }

    def contact(name: str) -> tuple[float, float, str]:
        value = contacts.get(name)
        if not isinstance(value, dict):
            raise ValueError("missing")
        try:
            x = float(value["x"])
            y = float(value["y"])
            world_corner = value["worldCorner"]
        except (KeyError, TypeError, ValueError):
            raise ValueError("invalid")
        if not isinstance(world_corner, str):
            raise ValueError("world_corner_invalid")
        if world_corner not in allowed_world_corners:
            raise ValueError("world_corner_invalid")
        if not (0.0 <= x < raw_width and 0.0 <= y < raw_height):
            raise ValueError("bounds")
        return x, y, world_corner

    try:
        rear_left = contact("rearLeft")
        front_left = contact("frontLeft")
        front_right = contact("frontRight")
    except ValueError:
        return _refuse("donor_calibration_contacts_invalid")

    world_corner_ids = {
        rear_left[2],
        front_left[2],
        front_right[2],
    }
    if len(world_corner_ids) != 3:
        return _refuse("donor_calibration_world_corners_duplicate")

    source_det = (
        (front_right[0] - front_left[0]) * (rear_left[1] - front_left[1])
        - (front_right[1] - front_left[1]) * (rear_left[0] - front_left[0])
    )
    if abs(source_det) < 1e-9:
        return _refuse("donor_calibration_contacts_degenerate")

    candidate = _clear_border_connected_black_matte(candidate)

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
        if len(mask) != render_height or len(mask[0]) != render_width:
            return _refuse("mask_region_canvas_mismatch")
        has_pixels = any(any(row) for row in mask)
        if not has_pixels:
            if not _region_allows_empty_mask(entry):
                return _refuse("mask_region_empty")
            continue
        if _region_allows_empty_mask(entry):
            return _refuse("mask_region_manifest_mismatch")
        canonical[name] = mask

    silhouette = canonical.pop("silhouette")

    # A-02 target contacts are authority-derived from the variant footprint
    # and project_ground(). Target pixels are never supplied by donor
    # calibration evidence.
    logical_origin_x = logical_width / 2.0
    logical_origin_y = logical_height / 2.0

    def target_pixel(world_x: float, world_y: float) -> dict[str, float]:
        px, py = project_ground(world_x, world_y)
        return {
            "x": (logical_origin_x + px) * render_scale,
            "y": (logical_origin_y + py) * render_scale,
        }

    def world_corner_position(world_corner: str) -> tuple[float, float]:
        positions = {
            "x0_y0": (0.0, 0.0),
            "xWidth_y0": (width_m, 0.0),
            "xWidth_yDepth": (width_m, depth_m),
            "x0_yDepth": (0.0, depth_m),
        }
        return positions[world_corner]

    # Contact pixels are donor evidence. worldCorner declares which canonical
    # footprint vertex each measurement represents. Target pixels themselves
    # remain derived exclusively from footprintM + project_ground().
    contact_mapping = {
        "left": front_left,
        "right": front_right,
        "rear": rear_left,
    }

    source_points = {
        name: {"x": value[0], "y": value[1]}
        for name, value in contact_mapping.items()
    }

    target_points = {
        name: target_pixel(*world_corner_position(value[2]))
        for name, value in contact_mapping.items()
    }

    world_corner_mapping = {
        name: value[2]
        for name, value in contact_mapping.items()
    }

    try:
        compatibility = _similarity_compatibility(
            source_points,
            target_points,
            render_scale=render_scale,
        )
    except ValueError as exc:
        return _refuse(f"donor_projection_compatibility_failed:{exc}")

    if compatibility["status"] != "PASS":
        return _refuse(
            "donor_projection_incompatible",
            projectionCompatibility=compatibility,
        )

    try:
        normalized = align_candidate_to_canonical_footprint(
            candidate,
            source_points=source_points,
            target_points=target_points,
            width=render_width,
            height=render_height,
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
        "logicalCanvas": {
            "width": logical_width,
            "height": logical_height,
        },
        "renderScale": render_scale,
        "normalizedCandidate": {
            "width": render_width,
            "height": render_height,
            "method": "border-black-matte-cleanup+three-point-footprint-affine-nearest-v1",
            "donorCalibration": {
                "schemaVersion": calibration["schemaVersion"],
                "variantId": calibration["variantId"],
                "sourceSha256": expected_sha,
                "sourceWidth": expected_source_width,
                "sourceHeight": expected_source_height,
                "sourcePoints": source_points,
                "worldCornerMapping": world_corner_mapping,
                "targetPoints": target_points,
                "targetAuthority": "calibration.worldCorner+variant-contract.json:footprintM+project_ground",
                "variantContractSha256": _sha256_file(variant_contract_path),
                "footprintM": [width_m, depth_m],
                "projectionCompatibility": compatibility,
            },
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
            "width": render_width,
            "height": render_height,
            "sha256": _sha256_file(governed_path),
        },
    }
    (out_dir / "proof.json").write_text(json.dumps(proof, sort_keys=True, indent=2) + "\n")
    return proof
