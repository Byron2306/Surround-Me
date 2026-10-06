from __future__ import annotations

from tools.hd_iso.generative.compositor import align_candidate_to_canonical_bbox


def _rgba(width: int, height: int, rgba=(0, 0, 0, 0)):
    return [[tuple(rgba) for _ in range(width)] for _ in range(height)]


def _mask(width: int, height: int, x0: int, y0: int, x1: int, y1: int):
    return [
        [x0 <= x < x1 and y0 <= y < y1 for x in range(width)]
        for y in range(height)
    ]


def test_alignment_fits_source_alpha_bbox_into_canonical_bbox():
    src = _rgba(20, 20)
    for y in range(5, 15):
        for x in range(4, 16):
            src[y][x] = (120, 90, 60, 255)

    canonical = _mask(32, 32, 8, 10, 24, 26)

    out = align_candidate_to_canonical_bbox(
        src,
        canonical_silhouette=canonical,
        width=32,
        height=32,
    )

    visible = [
        (x, y)
        for y, row in enumerate(out)
        for x, pixel in enumerate(row)
        if pixel[3] > 0
    ]

    xs = [x for x, _ in visible]
    ys = [y for _, y in visible]

    assert min(xs) >= 8
    assert max(xs) <= 23
    assert min(ys) >= 10
    assert max(ys) <= 25


def test_alignment_is_deterministic():
    src = _rgba(10, 10)
    for y in range(2, 8):
        for x in range(1, 9):
            src[y][x] = (10, 20, 30, 255)

    canonical = _mask(20, 20, 4, 5, 16, 17)

    a = align_candidate_to_canonical_bbox(
        src,
        canonical_silhouette=canonical,
        width=20,
        height=20,
    )
    b = align_candidate_to_canonical_bbox(
        src,
        canonical_silhouette=canonical,
        width=20,
        height=20,
    )

    assert a == b


def test_alignment_refuses_empty_source_alpha():
    src = _rgba(8, 8)
    canonical = _mask(16, 16, 4, 4, 12, 12)

    try:
        align_candidate_to_canonical_bbox(
            src,
            canonical_silhouette=canonical,
            width=16,
            height=16,
        )
    except ValueError as exc:
        assert str(exc) == "candidate_alpha_empty"
    else:
        raise AssertionError("expected empty candidate alpha to refuse")
