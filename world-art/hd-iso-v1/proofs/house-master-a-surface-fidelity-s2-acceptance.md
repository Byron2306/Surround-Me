# House Master A Surface Fidelity S2 Acceptance

Status: **PASS**

Template: `house.master.a`  
Structural seed: `18427`  
Detail seed: `4104`  
Appearance seed: `7001`  
Decay seed: `9907`  
Fidelity seed: `27182`  
Target Blender: `4.3.2`

This receipt records acceptance of the deterministic high-fidelity surface layer for House Master A.

S2 is subordinate to the already accepted Greybox, Architectural Detail A1, and Surface/Decay S1 contracts.

## Accepted lineage

```text
geometry.json
  -> canonical geometry SHA
detail.json
  -> canonical detail SHA
surface.json
  -> canonical surface SHA
surface-fidelity.json
```

Accepted canonical geometry SHA-256:

```text
sha256:820ca6b7bcd774eb93c2ad3bcb93567a8a42bde484d7d1e4a71e9cc6bd9104a1
```

Accepted canonical detail SHA-256:

```text
sha256:e2f1d4ac85cef2b32db76c424fd11988cf8912afb452b593aeaae81c416308e4
```

Accepted canonical surface SHA-256:

```text
sha256:c32c73d9d82d624f07186089e03e5c029f33aa338e68f7f90bc243434f84aa1b
```

Accepted canonical surface-fidelity SHA-256:

```text
sha256:fb58ca746aab1fa2ad7c4549e6e6efeb279a9ba759b0b91bef581898ece6a596
```

## Accepted S2 fidelity behavior

For the acceptance seed `27182`, the authoritative scene receipt records:

### Walls

```text
directionalWeathering = true
microScale            = 21.496459
verticalStreakBias    = 0.513059
lowerWallDirtBias     = 0.896263
```

### Roof

```text
directionalWeathering = true
macroVariationScale   = 2.040695
runoffBias            = 0.652238
stainClusterScale     = 9.315918
```

### Metal

```text
rustClustering   = true
rustClusterScale = 4.850084
rustEdgeBias     = 0.785737
runoffBias       = 0.6545
```

### Glass

```text
layeredHaze     = true
hazeScale       = 7.740198
hazeStrength    = 0.212858
streakScale     = 24.214604
streakStrength  = 0.428594
```

### Trim

```text
grainWear    = true
grainScale   = 26.360458
wearEdgeBias = 0.340563
```

## Authority boundary

S2 authorizes shader-node microstructure and directional weathering only.

Permitted mechanisms include:

- Noise textures
- coordinate mapping
- directional coordinate separation
- ColorRamp/Math/Map Range style scalar shaping
- shader roughness variation
- Bump nodes connected to shader normals

S2 does not authorize geometry mutation.

The fidelity layer may not:

- move vertices
- alter object transforms
- add mesh-changing modifiers
- use a Displace modifier
- use Geometry Nodes for shape mutation
- write vertex offsets
- alter footprint
- alter openings
- alter roof geometry
- alter camera
- alter projection
- alter anchor
- connect material displacement output

## Deterministic compiler proof

Observed:

```text
4 passed
```

The compiler proved:

- parent manifests are not mutated
- same parent chain + same fidelity seed is deterministic
- fidelity channels are complete and bounded
- fidelity seed cannot change accepted S1 material truth

## Fail-closed validation proof

Observed combined S2 compiler + validation result:

```text
11 passed in 0.45s
```

The validator refuses:

- source geometry hash mismatch
- source detail hash mismatch
- source surface hash mismatch
- seed lineage mismatch
- schema/template mismatch
- missing channel blocks
- extra channel blocks
- missing parameters
- extra parameters
- unit values outside [0,1]
- scale values outside declared ranges
- forbidden structural fields
- displacement authority
- modifier authority
- Geometry Nodes authority
- vertex-offset authority

## Blender immutability proof

Observed:

```text
PASS: House A Blender surface fidelity preserves frozen geometry and forbids displacement
```

The Blender test snapshots:

- all mesh transforms
- all mesh vertex coordinates
- all mesh modifier names
- canonical camera matrix

before fidelity application and verifies they are identical afterward.

The test additionally confirms:

- no fidelity material connects Material Output displacement
- wall and roof fidelity graphs include directional coordinate logic
- fidelity materials use bump rather than displacement
- metal includes deterministic rust clustering
- glass includes layered haze/streak microstructure
- trim includes deterministic grain/wear microstructure

## Production integration proof

Accepted production command:

```bash
python3 -m tools.hd_iso.cli build house.master.a \
  --seed 18427 \
  --detail-seed 4104 \
  --appearance-seed 7001 \
  --decay-seed 9907 \
  --fidelity-seed 27182
```

Observed production result:

```text
status = PASS
```

The authoritative build emits:

```text
geometry.json
detail.json
surface.json
surface-fidelity.json
render/
proof/
```

The scene manifest records a `surfaceFidelity` receipt containing:

- schemaVersion
- fidelitySeed
- sourceGeometrySha256
- sourceDetailSha256
- sourceSurfaceSha256
- fidelity role evidence

## Two-build determinism proof

Two independent real builds were produced with identical structural, detail, appearance, decay, and fidelity seeds.

Observed:

```text
PASS: House A surface fidelity determinism murder test
```

The comparator verified:

- canonical `surface-fidelity.json`
- canonical surface-fidelity SHA
- accepted source geometry SHA
- accepted source detail SHA
- accepted source surface SHA
- scene fidelity receipt
- accepted S1 surface receipt
- accepted A1 detail receipt
- camera hash
- projection adapter
- anchor
- footprint projection
- canonical proof output

## Canonical runtime evidence

Camera hash:

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

## Full regression

Normal Python HD-ISO suite:

```text
54 passed in 50.09s
```

Blender regression:

```text
PASS: canonical Blender camera lock and drift refusal
PASS: House A Blender mesh and canonical scene obey deterministic manifest geometry
PASS: House A Blender architectural detail obeys frozen geometry law
PASS: House A Blender surface application preserves frozen geometry
PASS: House A Blender surface fidelity preserves frozen geometry and forbids displacement
PASS: authoritative Blender render passes and anchor metadata
```

Repository hygiene:

```text
git diff --check
(no output)
```

## Acceptance decision

**PASS.** House Master A Surface Fidelity S2 is accepted as deterministic, parent-bound, fail-closed high-fidelity material DNA.

The accepted doctrine remains:

> Structure first, architecture detail second, surface beauty third.

S2 may weather the pixels, roughen the light, dirty the glass, age the trim, and scar the material response.

It may not rewrite the house.
