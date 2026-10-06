from __future__ import annotations

import copy

from tools.hd_iso.generative.validation import verify_structural_regions


def _empty(width: int = 32, height: int = 32) -> list[list[bool]]:
    return [[False for _ in range(width)] for _ in range(height)]


def _rect(
    width: int = 32,
    height: int = 32,
    *,
    x0: int,
    y0: int,
    x1: int,
    y1: int,
) -> list[list[bool]]:
    mask = _empty(width, height)
    for y in range(y0, y1):
        for x in range(x0, x1):
            mask[y][x] = True
    return mask


def _regions() -> dict[str, list[list[bool]]]:
    return {
        "walls": _rect(x0=7, y0=12, x1=25, y1=27),
        "roof": _rect(x0=5, y0=5, x1=27, y1=15),
        "door": _rect(x0=13, y0=19, x1=17, y1=27),
        "windows": _rect(x0=19, y0=16, x1=23, y1=21),
        "porch": _rect(x0=11, y0=18, x1=18, y1=29),
        "fascia": _rect(x0=5, y0=13, x1=27, y1=15),
        "gutter": _rect(x0=5, y0=14, x1=27, y1=16),
        "downpipe": _rect(x0=24, y0=15, x1=26, y1=28),
    }


def test_identical_structural_regions_pass():
    canonical = _regions()
    candidate = copy.deepcopy(canonical)

    result = verify_structural_regions(canonical, candidate)
    assert result.status == "PASS", result
    assert result.reasons == ()
    assert set(result.metrics) == set(canonical)


def test_missing_required_region_refuses():
    canonical = _regions()
    candidate = copy.deepcopy(canonical)
    del candidate["windows"]

    result = verify_structural_regions(canonical, candidate)
    assert result.status == "REFUSE"
    assert "structural_region_set_mismatch" in result.reasons


def test_extra_invented_region_refuses():
    canonical = _regions()
    candidate = copy.deepcopy(canonical)
    candidate["balcony"] = _rect(x0=2, y0=2, x1=6, y1=6)

    result = verify_structural_regions(canonical, candidate)
    assert result.status == "REFUSE"
    assert "structural_region_set_mismatch" in result.reasons


def test_door_translation_refuses_even_when_outer_silhouette_could_match():
    canonical = _regions()
    candidate = copy.deepcopy(canonical)
    candidate["door"] = _rect(x0=17, y0=19, x1=21, y1=27)

    result = verify_structural_regions(canonical, candidate)
    assert result.status == "REFUSE"
    assert (
        "structural_region_iou_below_minimum" in result.reasons
        or "structural_region_bbox_drift" in result.reasons
    )


def test_window_shrink_refuses():
    canonical = _regions()
    candidate = copy.deepcopy(canonical)
    candidate["windows"] = _rect(x0=20, y0=17, x1=22, y1=20)

    result = verify_structural_regions(canonical, candidate)
    assert result.status == "REFUSE"
    assert (
        "structural_region_iou_below_minimum" in result.reasons
        or "structural_region_missing_ratio_above_maximum" in result.reasons
    )


def test_porch_growth_refuses():
    canonical = _regions()
    candidate = copy.deepcopy(canonical)
    candidate["porch"] = _rect(x0=9, y0=17, x1=20, y1=30)

    result = verify_structural_regions(canonical, candidate)
    assert result.status == "REFUSE"
    assert (
        "structural_region_iou_below_minimum" in result.reasons
        or "structural_region_outside_ratio_above_maximum" in result.reasons
        or "structural_region_bbox_drift" in result.reasons
    )


def test_region_canvas_mismatch_refuses():
    canonical = _regions()
    candidate = copy.deepcopy(canonical)
    candidate["roof"] = _rect(width=31, height=32, x0=5, y0=5, x1=27, y1=15)

    result = verify_structural_regions(canonical, candidate)
    assert result.status == "REFUSE"
    assert "structural_region_canvas_mismatch" in result.reasons


def test_small_inside_region_noise_within_tolerance_passes():
    canonical = _regions()
    candidate = copy.deepcopy(canonical)

    # One edge pixel difference in a large wall region is appearance-scale
    # noise, not a structural rewrite.
    candidate["walls"][20][7] = False

    result = verify_structural_regions(canonical, candidate)
    assert result.status == "PASS", result
