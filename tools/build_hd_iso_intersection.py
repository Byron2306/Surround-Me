from __future__ import annotations

import argparse
import math
import random
from pathlib import Path
from PIL import Image, ImageDraw, ImageEnhance

MASTER_SIZE = (2048, 2048)
RUNTIME_SIZE = (1024, 1024)
SEED = 23022026


def _iso_xy(cx: float, top_y: float, half_w: float, half_h: float, u: float, v: float):
    return (
        cx + (u - v) * (half_w / 2),
        top_y + half_h + (u + v) * (half_h / 2),
    )


def build_intersection(asphalt_path: Path, master_path: Path, runtime_path: Path) -> None:
    src = Image.open(asphalt_path).convert("RGBA")
    w, h = MASTER_SIZE
    cx = w // 2

    # Flat ground assets use bottom-centre world contact. Fill the full canonical
    # width so a 4x4-tile diamond projects to the renderer's full logical width,
    # and terminate its bottom point exactly at y=2048. This avoids transparent
    # padding changing apparent world placement or scale.
    top_y = 1024
    half_w = 1024
    half_h = 512
    diamond = [
        (cx, top_y),
        (cx + half_w, top_y + half_h),
        (cx, top_y + 2 * half_h),
        (cx - half_w, top_y + half_h),
    ]

    canvas = Image.new("RGBA", MASTER_SIZE, (0, 0, 0, 0))
    mask = Image.new("L", MASTER_SIZE, 0)
    ImageDraw.Draw(mask).polygon(diamond, fill=255)

    tex = src.resize((2048, 1024), Image.Resampling.LANCZOS)
    rgb = tex.convert("RGB")
    rgb = ImageEnhance.Color(rgb).enhance(0.72)
    rgb = ImageEnhance.Contrast(rgb).enhance(1.08)
    rgb = ImageEnhance.Brightness(rgb).enhance(0.88)
    tex = rgb.convert("RGBA")

    ground = Image.new("RGBA", MASTER_SIZE, (0, 0, 0, 0))
    ground.alpha_composite(tex, (0, top_y))
    ground.putalpha(mask)
    canvas = Image.alpha_composite(canvas, ground)

    def iso(u, v):
        return _iso_xy(cx, top_y, half_w, half_h, u, v)

    paint = Image.new("RGBA", MASTER_SIZE, (0, 0, 0, 0))
    pd = ImageDraw.Draw(paint, "RGBA")
    yellow = (202, 183, 82, 180)
    yellow2 = (194, 174, 72, 115)

    for u0, u1, v in [(-1, -.26, -.085), (.26, 1, -.085), (-1, -.26, .085), (.26, 1, .085)]:
        pd.line([iso(u0, v), iso(u1, v)], fill=yellow if v < 0 else yellow2, width=8)
    for v0, v1, u in [(-1, -.26, -.085), (.26, 1, -.085), (-1, -.26, .085), (.26, 1, .085)]:
        pd.line([iso(u, v0), iso(u, v1)], fill=yellow if u < 0 else yellow2, width=8)

    random.seed(11022026)
    wear = Image.new("L", MASTER_SIZE, 0)
    wd = ImageDraw.Draw(wear)
    for _ in range(720):
        x = random.randint(0, w - 1)
        y = random.randint(top_y, h - 1)
        wd.ellipse(
            (x, y, x + random.randint(3, 14), y + random.randint(1, 6)),
            fill=random.randint(90, 210),
        )
    paint.putalpha(Image.composite(Image.new("L", MASTER_SIZE, 0), paint.getchannel("A"), wear))
    canvas = Image.alpha_composite(canvas, paint)

    distress = Image.new("RGBA", MASTER_SIZE, (0, 0, 0, 0))
    dd = ImageDraw.Draw(distress, "RGBA")
    patch_layer = Image.new("RGBA", MASTER_SIZE, (0, 0, 0, 0))
    pld = ImageDraw.Draw(patch_layer, "RGBA")
    random.seed(SEED)

    for _ in range(48):
        u = random.uniform(-0.88, 0.88)
        v = random.uniform(-0.88, 0.88)
        length = random.uniform(0.07, 0.22)
        ang = random.choice([0, math.pi / 2, math.pi / 4, -math.pi / 4]) + random.uniform(-0.22, 0.22)
        n = random.randint(5, 9)
        pts = []
        for j in range(n):
            t = j / (n - 1)
            uu = u + math.cos(ang) * length * t + random.uniform(-0.012, 0.012)
            vv = v + math.sin(ang) * length * t + random.uniform(-0.012, 0.012)
            pts.append(iso(uu, vv))
        dd.line(pts, fill=(12, 12, 11, 115), width=random.choice([2, 2, 3]))
        if random.random() < 0.55:
            q = pts[random.randint(1, len(pts) - 2)]
            dd.line(
                [q, (q[0] + random.randint(-20, 20), q[1] + random.randint(-12, 12))],
                fill=(14, 13, 12, 80),
                width=2,
            )

    for _ in range(8):
        u = random.uniform(-0.7, 0.7)
        v = random.uniform(-0.7, 0.7)
        x, y = iso(u, v)
        rx, ry = random.randint(40, 96), random.randint(16, 38)
        poly = []
        for k in range(10):
            a = 2 * math.pi * k / 10
            rr = random.uniform(0.78, 1.16)
            poly.append((x + math.cos(a) * rx * rr, y + math.sin(a) * ry * rr))
        pld.polygon(poly, fill=(38, 37, 34, 80))
        pld.line(poly + [poly[0]], fill=(20, 19, 18, 50), width=2)

    for _ in range(7):
        u = random.uniform(-0.72, 0.72)
        v = random.uniform(-0.72, 0.72)
        x, y = iso(u, v)
        rx, ry = random.randint(28, 68), random.randint(12, 28)
        rim = []
        inner = []
        for k in range(14):
            a = 2 * math.pi * k / 14
            rr = random.uniform(0.82, 1.2)
            rim.append((x + math.cos(a) * rx * rr, y + math.sin(a) * ry * rr))
            rr2 = random.uniform(0.55, 0.8)
            inner.append((x + math.cos(a) * rx * rr2, y + math.sin(a) * ry * rr2))
        dd.polygon(rim, fill=(17, 16, 15, 120))
        dd.polygon(inner, fill=(5, 5, 5, 125))

    for _ in range(32):
        u = random.uniform(-0.82, 0.82)
        v = random.uniform(-0.82, 0.82)
        x, y = iso(u, v)
        rx, ry = random.randint(8, 34), random.randint(3, 14)
        dd.ellipse((x - rx, y - ry, x + rx, y + ry), fill=(18, 16, 13, random.randint(12, 38)))

    for layer in (distress, patch_layer):
        alpha = Image.composite(layer.getchannel("A"), Image.new("L", MASTER_SIZE, 0), mask)
        layer.putalpha(alpha)
        canvas = Image.alpha_composite(canvas, layer)

    edge = Image.new("RGBA", MASTER_SIZE, (0, 0, 0, 0))
    ImageDraw.Draw(edge, "RGBA").line(diamond + [diamond[0]], fill=(7, 7, 7, 80), width=3)
    canvas = Image.alpha_composite(canvas, edge)

    master_path.parent.mkdir(parents=True, exist_ok=True)
    runtime_path.parent.mkdir(parents=True, exist_ok=True)
    canvas.save(master_path, optimize=True)
    canvas.resize(RUNTIME_SIZE, Image.Resampling.LANCZOS).save(runtime_path, "WEBP", quality=93, method=6)


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--asphalt", required=True, type=Path)
    parser.add_argument("--master", required=True, type=Path)
    parser.add_argument("--runtime", required=True, type=Path)
    args = parser.parse_args()
    build_intersection(args.asphalt, args.master, args.runtime)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
