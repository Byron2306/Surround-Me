# Surround Me Deterministic 3D Geometry Generator

**Date:** 2026-10-02  
**Status:** Design approved in conversation  
**Target environment:** Termux -> PRoot Debian -> Blender headless  
**Branch:** `phase-a/master-template-dna`

## 1. Purpose

Surround Me needs a deterministic 3D asset-generation subsystem that makes projection, footprint, scale, anchor position, and human proportions non-negotiable. The existing large town renders remain the visual north star for atmosphere, material richness, urban decay, and district vocabulary, but they must not determine geometry.

The core problem being solved is repeated failure of otherwise beautiful generated isometric assets to conform exactly to the game world's geometry. Prompting alone cannot guarantee camera matrices, physical dimensions, footprint occupancy, anchor placement, or consistent scale. Those constraints must therefore move out of image generation and into code.

The system must make it impossible for an asset to enter production merely because it looks convincing. A master asset is accepted only when it proves that it belongs to the same physical world as every other approved asset.

## 2. Architectural Principle

The pipeline is split into hard law and soft appearance.

### Hard law

Hard law is deterministic and code-owned:

- world-space dimensions
- ground footprint
- physical height envelope
- world origin
- ground-contact anchor
- facade orientation
- door and window scale
- legal attachment volumes
- projection transform
- Blender camera transform
- render scale
- output metadata

### Soft appearance

Soft appearance may vary within bounded parameters:

- material family
- paint colour
- grime
- dust
- moss and mildew
- roof wear
- water staining
- rust
- broken glazing
- boarding
- signage
- local attachments
- surface damage

Appearance systems may not alter geometry law.

## 3. Target Runtime Architecture

The implementation uses a hybrid deterministic architecture:

1. Pure Python owns template DNA, numerical geometry contracts, deterministic seeds, validation, and proof metadata.
2. A Blender adapter consumes the validated geometry description and constructs the authoritative mesh.
3. Blender headless inside PRoot Debian performs authoritative rendering and render-pass generation.
4. Proof tooling validates geometry and projection before an asset can be promoted.

Pure-Python geometry validation must remain runnable without Blender so Termux and CI can test structural truth independently.

## 4. Projection Contract

Surround Me uses a 2:1 orthographic dimetric game projection.

Canonical runtime values:

- logical tile size: `64 x 32 px`
- world tile size: `2.0 m x 2.0 m`
- closest normal zoom: `2.0625`
- perspective drift: forbidden
- per-asset camera variation: forbidden
- per-asset geometry scaling after render: forbidden

For world-space metres on the ground plane:

```text
screenX = (worldX - worldY) * 16
screenY_ground = (worldX + worldY) * 8
```

Vertical world Z is projected through one globally frozen vertical scale derived from the canonical camera and Aliza calibration. Zoom is applied after projection and does not alter geometry.

The Blender camera must reproduce the same screen-space basis as the game renderer. The camera is authoritative and immutable once calibrated.

### Coordinate convention

```text
+X = world southeast
+Y = world southwest
+Z = up
```

Each asset class has a fixed facade orientation relative to this world basis.

## 5. Rendering Contract

Sprites are not fitted to geometry after rendering.

Each master is rendered from a known world origin under the canonical camera. The projected anchor pixel is deterministic and emitted as metadata.

At runtime:

```text
world position
-> game projection
-> anchor pixel
-> draw sprite at native authoritative scale
```

The runtime renderer must not repair bad masters by stretching or shrinking them to match a declared footprint.

## 6. Master Template DNA

The existing master-template DNA remains the source of class-level geometry law.

Initial approved classes:

### House Master A

- template id: `house.master.a`
- class: small detached suburban house
- footprint: `3.75 x 3.0 tiles`
- physical size: `7.5 x 6.0 m`
- nominal maximum envelope: `4.8 m`
- storeys: `1`
- anchor: `[0.5, 1.0]`
- reference door height: `2.0 m`

### Corner Shop Master A

- template id: `shop.corner.master.a`
- footprint: `3.0 x 2.0 tiles`
- physical size: `6.0 x 4.0 m`
- nominal height: `5.5 m`
- storeys: `2`
- anchor: `[0.5, 1.0]`

### Sedan Master A

- template id: `sedan.master.a`
- footprint: `2.25 x 0.9 tiles`
- physical size: `4.5 x 1.8 m`
- nominal height: `1.5 m`
- anchor: `[0.5, 1.0]`

The first implementation milestone covers House Master A only.

## 7. House Master A Geometry Grammar

Version 1 deliberately starts with a small deterministic structural grammar.

### Immutable core

- foundation: exactly `7.5 x 6.0 m`
- canonical origin
- fixed facade orientation
- fixed anchor
- maximum height envelope: `4.8 m`
- one-storey wall shell
- gabled roof family only
- human-scaled openings

### Structural parameters

Structural parameters are legal only inside declared ranges.

Example roof grammar:

```text
roof_type: gable
roof_pitch_degrees: 26..38
ridge_axis: X
eave_overhang_m: 0.25..0.45
```

Example door grammar:

```text
width_m: 0.90
height_m: 2.00
facade: FRONT
lateral_position: 0.28..0.72
```

Example window grammar:

```text
front_windows.count: 1..3
sill_height_m: 0.85..1.05
height_m: 1.10..1.40
width_m: 0.80..1.50
```

All structural mutations must pass collision, wall-boundary, corner-clearance, roof-envelope, and human-scale validation before Blender is invoked.

### Porch

The porch is a separate governed attachment, not part of the immutable foundation law.

It may occupy only a declared front-facade allowance zone. It may never silently enlarge or redefine the canonical footprint.

### Other attachments

Potential governed attachments include:

- chimney
- gutters
- downpipes
- porch rail
- electrical meter
- vents
- AC unit
- satellite dish

Every attachment must use a named socket and legal bounding volume.

## 8. Deterministic Seeds

All legal variants are deterministic.

A variant is reproduced from:

```text
template_id + structural_seed + appearance_seed + decay_seed
```

Same inputs must produce the same geometry manifest and geometry hash.

District generation can later reconstruct a district from district seed plus template and variant seeds.

Structural families remain explicit rather than infinitely stretchable. For example:

- House Master A: small detached bungalow
- House Master B: narrow suburban cottage
- House Master C: larger family home
- House Master D: duplex / semi-detached

This avoids procedural architectural drift.

## 9. Blender Scene Contract

There is one canonical reusable Blender scene containing shared immutable infrastructure only:

- canonical orthographic camera
- world lighting rig
- transparent film configuration
- render-engine settings
- neutral proof materials
- material node library
- render-pass configuration
- output configuration

The `.blend` file must contain no authoritative building geometry. Geometry is generated fresh from the validated manifest every build.

The Blender adapter must verify the expected camera transform and refuse rendering if the camera has been manually changed.

## 10. Repository Layout

Proposed repository structure:

```text
world-art/hd-iso-v1/
├── templates/
│   ├── master-template-dna-v1.json
│   └── house-master-a.json
├── geometry/
│   ├── schemas/
│   │   ├── template.schema.json
│   │   └── geometry-output.schema.json
│   └── generated/
│       └── house.master.a/
│           ├── geometry.json
│           ├── sockets.json
│           └── proof.json
├── blender/
│   ├── scenes/
│   │   └── canonical_hd_iso.blend
│   └── generated/
├── masters/
├── runtime/
└── proofs/
```

Code layout:

```text
tools/hd_iso/
├── cli.py
├── compile_geometry.py
├── geometry/
│   ├── projection.py
│   ├── primitives.py
│   ├── house_a.py
│   ├── sockets.py
│   └── validation.py
├── blender/
│   ├── build_scene.py
│   ├── build_mesh.py
│   ├── camera.py
│   ├── lighting.py
│   ├── materials.py
│   └── render_passes.py
└── proof/
    ├── verify_geometry.py
    ├── verify_projection.py
    └── calibration_card.py
```

## 11. CLI Contract

Primary commands:

```bash
python -m tools.hd_iso.cli compile house.master.a
python -m tools.hd_iso.cli validate house.master.a
python -m tools.hd_iso.cli render house.master.a
python -m tools.hd_iso.cli prove house.master.a
python -m tools.hd_iso.cli build house.master.a
```

`build` is the normal production path:

```text
compile
-> validate geometry
-> invoke Blender headless
-> render proof passes
-> verify projection
-> generate calibration card
-> PASS / REFUSE
```

Authoritative Blender invocation is conceptually:

```bash
blender -b \
  world-art/hd-iso-v1/blender/scenes/canonical_hd_iso.blend \
  --python tools/hd_iso/blender/build_scene.py \
  -- \
  --template house.master.a
```

The implementation may wrap this invocation while preserving the same separation of responsibilities.

## 12. Build Outputs

A successful House Master A build should emit:

```text
build/hd-iso/house.master.a/
├── mesh.glb
├── geometry.json
├── scene-manifest.json
├── beauty.png
├── silhouette.png
├── object-id.png
├── depth.exr
├── normals.exr
├── calibration.png
├── proof.json
└── sha256sums.txt
```

The proof file must provide explicit PASS/REFUSE results for geometry, projection, human scale, image integrity, and determinism.

Example shape:

```json
{
  "template": "house.master.a",
  "status": "PASS",
  "geometry": {
    "footprint": "PASS",
    "height": "PASS",
    "anchor": "PASS",
    "door_scale": "PASS"
  },
  "projection": {
    "camera": "PASS",
    "footprint_pixels": "PASS",
    "anchor_pixel": "PASS"
  },
  "determinism": {
    "geometry_hash": "sha256:...",
    "scene_hash": "sha256:..."
  }
}
```

Any failed required gate makes overall status `REFUSE`.

## 13. Geometry Proof Renders

Every authoritative render emits a calibration image from the same mesh and camera used for the beauty render.

The calibration image automatically overlays:

- projected footprint vertices
- ground anchor
- projected 2 m grid
- Aliza reference
- 2 m door reference
- roof envelope
- declared dimensions
- projected object bounds

No image model creates the calibration instrument.

The purpose is to guarantee that the object and ruler share the same mathematical source of truth.

## 14. Validation Rules

### Exact or zero-tolerance fields

These are exact numerical contracts:

- template identity
- physical footprint dimensions
- canonical origin
- anchor definition
- facade world orientation
- camera transform
- projection type
- world tile size
- declared door height
- deterministic geometry hash for identical inputs

### Raster tolerance fields

Small tolerance is allowed only where rasterization requires it, for example:

- anti-aliased silhouette edge: typically +/- 1 px
- projected mask edge comparison where sampling introduces subpixel effects

Raster tolerance must never be used to excuse incorrect world geometry.

## 15. Provenance

Every authoritative build records:

- template DNA hash
- generator version
- Python version
- Blender version
- structural seed
- appearance seed
- decay seed
- geometry hash
- camera matrix hash
- render-settings hash
- build timestamp

This makes later changes auditable and allows exact structural comparisons across versions.

## 16. Test Strategy

### Tier 1: Pure Python

Fast tests runnable without Blender:

- `test_house_a_dimensions.py`
- `test_house_a_footprint.py`
- `test_house_a_anchor.py`
- `test_house_a_door_scale.py`
- `test_house_a_determinism.py`
- `test_projection_transform.py`
- socket and collision tests
- schema validation tests

### Tier 2: Blender contract

Headless Blender tests in PRoot Debian:

- `test_blender_camera_lock.py`
- `test_blender_house_a_mesh.py`
- `test_blender_render_anchor.py`
- render-pass existence and dimension checks

### Tier 3: Golden proof

Render the same House Master A inputs twice and compare:

- geometry hash identical
- projected footprint identical
- anchor identical
- camera transform identical
- output dimensions identical

Full beauty-image pixel hashing is not the source of geometry truth because render-engine and platform changes may produce benign pixel differences. Structural and projection proof remain authoritative.

## 17. Visual Language From the Town References

The earlier massive town generations remain visual references for:

- realistic abandoned modern-city density
- muted and dirty palette
- roof staining
- masonry variation
- deteriorated siding
- cracked and repaired surfaces
- dust and grime accumulation
- rooftop utility detail
- residential/commercial/industrial distinction
- close-camera material richness

They do not define building geometry.

The initial visual material dialects are:

### Residential

- weathered timber/siding
- brick
- shingles or tiles
- gutters and downpipes
- domestic mildew and water staining

### Commercial / civic

- stained masonry
- painted concrete
- storefront glazing
- faded sign ghosts
- rooftop HVAC

### Industrial

- corrugated metal
- rust
- soot
- concrete
- vents and pipes
- heavy runoff staining

## 18. Material and Decay Architecture

The system uses reusable deterministic Blender node groups, initially including:

- `MAT_DECAY_WOOD`
- `MAT_DECAY_BRICK`
- `MAT_DECAY_CONCRETE`
- `MAT_DECAY_METAL`
- `MAT_DECAY_GLASS`
- `MAT_DECAY_ASPHALT`

Example deterministic appearance parameters:

```text
grime_seed
grime_strength
water_streak_strength
paint_loss
moss_amount
roughness_variation
edge_wear
colour_fade
```

Decay is layered rather than allowed to redefine core geometry:

```text
base material
-> age
-> water damage
-> grime
-> moss / mildew
-> broken glazing / boarding
-> rust
-> local debris attachments
```

The first proof milestone does not implement artistic materials. It uses neutral grey proof materials only.

## 19. Relationship to Generative AI

Generative image systems are explicitly removed from structural authority.

Future AI use may include:

- texture ideation
- material-map assistance
- signage concepts
- surface-detail generation
- reference synthesis

AI may not control:

- camera
- footprint
- anchor
- physical scale
- structural envelope
- world orientation

A generated visual asset cannot bypass deterministic proof.

## 20. First Implementation Milestone

### House Master A Greybox Proof

This is the only initial implementation target.

Required deliverables:

- deterministic `7.5 x 6.0 m` foundation
- one-storey wall shell
- deterministic gable roof
- total envelope at or below `4.8 m`
- one exact `2.0 m` reference door
- canonical window sockets
- governed porch allowance
- canonical origin
- canonical anchor
- canonical Blender camera
- Aliza scale reference
- transparent greybox render
- silhouette pass
- calibration proof render
- geometry manifest
- proof manifest
- PASS/REFUSE result

Explicitly excluded from this milestone:

- AI appearance generation
- final grime materials
- broad procedural variant generation
- district generation
- shop and sedan implementation
- production road family integration

## 21. Promotion Gate

House Master A is promoted only when:

1. pure-Python geometry tests pass;
2. Blender constructs the mesh from the manifest with no manual geometry edits;
3. the canonical camera contract passes;
4. projected footprint aligns with the game grid;
5. anchor projection is exact;
6. Aliza and the 2 m door establish believable human scale;
7. repeated identical builds yield the same geometry hash;
8. calibration proof reports `PASS`.

Until then the asset remains unapproved regardless of visual quality.

## 22. Production Ladder After Greybox Approval

Once the first greybox proof passes:

```text
geometry correctness
-> seeded structural variation
-> deterministic material families
-> deterministic decay layers
-> governed attachments
-> beauty render proof
-> additional master classes
-> district grammar
```

The city asset factory therefore grows from a proven physical substrate rather than from prompt-generated pictures.

## 23. Design Summary

The deterministic 3D geometry generator replaces prompt conformity with enforced conformity.

The governing rule is:

> **Randomize appearance, not geometry law.**

Geometry comes from code. Blender renders through one frozen world camera. Every master proves its footprint, anchor, scale, and projection before production acceptance. The large Surround Me town references then contribute their visual richness on top of that physical truth without being allowed to corrupt it.
