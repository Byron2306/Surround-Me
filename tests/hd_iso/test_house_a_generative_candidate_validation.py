from __future__ import annotations

import copy

from tools.hd_iso.generative.validation import (
    validate_generative_candidate_manifest,
    verify_silhouette_masks,
)


GEOMETRY_SHA = "sha256:820ca6b7bcd774eb93c2ad3bcb93567a8a42bde484d7d1e4a71e9cc6bd9104a1"
DETAIL_SHA = "sha256:e2f1d4ac85cef2b32db76c424fd11988cf8912afb452b593aeaae81c416308e4"
SURFACE_SHA = "sha256:c32c73d9d82d624f07186089e03e5c029f33aa338e68f7f90bc243434f84aa1b"
FIDELITY_SHA = "sha256:fb58ca746aab1fa2ad7c4549e6e6efeb279a9ba759b0b91bef581898ece6a596"
CAMERA_HASH = "sha256:754dc1d5bec75ea29af7d216c535511d999d882a1576fd3007f2a3f427e027a9"


def _canonical_candidate() -> dict:
    return {
        "schemaVersion": "hd-iso-generative-candidate-v1",
        "templateId": "house.master.a",
        "sourceGeometrySha256": GEOMETRY_SHA,
        "sourceDetailSha256": DETAIL_SHA,
        "sourceSurfaceSha256": SURFACE_SHA,
        "sourceSurfaceFidelitySha256": FIDELITY_SHA,
        "cameraHash": CAMERA_HASH,
        "projectionAdapter": "mirror_x",
        "width": 512,
        "height": 512,
        "candidateImage": "generated.png",
    }


def test_candidate_manifest_accepts_only_frozen_house_a_parent_chain():
    candidate = _canonical_candidate()
    result = validate_generative_candidate_manifest(candidate)
    assert result.status == "PASS", result.reasons
    assert result.reasons == ()


def test_candidate_manifest_refuses_parent_camera_projection_and_canvas_drift():
    cases = (
        ("sourceGeometrySha256", "sha256:" + "0" * 64, "source_geometry_hash_mismatch"),
        ("sourceDetailSha256", "sha256:" + "0" * 64, "source_detail_hash_mismatch"),
        ("sourceSurfaceSha256", "sha256:" + "0" * 64, "source_surface_hash_mismatch"),
        ("sourceSurfaceFidelitySha256", "sha256:" + "0" * 64, "source_surface_fidelity_hash_mismatch"),
        ("cameraHash", "sha256:" + "0" * 64, "camera_hash_mismatch"),
        ("projectionAdapter", "none", "projection_adapter_mismatch"),
        ("width", 513, "canvas_size_mismatch"),
        ("height", 511, "canvas_size_mismatch"),
    )

    for field, value, reason in cases:
        bad = copy.deepcopy(_canonical_candidate())
        bad[field] = value
        result = validate_generative_candidate_manifest(bad)
        assert result.status == "REFUSE"
        assert reason in result.reasons


def _rect_mask(
    width: int = 32,
    height: int = 32,
    *,
    x0: int = 8,
    y0: int = 8,
    x1: int = 24,
    y1: int = 24,
) -> list[list[bool]]:
    return [
        [x0 <= x < x1 and y0 <= y < y1 for x in range(width)]
        for y in range(height)
    ]


def test_identical_silhouette_passes():
    canonical = _rect_mask()
    candidate = copy.deepcopy(canonical)

    result = verify_silhouette_masks(canonical, candidate)
    assert result.status == "PASS", result
    assert result.metrics["iou"] == 1.0
    assert result.metrics["outsideRatio"] == 0.0
    assert result.metrics["missingRatio"] == 0.0


def test_small_appearance_only_change_inside_silhouette_does_not_affect_geometry_gate():
    # G1.2 receives masks, not RGB. Arbitrary RGB paintover inside an unchanged
    # canonical silhouette must therefore remain geometry-legal.
    canonical = _rect_mask()
    candidate = copy.deepcopy(canonical)

    result = verify_silhouette_masks(canonical, candidate)
    assert result.status == "PASS"


def test_silhouette_expansion_refuses():
    canonical = _rect_mask()
    expanded = _rect_mask(x0=6, y0=6, x1=26, y1=26)

    result = verify_silhouette_masks(canonical, expanded)
    assert result.status == "REFUSE"
    assert (
        "silhouette_iou_below_minimum" in result.reasons
        or "silhouette_outside_ratio_above_maximum" in result.reasons
        or "silhouette_bbox_drift" in result.reasons
    )


def test_silhouette_shrink_refuses():
    canonical = _rect_mask()
    shrunk = _rect_mask(x0=10, y0=10, x1=22, y1=22)

    result = verify_silhouette_masks(canonical, shrunk)
    assert result.status == "REFUSE"
    assert (
        "silhouette_iou_below_minimum" in result.reasons
        or "silhouette_missing_ratio_above_maximum" in result.reasons
        or "silhouette_bbox_drift" in result.reasons
    )


def test_canvas_mismatch_refuses_before_mask_math():
    canonical = _rect_mask(width=32, height=32)
    candidate = _rect_mask(width=31, height=32)

    result = verify_silhouette_masks(canonical, candidate)
    assert result.status == "REFUSE"
    assert "silhouette_canvas_mismatch" in result.reasons
