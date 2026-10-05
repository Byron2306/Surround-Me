# House Master A Surface Fidelity S2 Plan

**Goal:** Raise accepted House A S1 materials from deterministic procedural appearance to high-fidelity directional weathering and microstructure while preserving every accepted geometry, architectural-detail, surface, camera, projection, anchor, and footprint contract.

## Layering

```text
geometry.json
  -> canonical geometry SHA
detail.json
  -> canonical detail SHA
surface.json
  -> canonical surface SHA
surface-fidelity.json
```

S2 does not rewrite `surface.json`.

Accepted parent SHA chain:

```text
geometry  sha256:820ca6b7bcd774eb93c2ad3bcb93567a8a42bde484d7d1e4a71e9cc6bd9104a1
detail    sha256:e2f1d4ac85cef2b32db76c424fd11988cf8912afb452b593aeaae81c416308e4
surface   sha256:c32c73d9d82d624f07186089e03e5c029f33aa338e68f7f90bc243434f84aa1b
```

## Seed contract

```text
structuralSeed = 18427
detailSeed     = 4104
appearanceSeed = 7001
decaySeed      = 9907
fidelitySeed   = 27182
```

The fidelity seed controls shader microstructure only.

It may not alter:
- material family
- base colour
- decay intensities
- glass state
- geometry
- transforms
- camera/projection

## S2.1 deterministic fidelity compiler

Create:
- `tools/hd_iso/surface_fidelity/__init__.py`
- `tools/hd_iso/surface_fidelity/house_a.py`
- `tools/hd_iso/compile_surface_fidelity.py`
- `tests/hd_iso/test_house_a_surface_fidelity_determinism.py`

Manifest schema:

```text
hd-iso-surface-fidelity-v1
```

Required lineage:
- sourceGeometrySha256
- sourceDetailSha256
- sourceSurfaceSha256
- fidelitySeed

Required wall channels:
- microScale
- microStrength
- verticalStreakBias
- lowerWallDirtBias
- crackFrequency
- crackContrast

Required roof channels:
- macroVariationScale
- stainClusterScale
- runoffBias
- edgeWearBias
- mossPatchScale

Required metal channels:
- rustClusterScale
- rustEdgeBias
- runoffBias
- roughnessVariation

Required glass channels:
- hazeScale
- hazeStrength
- streakScale
- streakStrength
- scratchScale

Required trim channels:
- grainScale
- wearEdgeBias
- roughnessVariation

All scalar intensity/bias values remain in [0,1].
All scale values remain within explicit bounded ranges.

## S2.2 fail-closed fidelity validation

Refuse:
- any parent hash mismatch
- wrong seed lineage
- unknown schema/template
- missing or extra channels
- out-of-range values
- structural fields
- displacement fields
- modifier/geometry directives

## S2.3 Blender high-fidelity shader realization

Upgrade existing S1 materials using shader nodes only.

Permitted:
- Noise
- Musgrave-equivalent noise available in Blender 4.3
- Voronoi
- Wave
- ColorRamp
- Mapping/Separate XYZ/Map Range
- Bump node connected to shader Normal

Forbidden:
- material displacement output
- Displace modifier
- Geometry Nodes mutation
- object transforms
- mesh edits

Directional behavior:
- damp/grime weighted toward lower wall areas
- water streaks vertically elongated
- roof staining/runoff aligned downhill in object space
- rust clustered around metal runoff/edge masks
- glass haze and streaks layered rather than uniform noise

## S2.4 production integration

CLI adds:
- `--fidelity-seed`

Emit:
- `surface-fidelity.json`

Production chain:
```text
geometry -> detail -> surface -> surface fidelity
-> Blender revalidation
-> shader realization only
-> beauty + diagnostics
-> proof
```

## S2 acceptance

Require:
- deterministic compiler PASS
- fail-closed validator PASS
- Blender shader graph contract PASS
- before/after mesh vertices and transforms identical
- no displacement/modifier authority present
- two real builds have identical fidelity SHA/receipt
- accepted geometry/detail/surface SHAs unchanged
- full regression PASS
