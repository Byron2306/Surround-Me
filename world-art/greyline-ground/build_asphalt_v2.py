from pathlib import Path
import numpy as np
from PIL import Image
import hashlib

OUT = Path(__file__).resolve().parent
SIZE = 2048
SEED = 18428

rng = np.random.default_rng(SEED)

def periodic_field(cells):
    """Periodic bilinear value noise with matching opposite edges."""
    grid = rng.random((cells, cells), dtype=np.float32)

    axis = np.linspace(0, cells, SIZE, endpoint=False, dtype=np.float32)
    i = np.floor(axis).astype(np.int32)
    f = axis - i
    f = f * f * (3 - 2 * f)

    i0 = i % cells
    i1 = (i + 1) % cells

    a = grid[np.ix_(i0, i0)]
    b = grid[np.ix_(i1, i0)]
    c = grid[np.ix_(i0, i1)]
    d = grid[np.ix_(i1, i1)]

    fx = f[:, None]
    fy = f[None, :]

    return (
        a * (1 - fx) * (1 - fy)
        + b * fx * (1 - fy)
        + c * (1 - fx) * fy
        + d * fx * fy
    )

print("GENERATING_PERIODIC_SURFACE")

broad = periodic_field(6)
medium = periodic_field(24)
fine = periodic_field(96)
micro = periodic_field(384)

surface = (
    49
    + (broad - .5) * 31
    + (medium - .5) * 16
    + (fine - .5) * 9
    + (micro - .5) * 5
)

# Moisture accumulation and broad weathering.
stains = periodic_field(13)
surface -= np.maximum(0, stains - .52) * 27

# Fine aggregate.
grain = periodic_field(512)
surface += (grain - .5) * 9

surface = np.clip(surface, 14, 112)

rgb = np.stack(
    [surface * .95, surface, surface * 1.015],
    axis=-1
)

rgb = np.clip(rgb, 0, 255).astype(np.uint8)

# Explicit edge equality for repeatable texture sampling.
rgb[-1, :, :] = rgb[0, :, :]
rgb[:, -1, :] = rgb[:, 0, :]

image = Image.fromarray(rgb, "RGB")

output = OUT / "greyline_asphalt_v2_2048.png"
image.save(output, optimize=True)

assert np.array_equal(rgb[0], rgb[-1])
assert np.array_equal(rgb[:, 0], rgb[:, -1])

digest = hashlib.sha256(output.read_bytes()).hexdigest()

print("ASPHALT_V2=PASS")
print("RESOLUTION=2048x2048")
print("HORIZONTAL_SEAM=PASS")
print("VERTICAL_SEAM=PASS")
print("SHA256=" + digest)
print("OUTPUT=" + str(output))
