from __future__ import annotations

from tools.hd_iso.generative.compositor import (
    normalize_candidate_rgba,
    composite_with_canonical_regions,
)


def _rgba(width: int, height: int, value) -> list[list[tuple[int, int, int, int]]]:
    return [[tuple(value) for _ in range(width)] for _ in range(height)]


def _mask(width: int, height: int, x0: int, y0: int, x1: int, y1: int):
    return [
        [x0 <= x < x1 and y0 <= y < y1 for x in range(width)]
        for y in range(height)
    ]


def test_normalization_always_produces_exact_512_canvas():
    src = _rgba(7, 5, (120, 80, 40, 255))
    out = normalize_candidate_rgba(src, width=512, height=512)

    assert len(out) == 512
    assert all(len(row) == 512 for row in out)


def test_normalization_is_deterministic():
    src = _rgba(9, 6, (100, 120, 140, 255))
    a = normalize_candidate_rgba(src, width=32, height=32)
    b = normalize_candidate_rgba(src, width=32, height=32)

    assert a == b


def test_compositor_uses_canonical_alpha_not_candidate_alpha():
    width = height = 8
    candidate = _rgba(width, height, (200, 100, 50, 255))

    silhouette = _mask(width, height, 2, 2, 6, 6)
    regions = {"walls": silhouette}

    out = composite_with_canonical_regions(
        candidate,
        canonical_silhouette=silhouette,
        canonical_regions=regions,
    )

    for y in range(height):
        for x in range(width):
            expected_alpha = 255 if silhouette[y][x] else 0
            assert out[y][x][3] == expected_alpha


def test_pixels_outside_canonical_silhouette_are_destroyed():
    width = height = 8
    candidate = _rgba(width, height, (255, 0, 0, 255))

    silhouette = _mask(width, height, 2, 2, 6, 6)
    regions = {"walls": silhouette}

    out = composite_with_canonical_regions(
        candidate,
        canonical_silhouette=silhouette,
        canonical_regions=regions,
    )

    assert out[0][0] == (0, 0, 0, 0)
    assert out[3][3] == (255, 0, 0, 255)


def test_region_compositor_cannot_invent_unowned_structure():
    width = height = 8
    candidate = _rgba(width, height, (220, 120, 30, 255))

    walls = _mask(width, height, 1, 2, 7, 7)
    roof = _mask(width, height, 1, 1, 7, 3)
    silhouette = [
        [walls[y][x] or roof[y][x] for x in range(width)]
        for y in range(height)
    ]

    # Only canonical regions are legal. Candidate pixels elsewhere must die.
    out = composite_with_canonical_regions(
        candidate,
        canonical_silhouette=silhouette,
        canonical_regions={
            "walls": walls,
            "roof": roof,
        },
    )

    assert out[0][0] == (0, 0, 0, 0)
    assert out[7][7] == (0, 0, 0, 0)


def test_overlapping_canonical_regions_remain_deterministic():
    width = height = 8
    candidate = _rgba(width, height, (10, 20, 30, 255))

    walls = _mask(width, height, 1, 2, 7, 7)
    roof = _mask(width, height, 1, 1, 7, 4)
    silhouette = [
        [walls[y][x] or roof[y][x] for x in range(width)]
        for y in range(height)
    ]

    a = composite_with_canonical_regions(
        candidate,
        canonical_silhouette=silhouette,
        canonical_regions={"walls": walls, "roof": roof},
    )
    b = composite_with_canonical_regions(
        candidate,
        canonical_silhouette=silhouette,
        canonical_regions={"roof": roof, "walls": walls},
    )

    assert a == b
