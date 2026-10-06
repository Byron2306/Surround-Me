# House Master A G1 Proof-Governed Generative Appearance Plan

## Goal

Use a generative image model for final atmosphere, decay richness, and material feel while keeping deterministic House A geometry authoritative.

The generator proposes pixels. The deterministic pipeline decides whether those pixels are legal.

## Frozen parent truth

```text
geometry SHA
sha256:820ca6b7bcd774eb93c2ad3bcb93567a8a42bde484d7d1e4a71e9cc6bd9104a1

detail SHA
sha256:e2f1d4ac85cef2b32db76c424fd11988cf8912afb452b593aeaae81c416308e4

surface SHA
sha256:c32c73d9d82d624f07186089e03e5c029f33aa338e68f7f90bc243434f84aa1b

surface-fidelity SHA
sha256:fb58ca746aab1fa2ad7c4549e6e6efeb279a9ba759b0b91bef581898ece6a596
```

Canonical camera hash:

```text
sha256:754dc1d5bec75ea29af7d216c535511d999d882a1576fd3007f2a3f427e027a9
```

Projection adapter:

```text
mirror_x
```

## Canonical generator input bundle

The deterministic pipeline produces:

```text
beauty.png
silhouette.png
object-id.png
depth.exr
normals.exr
scene-manifest.json
```

The generated appearance stage consumes those files as constraints.

## Generator authority

Allowed:

- richer plaster/brick/roof material interpretation
- grime and dirt
- damp marks and runoff
- paint wear
- moss/mildew
- rust
- glass dirt/haze
- local colour nuance
- subtle surface damage that does not alter silhouette
- psychological-horror art direction
- local atmospheric shading that does not alter camera or geometry

Forbidden:

- changing the outer silhouette
- changing canvas dimensions
- moving the building
- changing camera/projection
- changing roof pitch or ridge
- changing footprint
- moving/adding/removing doors or windows
- moving porch/gutter/downpipe/fascia structural regions
- adding large structural masses
- deleting structural masses
- changing anchor
- changing deterministic parent hashes

## G1.1 Candidate manifest

Each generated proposal is accompanied by a manifest:

```json
{
  "schemaVersion": "hd-iso-generative-candidate-v1",
  "templateId": "house.master.a",
  "sourceGeometrySha256": "...",
  "sourceDetailSha256": "...",
  "sourceSurfaceSha256": "...",
  "sourceSurfaceFidelitySha256": "...",
  "cameraHash": "...",
  "projectionAdapter": "mirror_x",
  "width": 512,
  "height": 512,
  "candidateImage": "generated.png"
}
```

A parent mismatch is immediate REFUSE.

## G1.2 Hard silhouette verifier

The candidate alpha/silhouette is compared to the canonical silhouette.

Initial hard limits:

- exact canvas: 512 x 512
- candidate visible bbox drift: <= 2 px per edge
- silhouette IoU: >= 0.985
- visible pixels outside canonical silhouette: <= 0.25%
- canonical silhouette pixels missing from candidate: <= 1.0%

The final shipping alpha is always replaced by the canonical silhouette mask after verification.

This makes the generator incapable of owning outer geometry even after an ALLOW.

## G1.3 Structural-region verifier

Use canonical object-id regions to derive deterministic landmark masks for:

- walls
- visible roof skin
- door
- windows
- porch
- fascia
- gutter
- downpipe

G1.3 must reject generated imagery whose inferred structural landmarks drift beyond their canonical regions.

This gate is intentionally separate from G1.2 so silhouette acceptance never implies internal-structure acceptance.

## G1.4 Deterministic compositor

After ALLOW:

```text
generated RGB proposal
+
canonical alpha/silhouette
+
canonical structural masks
=
governed final sprite
```

No generated alpha is trusted for shipping output.

## Acceptance

G1 is not accepted until:

- candidate-manifest validation PASS
- silhouette verifier PASS/refusal cases PASS
- structural landmark verifier PASS/refusal cases PASS
- deterministic compositor PASS
- real generated House A candidate passes all gates
- final canonical camera/projection/anchor remain unchanged
- result is visually reviewed at game zoom

