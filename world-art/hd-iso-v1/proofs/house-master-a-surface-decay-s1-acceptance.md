# House Master A Surface and Decay S1 Acceptance

Status: **PASS**

Template: `house.master.a`  
Structural seed: `18427`  
Detail seed: `4104`  
Appearance seed: `7001`  
Decay seed: `9907`  
Target Blender: `4.3.2`

This receipt records acceptance of the first deterministic surface/material/decay layer for House Master A.

S1 is subordinate to the already accepted greybox and Architectural Detail A1 contracts.

## Accepted lineage

```text
geometry.json
  -> canonical geometry SHA
detail.json
  -> canonical detail SHA
surface.json
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

## Accepted S1 material identity

For the acceptance seeds:

```text
walls       PLASTER
roof        CLAY_TILE
trim        AGED_TIMBER
metal       AGED_ZINC
glass       DIRTY_INTACT
```

Observed foundation dirt intensity:

```text
0.921677
```

## Surface scope

S1 authorizes deterministic procedural appearance for:

- walls
- roof
- trim
- gutter/downpipe metal
- glass
- foundation dirt
- paint wear
- cracked plaster
- damp streaks
- grime
- moss/mildew
- rust
- gutter staining
- roof staining
- glass dirt

S1 does not authorize geometry mutation.

No accepted surface system may:

- move vertices
- alter object transforms
- add modifiers that change silhouette
- alter openings
- alter camera
- alter projection
- alter anchor
- alter footprint
- alter structural or architectural-detail dimensions

## Blender immutability proof

The Blender surface test snapshots all mesh object transforms and all mesh vertex coordinates before material application and compares them after application.

Observed result:

```text
PASS: House A Blender surface application preserves frozen geometry
```

The accepted material application therefore changes shading/material state only.

## Production path

Accepted production command:

```bash
python3 -m tools.hd_iso.cli build house.master.a \
  --seed 18427 \
  --detail-seed 4104 \
  --appearance-seed 7001 \
  --decay-seed 9907
```

The governed path is now:

```text
compile geometry
-> validate geometry
-> compile detail
-> validate detail
-> compile surface
-> validate surface
-> Blender revalidates detail
-> Blender revalidates surface
-> build core + detail
-> apply governed materials
-> render beauty with governed materials preserved
-> render diagnostic passes
-> projection proof
-> PASS / REFUSE
```

## Two-build determinism proof

Two independent real builds were produced using identical geometry, detail, appearance, and decay seeds.

Observed result:

```text
PASS: House A surface determinism murder test
```

The comparator verified:

- canonical `surface.json`
- canonical surface SHA
- source geometry SHA
- source detail SHA
- scene surface receipt
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

## Acceptance decision

**PASS.** House Master A Surface and Decay S1 is accepted as deterministic, parent-bound, fail-closed appearance DNA.

The accepted doctrine remains:

> Structure first, architecture detail second, surface beauty third.

Surface systems may rot the house. They may not rewrite the house.
