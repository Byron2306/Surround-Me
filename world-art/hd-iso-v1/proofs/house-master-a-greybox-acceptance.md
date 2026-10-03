# House Master A Greybox Acceptance

Status: **PASS**

Template: `house.master.a`  
Structural seed: `18427`  
Target Blender: `4.3.2`

This receipt records the completed deterministic greybox acceptance milestone for House Master A. It covers geometry compilation, validation, Blender scene construction, authoritative render passes, projection adaptation, proof generation, tamper refusal, and repeat-build determinism.

## Frozen projection contract

The game-space projection is the deterministic 2:1 dimetric law:

```text
sx = (X - Y) * 16
sy = (X + Y) * 8
```

The Blender camera remains physically right-handed. The render pipeline explicitly records and applies the frozen projection adapter:

```text
projectionAdapter = mirror_x
```

This converts Blender's horizontal screen handedness into the game's canonical left-handed ground projection before anchor and footprint proof checks are evaluated.

Canonical render dimensions are `512 x 512`.

## Accepted structural truth

```text
template          house.master.a
structural seed   18427
footprint         7.5 x 6.0 m
anchor            [0.5, 1.0]
anchor world      [3.75, 6.0, 0.0] m
door              0.9 x 2.0 m
roof family       gable
ridge axis        X
projection        16/8 px-per-m dimetric
projection adapter mirror_x
```

The compiler and validator preserve the fixed footprint, anchor, facade orientation, opening law, roof-law bounds, and maximum structural envelope. Structural invalidity is fail-closed.

## Determinism receipt

Two independent end-to-end builds were produced from the same template and structural seed:

```bash
python3 -m tools.hd_iso.cli build house.master.a --seed 18427 --out /tmp/house-a-a
python3 -m tools.hd_iso.cli build house.master.a --seed 18427 --out /tmp/house-a-b
python3 tests/hd_iso/test_house_a_golden_proof.py \
  --compare-builds /tmp/house-a-a /tmp/house-a-b
```

Observed result:

```text
PASS: House A real-build determinism murder test
```

Canonical geometry SHA:

```text
sha256:73243c4b90863d432d8b56b444754f335e6fc8807d70c2da168b6a102614a3aa
```

Canonical camera hash:

```text
sha256:754dc1d5bec75ea29af7d216c535511d999d882a1576fd3007f2a3f427e027a9
```

Canonical game-space anchor pixel observed in both builds:

```text
[219.99993896484375, 334.0000457763672]
```

Canonical game-space footprint pixels observed in both builds:

```text
[
  [255.99990844726562, 256.00006103515625],
  [375.9999542236328, 316.00001525878906],
  [279.9999694824219, 364.0000305175781],
  [159.99993896484375, 304.00006103515625]
]
```

These values are within the verifier's dedicated sub-millipixel Blender projection tolerance and correspond to the exact intended logical coordinates after the `mirror_x` adapter.

## Proof and tamper refusal

The golden proof harness passed:

```bash
python3 tests/hd_iso/test_house_a_golden_proof.py
```

Observed result:

```text
PASS: House A golden proof bundle and tamper refusal
```

The proof bundle checks:

- structural footprint
- maximum height envelope
- anchor world position
- door scale
- canonical Blender camera matrix/hash
- explicit projection adapter
- projected footprint pixels
- projected anchor pixel
- render dimensions

The harness also verifies fail-closed refusal for tampering with footprint, height, door scale, anchor position, camera matrix, projection adapter, and render dimensions.

## Pure-Python verification

The HD-ISO tests that do not require Blender's embedded Python were run outside Blender with the Blender-only files excluded.

Observed result:

```text
15 passed in 12.09s
```

## Blender contract verification

The Blender-only tests were run inside Blender 4.3.2.

### Canonical camera

```bash
blender -b --factory-startup --python tests/hd_iso/test_blender_camera_lock.py
```

Observed result:

```text
PASS: canonical Blender camera lock and drift refusal
```

### House A mesh and scene

```bash
blender -b --factory-startup --python tests/hd_iso/test_blender_house_a_mesh.py
```

Observed result:

```text
PASS: House A Blender mesh and canonical scene obey deterministic manifest geometry
```

### Authoritative render passes

```bash
blender -b --factory-startup --python tests/hd_iso/test_blender_render_anchor.py
```

Observed result:

```text
PASS: authoritative Blender render passes and anchor metadata
```

The authoritative render path produced the required outputs:

```text
beauty.png
silhouette.png
object-id.png
depth.exr
normals.exr
scene-manifest.json
```

The target environment uses CPU-only Cycles with denoising disabled as the authoritative proof renderer.

## End-to-end build acceptance

The one-shot production path was executed:

```bash
python3 -m tools.hd_iso.cli build house.master.a --seed 18427
```

Observed terminal receipt:

```json
{"geometry":"/root/Surround-Me/build/hd-iso/house.master.a/geometry.json","output":"/root/Surround-Me/build/hd-iso/house.master.a","proof":"/root/Surround-Me/build/hd-iso/house.master.a/proof","render":"/root/Surround-Me/build/hd-iso/house.master.a/render","status":"PASS","structuralSeed":18427,"templateId":"house.master.a"}
```

This confirms the complete governed path:

```text
compile -> validate -> Blender scene -> authoritative render -> projection adapter -> prove -> PASS
```

## Repository hygiene

```bash
git diff --check
```

completed with no output, therefore no whitespace errors were reported.

## Acceptance decision

**PASS.** House Master A Greybox satisfies the deterministic geometry, camera, render, projection, proof, tamper-refusal, and repeat-build acceptance contract for this milestone.

This acceptance covers the deterministic greybox system only. It does not yet approve material authoring, grime/surface synthesis, architectural dressing, AI appearance variation, lot dressing, or final production art. Those stages remain downstream and must preserve the frozen geometry/projection laws recorded here.
