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


def _bbox_from_alpha(image: Image, threshold: int = 0) -> tuple[int, int, int, int] | None:
    height, width = _shape(image)
    xs: list[int] = []
    ys: list[int] = []
    for y in range(height):
        for x in range(width):
            if int(image[y][x][3]) > threshold:
                xs.append(x)
                ys.append(y)
    if not xs:
        return None
    return min(xs), min(ys), max(xs), max(ys)


def _bbox_from_mask(mask: Mask) -> tuple[int, int, int, int] | None:
    if not isinstance(mask, list) or not mask:
        return None
    xs: list[int] = []
    ys: list[int] = []
    for y, row in enumerate(mask):
        if not isinstance(row, list):
            return None
        for x, value in enumerate(row):
            if bool(value):
                xs.append(x)
                ys.append(y)
    if not xs:
        return None
    return min(xs), min(ys), max(xs), max(ys)


def align_candidate_to_canonical_bbox(
    source: Image,
    *,
    canonical_silhouette: Mask,
    width: int,
    height: int,
) -> Image:
    if width <= 0 or height <= 0:
        raise ValueError("target dimensions must be positive")

    _shape(source)
    _validate_mask(
        canonical_silhouette,
        width=width,
        height=height,
        name="canonical_silhouette",
    )

    source_bbox = _bbox_from_alpha(source)
    if source_bbox is None:
        raise ValueError("candidate_alpha_empty")

    target_bbox = _bbox_from_mask(canonical_silhouette)
    if target_bbox is None:
        raise ValueError("canonical_silhouette_empty")

    sx0, sy0, sx1, sy1 = source_bbox
    tx0, ty0, tx1, ty1 = target_bbox

    source_w = sx1 - sx0 + 1
    source_h = sy1 - sy0 + 1
    target_w = tx1 - tx0 + 1
    target_h = ty1 - ty0 + 1

    scale = min(target_w / source_w, target_h / source_h)
    scaled_w = max(1, min(target_w, int(round(source_w * scale))))
    scaled_h = max(1, min(target_h, int(round(source_h * scale))))

    offset_x = tx0 + (target_w - scaled_w) // 2
    offset_y = ty0 + (target_h - scaled_h) // 2

    out: Image = [
        [(0, 0, 0, 0) for _ in range(width)]
        for _ in range(height)
    ]

    for dy in range(scaled_h):
        src_y = sy0 + min(
            source_h - 1,
            int((dy * source_h) / scaled_h),
        )
        out_y = offset_y + dy
        if out_y < 0 or out_y >= height:
            continue

        for dx in range(scaled_w):
            src_x = sx0 + min(
                source_w - 1,
                int((dx * source_w) / scaled_w),
            )
            out_x = offset_x + dx
            if out_x < 0 or out_x >= width:
                continue
            pixel = tuple(int(v) for v in source[src_y][src_x])
            if len(pixel) != 4:
                raise ValueError("candidate pixels must be RGBA tuples")
            out[out_y][out_x] = pixel  # type: ignore[assignment]

    return out
