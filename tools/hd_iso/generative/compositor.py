from __future__ import annotations


Pixel = tuple[int, int, int, int]
Image = list[list[Pixel]]
Mask = list[list[bool]]


def _shape(image) -> tuple[int, int]:
    if not isinstance(image, list) or not image:
        raise ValueError("image must be a non-empty list of rows")
    if not all(isinstance(row, list) for row in image):
        raise ValueError("image rows must be lists")
    width = len(image[0])
    if width == 0:
        raise ValueError("image rows must be non-empty")
    if any(len(row) != width for row in image):
        raise ValueError("image rows must have equal width")
    return len(image), width


def normalize_candidate_rgba(
    source: Image,
    *,
    width: int,
    height: int,
) -> Image:
    if width <= 0 or height <= 0:
        raise ValueError("target dimensions must be positive")

    src_h, src_w = _shape(source)

    out: Image = []
    for y in range(height):
        src_y = min(src_h - 1, int((y * src_h) / height))
        row: list[Pixel] = []
        for x in range(width):
            src_x = min(src_w - 1, int((x * src_w) / width))
            pixel = tuple(int(v) for v in source[src_y][src_x])
            if len(pixel) != 4:
                raise ValueError("candidate pixels must be RGBA tuples")
            row.append(pixel)  # type: ignore[arg-type]
        out.append(row)

    return out


def _validate_mask(mask: Mask, *, width: int, height: int, name: str) -> None:
    if not isinstance(mask, list) or len(mask) != height:
        raise ValueError(f"{name} height mismatch")
    for row in mask:
        if not isinstance(row, list) or len(row) != width:
            raise ValueError(f"{name} width mismatch")


def composite_with_canonical_regions(
    candidate: Image,
    *,
    canonical_silhouette: Mask,
    canonical_regions: dict[str, Mask],
) -> Image:
    height, width = _shape(candidate)

    _validate_mask(
        canonical_silhouette,
        width=width,
        height=height,
        name="canonical_silhouette",
    )

    if not isinstance(canonical_regions, dict) or not canonical_regions:
        raise ValueError("canonical_regions must be a non-empty mapping")

    for name in sorted(canonical_regions):
        _validate_mask(
            canonical_regions[name],
            width=width,
            height=height,
            name=f"canonical_region:{name}",
        )

    # Canonical region ownership is the only legal structural authority.
    owned: Mask = [[False for _ in range(width)] for _ in range(height)]
    for name in sorted(canonical_regions):
        mask = canonical_regions[name]
        for y in range(height):
            for x in range(width):
                if mask[y][x]:
                    owned[y][x] = True

    out: Image = []
    for y in range(height):
        row: list[Pixel] = []
        for x in range(width):
            legal = bool(canonical_silhouette[y][x]) and bool(owned[y][x])
            if not legal:
                row.append((0, 0, 0, 0))
                continue

            r, g, b, _a = candidate[y][x]
            row.append((int(r), int(g), int(b), 255))
        out.append(row)

    return out
