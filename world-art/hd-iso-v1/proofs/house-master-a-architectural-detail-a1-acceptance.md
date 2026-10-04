# House Master A Architectural Detail A1 Acceptance

Status: **PASS**

Template: `house.master.a`  
Structural seed: `18427`  
Detail seed: `4104`  
Target Blender: `4.3.2`

This receipt records acceptance of the first deterministic architectural-detail layer for House Master A.

A1 extends the already accepted greybox with governed architectural geometry while preserving the frozen structural geometry, camera, projection, anchor, and footprint laws.

## Accepted architectural-detail set

A1 realizes the following deterministic objects:

- explicit front-window geometry from existing opening sockets
- true roof eave extension from `eaveOverhangM`
- front/back fascia
- front gutter
- one deterministic front downpipe
- one bounded porch frame

No material, decay, AI appearance, signage, prop dressing, or lot dressing is accepted by this receipt.

## Structural boundary

The accepted greybox remains authoritative.

Architectural detail consumes `geometry.json` and emits a separate `detail.json`.

The structural layer remains frozen:

```text
template          house.master.a
structural seed   18427
footprint         7.5 x 6.0 m
anchor            [0.5, 1.0]
door              0.9 x 2.0 m
max envelope      4.8 m
ridge axis        X
projection        16/8 px-per-m dimetric
projection adapter mirror_x
render            512 x 512
```

## Geometry hash domains

Exact emitted geometry artifact SHA-256:

```text
sha256:73243c4b90863d432d8b56b444754f335e6fc8807d70c2da168b6a102614a3aa
```

Canonical semantic geometry SHA-256:

```text
sha256:820ca6b7bcd774eb93c2ad3bcb93567a8a42bde484d7d1e4a71e9cc6bd9104a1
```

The architectural-detail manifest chains to the canonical semantic geometry SHA so formatting changes do not alter architectural identity.

## Detail determinism receipt

Two independent real builds were produced using:

```bash
python3 -m tools.hd_iso.cli build house.master.a \
  --seed 18427 \
  --detail-seed 4104 \
  --out /tmp/house-a-detail-a

python3 -m tools.hd_iso.cli build house.master.a \
  --seed 18427 \
  --detail-seed 4104 \
  --out /tmp/house-a-detail-b

python3 tests/hd_iso/test_house_a_golden_proof.py \
  --compare-detail-builds \
  /tmp/house-a-detail-a \
  /tmp/house-a-detail-b
```

Observed result:

```text
PASS: House A architectural-detail determinism murder test
```

Canonical detail SHA-256:

```text
sha256:e2f1d4ac85cef2b32db76c424fd11988cf8912afb452b593aeaae81c416308e4
```

Source canonical geometry SHA-256:

```text
sha256:820ca6b7bcd774eb93c2ad3bcb93567a8a42bde484d7d1e4a71e9cc6bd9104a1
```

Canonical camera hash:

```text
sha256:754dc1d5bec75ea29af7d216c535511d999d882a1576fd3007f2a3f427e027a9
```

Projection adapter:

```text
mirror_x
```

Canonical anchor pixel:

```text
[219.99993896484375, 334.0000457763672]
```

Canonical footprint pixels:

```text
[
  [255.99990844726562, 256.00006103515625],
  [375.9999542236328, 316.00001525878906],
  [279.9999694824219, 364.0000305175781],
  [159.99993896484375, 304.00006103515625]
]
```

## Scene detail receipt

The authoritative scene manifest recorded:

```json
{
  "schemaVersion": "hd-iso-detail-v1",
  "detailSeed": 4104,
  "sourceGeometrySha256": "sha256:820ca6b7bcd774eb93c2ad3bcb93567a8a42bde484d7d1e4a71e9cc6bd9104a1",
  "objectCounts": {
    "windows": 1,
    "fascia": 2,
    "gutter": 1,
    "downpipe": 1,
    "porch": 1
  }
}
```

## Pure-Python validation

The non-Blender HD-ISO suite was run with Blender-only tests excluded.

Observed result:

```text
29 passed in 27.26s
```

This includes:

- greybox geometry determinism
- projection proof
- geometry validation
- CLI integration
- detail determinism
- detail fail-closed validation
- detail production-build integration

## Blender contract verification

### Canonical camera

```bash
blender -b --factory-startup --python tests/hd_iso/test_blender_camera_lock.py
```

Observed:

```text
PASS: canonical Blender camera lock and drift refusal
```

### Frozen greybox mesh contract

```bash
blender -b --factory-startup --python tests/hd_iso/test_blender_house_a_mesh.py
```

Observed:

```text
PASS: House A Blender mesh and canonical scene obey deterministic manifest geometry
```

### Architectural detail geometry

```bash
blender -b --factory-startup --python tests/hd_iso/test_blender_house_a_detail.py
```

Observed:

```text
PASS: House A Blender architectural detail obeys frozen geometry law
```

### Authoritative render passes

```bash
blender -b --factory-startup --python tests/hd_iso/test_blender_render_anchor.py
```

Observed:

```text
PASS: authoritative Blender render passes and anchor metadata
```

## Fail-closed detail validation

The architectural-detail validator refuses:

- source geometry hash mismatch
- structural seed mismatch
- template/schema mismatch
- window socket drift
- eave drift
- invalid fascia dimensions
- gutter span/facade/radius drift
- invalid downpipe facade/side/diameter
- porch facade/style/bounds drift
- porch overflow beyond the governed attachment allowance

Validation occurs both before Blender launch and again inside the Blender scene build path.

## Production path

The accepted production command is:

```bash
python3 -m tools.hd_iso.cli build house.master.a \
  --seed 18427 \
  --detail-seed 4104
```

The governed path is now:

```text
compile geometry
-> validate geometry
-> compile detail
-> validate detail
-> Blender validates detail again
-> build core + detail
-> authoritative render
-> projection proof
-> PASS / REFUSE
```

## Repository hygiene

```bash
git diff --check
```

completed with no output.

## Acceptance decision

**PASS.** House Master A Architectural Detail A1 is accepted as deterministic, geometry-bound, fail-closed architectural structure.

This acceptance does not authorize downstream surface systems to alter geometry law. Materials, weathering, grime, rust, moss, broken glazing, paint damage, roof staining, and related appearance systems must remain subordinate to the accepted greybox and architectural-detail contracts recorded here.
