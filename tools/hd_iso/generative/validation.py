from __future__ import annotations

from dataclasses import dataclass
from typing import Literal


EXPECTED_GEOMETRY_SHA = (
    "sha256:820ca6b7bcd774eb93c2ad3bcb93567a8a42bde484d7d1e4a71e9cc6bd9104a1"
)
EXPECTED_DETAIL_SHA = (
    "sha256:e2f1d4ac85cef2b32db76c424fd11988cf8912afb452b593aeaae81c416308e4"
)
EXPECTED_SURFACE_SHA = (
    "sha256:c32c73d9d82d624f07186089e03e5c029f33aa338e68f7f90bc243434f84aa1b"
)
EXPECTED_FIDELITY_SHA = (
    "sha256:fb58ca746aab1fa2ad7c4549e6e6efeb279a9ba759b0b91bef581898ece6a596"
)
EXPECTED_CAMERA_HASH = (
    "sha256:754dc1d5bec75ea29af7d216c535511d999d882a1576fd3007f2a3f427e027a9"
)
EXPECTED_PROJECTION_ADAPTER = "mirror_x"
EXPECTED_WIDTH = 512
EXPECTED_HEIGHT = 512

MIN_IOU = 0.985
MAX_OUTSIDE_RATIO = 0.0025
MAX_MISSING_RATIO = 0.01
MAX_BBOX_DRIFT_PX = 2


@dataclass(frozen=True)
class CandidateValidationResult:
    status: Literal["PASS", "REFUSE"]
    reasons: tuple[str, ...]


@dataclass(frozen=True)
class SilhouetteVerificationResult:
    status: Literal["PASS", "REFUSE"]
    reasons: tuple[str, ...]
    metrics: dict[str, float | list[int]]


def validate_generative_candidate_manifest(candidate: dict) -> CandidateValidationResult:
    reasons: list[str] = []

    if candidate.get("schemaVersion") != "hd-iso-generative-candidate-v1":
        reasons.append("candidate_schema_mismatch")
    if candidate.get("templateId") != "house.master.a":
        reasons.append("candidate_template_mismatch")

    if candidate.get("sourceGeometrySha256") != EXPECTED_GEOMETRY_SHA:
        reasons.append("source_geometry_hash_mismatch")
    if candidate.get("sourceDetailSha256") != EXPECTED_DETAIL_SHA:
        reasons.append("source_detail_hash_mismatch")
    if candidate.get("sourceSurfaceSha256") != EXPECTED_SURFACE_SHA:
        reasons.append("source_surface_hash_mismatch")
    if candidate.get("sourceSurfaceFidelitySha256") != EXPECTED_FIDELITY_SHA:
        reasons.append("source_surface_fidelity_hash_mismatch")

    if candidate.get("cameraHash") != EXPECTED_CAMERA_HASH:
        reasons.append("camera_hash_mismatch")
    if candidate.get("projectionAdapter") != EXPECTED_PROJECTION_ADAPTER:
        reasons.append("projection_adapter_mismatch")

    if (
        candidate.get("width") != EXPECTED_WIDTH
        or candidate.get("height") != EXPECTED_HEIGHT
    ):
        reasons.append("canvas_size_mismatch")

    image = candidate.get("candidateImage")
    if not isinstance(image, str) or not image:
        reasons.append("candidate_image_invalid")

    unique = tuple(dict.fromkeys(reasons))
    return CandidateValidationResult("PASS" if not unique else "REFUSE", unique)


def _shape(mask) -> tuple[int, int] | None:
    if not isinstance(mask, list) or not mask:
        return None
    if not all(isinstance(row, list) for row in mask):
        return None

    width = len(mask[0])
    if width == 0:
        return None
    if any(len(row) != width for row in mask):
        return None

    return len(mask), width


def _bbox(mask) -> tuple[int, int, int, int] | None:
    xs: list[int] = []
    ys: list[int] = []

    for y, row in enumerate(mask):
        for x, value in enumerate(row):
            if bool(value):
                xs.append(x)
                ys.append(y)

    if not xs:
        return None

    return min(xs), min(ys), max(xs), max(ys)


def verify_silhouette_masks(
    canonical_mask,
    candidate_mask,
) -> SilhouetteVerificationResult:
    reasons: list[str] = []

    canonical_shape = _shape(canonical_mask)
    candidate_shape = _shape(candidate_mask)

    if canonical_shape is None or candidate_shape is None:
        return SilhouetteVerificationResult(
            "REFUSE",
            ("silhouette_mask_invalid",),
            {},
        )

    if canonical_shape != candidate_shape:
        return SilhouetteVerificationResult(
            "REFUSE",
            ("silhouette_canvas_mismatch",),
            {
                "canonicalHeight": canonical_shape[0],
                "canonicalWidth": canonical_shape[1],
                "candidateHeight": candidate_shape[0],
                "candidateWidth": candidate_shape[1],
            },
        )

    canonical_bbox = _bbox(canonical_mask)
    candidate_bbox = _bbox(candidate_mask)

    if canonical_bbox is None:
        return SilhouetteVerificationResult(
            "REFUSE",
            ("canonical_silhouette_empty",),
            {},
        )
    if candidate_bbox is None:
        return SilhouetteVerificationResult(
            "REFUSE",
            ("candidate_silhouette_empty",),
            {},
        )

    canonical_count = 0
    candidate_count = 0
    intersection = 0
    union = 0
    outside = 0
    missing = 0

    height, width = canonical_shape
    for y in range(height):
        for x in range(width):
            canonical = bool(canonical_mask[y][x])
            candidate = bool(candidate_mask[y][x])

            if canonical:
                canonical_count += 1
            if candidate:
                candidate_count += 1
            if canonical and candidate:
                intersection += 1
            if canonical or candidate:
                union += 1
            if candidate and not canonical:
                outside += 1
            if canonical and not candidate:
                missing += 1

    iou = intersection / union if union else 1.0
    outside_ratio = outside / canonical_count if canonical_count else 1.0
    missing_ratio = missing / canonical_count if canonical_count else 1.0

    bbox_drift = [
        abs(candidate_bbox[i] - canonical_bbox[i])
        for i in range(4)
    ]

    if iou < MIN_IOU:
        reasons.append("silhouette_iou_below_minimum")
    if outside_ratio > MAX_OUTSIDE_RATIO:
        reasons.append("silhouette_outside_ratio_above_maximum")
    if missing_ratio > MAX_MISSING_RATIO:
        reasons.append("silhouette_missing_ratio_above_maximum")
    if any(value > MAX_BBOX_DRIFT_PX for value in bbox_drift):
        reasons.append("silhouette_bbox_drift")

    metrics: dict[str, float | list[int]] = {
        "iou": float(iou),
        "outsideRatio": float(outside_ratio),
        "missingRatio": float(missing_ratio),
        "canonicalVisiblePixels": float(canonical_count),
        "candidateVisiblePixels": float(candidate_count),
        "canonicalBBox": list(canonical_bbox),
        "candidateBBox": list(candidate_bbox),
        "bboxDrift": bbox_drift,
    }

    unique = tuple(dict.fromkeys(reasons))
    return SilhouetteVerificationResult(
        "PASS" if not unique else "REFUSE",
        unique,
        metrics,
    )
