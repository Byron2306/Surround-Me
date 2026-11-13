from pathlib import Path
import numpy as np
from PIL import Image, ImageFilter

OUT = Path(__file__).resolve().parent
SIZE = 2048
SEED = 18428
rng = np.random.default_rng(SEED)

def periodic_noise(grid_size):
    """Generate seamless multiscale noise using wrapped interpolation."""
    values = rng.random((grid_size, grid_size)).astype(np.float32)
    img = Image.fromarray(
        np.uint8(values * 255), "L"
    ).resize((SIZE, SIZE), Image.Resampling.BICUBIC)
    return np.asarray(img, dtype=np.float32) / 255.0

# Broad, medium and fine material variation.
broad = periodic_noise(8)
medium = periodic_noise(32)
fine = periodic_noise(128)

grain = rng.random((SIZE, SIZE), dtype=np.float32)

surface = (
    46
    + (broad - 0.5) * 34
    + (medium - 0.5) * 17
    + (fine - 0.5) * 11
    + (grain - 0.5) * 17
)

# Darker, irregular moisture and contamination patches.
stains = periodic_noise(16)
surface -= np.maximum(0, stains - 0.56) * 31

# Sparse embedded aggregate.
aggregate = grain > 0.985
surface[aggregate] += 17

surface = np.clip(surface, 12, 110)

rgb = np.stack([
    surface * 0.94,
    surface * 0.99,
    surface * 1.01,
], axis=-1)

rgb = np.clip(rgb, 0, 255).astype(np.uint8)

image = Image.fromarray(rgb, "RGB")
image.save(
    OUT / "greyline_asphalt_2048.png",
    optimize=True
)

print("GREYLINE_ASPHALT=BUILT")
print("RESOLUTION=2048x2048")
print("SEED=18428")
print("OUTPUT=" + str(OUT / "greyline_asphalt_2048.png"))
