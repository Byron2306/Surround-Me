# House Master A Surface and Decay DNA S1 Plan

**Goal:** Add a deterministic surface/material/decay layer to accepted House Master A geometry and architectural detail without changing geometry, sockets, camera, projection, or architectural-detail placement.

## Layering contract

```text
geometry.json
  -> canonical geometry SHA
detail.json
  -> canonical detail SHA
surface.json
```

`surface.json` is subordinate to both parent manifests.

It records:
- `sourceGeometrySha256`
- `sourceDetailSha256`
- `appearanceSeed`
- `decaySeed`

Any parent hash mismatch is REFUSE.

## S1 scope

S1 is procedural/material-only. It may select and parameterize:

- wall material family: `PLASTER`, `PAINTED_MASONRY`, `BRICK`
- roof material family: `WEATHERED_METAL`, `ASPHALT_SHINGLE`, `CLAY_TILE`
- trim material family
- metal family for gutter/downpipe
- glass state: `DIRTY_INTACT`, `CRACKED`, `BOARDED`
- wall base colour within a bounded muted palette
- roof base colour within a bounded muted palette
- paint wear intensity
- cracked plaster intensity
- damp streak intensity
- grime intensity
- moss/mildew intensity
- rust intensity
- foundation dirt-band intensity
- gutter staining intensity
- roof staining intensity
- glass dirt intensity

S1 may not:
- move, add, delete, or scale mesh vertices
- alter core or detail object transforms
- alter openings
- alter camera/projection
- alter render dimensions
- alter anchor/footprint
- introduce signage, props, vegetation geometry, debris, or lot dressing
- invoke image generation

## Determinism

Same:
- geometry manifest
- detail manifest
- appearance seed
- decay seed

must produce byte-identical canonical `surface.json` and identical surface SHA.

Different appearance seeds may change only material family/palette/glass family choices.

Different decay seeds may change only bounded decay intensities and permitted glass damage state.

## Seed contract for House A S1 acceptance

```text
structuralSeed = 18427
detailSeed     = 4104
appearanceSeed = 7001
decaySeed      = 9907
```

## S1.1 deterministic surface compiler

Create:
- `tools/hd_iso/surface/__init__.py`
- `tools/hd_iso/surface/house_a.py`
- `tools/hd_iso/compile_surface.py`
- `tests/hd_iso/test_house_a_surface_determinism.py`

RED first.

Require:
- accepted geometry/detail parents remain unchanged
- source parent hashes embedded
- same seeds produce identical canonical surface JSON/SHA
- all intensities remain in [0,1]
- material families are from bounded enums
- appearance and decay seed responsibilities are separated

## S1.2 fail-closed validation

Create:
- `tools/hd_iso/surface/validation.py`
- `tests/hd_iso/test_house_a_surface_validation.py`

Refuse parent-hash drift, unknown families, invalid palette values, out-of-range decay channels, seed mismatch, or any structural fields appearing in the surface manifest.

## S1.3 Blender material realization

Create:
- `tools/hd_iso/blender/build_surface.py`
- `tests/hd_iso/test_blender_house_a_surface.py`

Apply deterministic procedural node materials to existing mesh objects only.

The Blender test must snapshot object transforms and mesh vertex coordinates before/after surface application and prove byte-equivalent geometry state.

## S1.4 production integration and receipt

Extend the CLI with:
- `--appearance-seed`
- `--decay-seed`

Emit:
- `surface.json`
- surface receipt in `scene-manifest.json`

Build path:
```text
geometry compile/validate
-> detail compile/validate
-> surface compile/validate
-> Blender revalidates detail + surface
-> build existing geometry/detail
-> apply procedural materials only
-> render
-> proof
-> PASS/REFUSE
```

## Acceptance

S1 is accepted only after:
- pure Python surface determinism/validation PASS
- Blender proves surface application does not mutate geometry/transforms
- two real builds with identical four seeds have identical surface SHA and receipts
- existing geometry/detail hashes remain unchanged
- camera/anchor/footprint projection remain unchanged
- full applicable regression suite PASS
