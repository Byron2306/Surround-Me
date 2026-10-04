# House Master A Architectural Detail DNA Plan

**Goal:** Add deterministic architectural detail to the accepted House Master A greybox without changing its accepted structural geometry contract or geometry SHA.

## Boundary

The accepted greybox remains authoritative. Architectural detail consumes `geometry.json` and emits a separate `detail.json`.

Hard law that may not change in this phase:
- template id
- structural seed
- 7.5 x 6.0 m core footprint
- 4.8 m maximum structural envelope
- anchor [0.5, 1.0]
- door dimensions and opening sockets
- wall height, roof rise, roof pitch, ridge axis
- canonical Blender camera
- projection adapter
- accepted geometry SHA for seed 18427

Detail may add only governed objects whose dimensions and placement are derived from existing manifest truth or fixed detail-policy constants.

## Phase A1 detail set

1. Existing manifest window sockets become explicit Blender window objects.
2. Existing eaveOverhangM becomes real roof geometry extension.
3. Fascia boards are derived from eave edges.
4. One front gutter follows the front eave.
5. One deterministic front downpipe is placed on a legal corner side.
6. A simple porch frame is derived inside the existing porch attachment allowance.

No materials, grime, damage, AI generation, signage, props, district dressing, or lot dressing in A1.

## New outputs

`detail.json` uses schema `hd-iso-detail-v1` and records:
- templateId
- structuralSeed
- detailSeed
- sourceGeometrySha256
- windows
- eaves
- fascia
- gutter
- downpipe
- porch

Same geometry manifest + same detail seed must produce byte-identical canonical detail JSON and detail SHA.

## Fail-closed rules

REFUSE if:
- source template is not House A
- source geometry SHA does not match the supplied geometry
- a detail exceeds the declared max envelope
- porch exceeds the existing porch attachment allowance
- window detail does not exactly match an existing window socket
- gutter/downpipe placement leaves the declared facade or core extent
- detail attempts to mutate footprint, anchor, wall height, roof rise, or camera law

## TDD execution

### Task A1.1: deterministic detail compiler
Create:
- `tools/hd_iso/detail/__init__.py`
- `tools/hd_iso/detail/house_a.py`
- `tools/hd_iso/compile_detail.py`
- `tests/hd_iso/test_house_a_detail_determinism.py`

RED first, then implement:
- accepted seed 18427 geometry SHA remains unchanged
- same detail seed produces identical detail JSON/SHA
- different detail seeds may vary only legal downpipe/porch subchoices
- window details exactly mirror geometry sockets
- source geometry SHA is embedded

### Task A1.2: detail validation
Create:
- `tools/hd_iso/detail/validation.py`
- `tests/hd_iso/test_house_a_detail_validation.py`

Test legal PASS and tamper REFUSE for windows, porch bounds, eave, gutter, downpipe, source hash.

### Task A1.3: Blender realization
Modify:
- `tools/hd_iso/blender/build_mesh.py`
- `tools/hd_iso/blender/build_scene.py`

Create:
- `tests/hd_iso/test_blender_house_a_detail.py`

Assert explicit window objects, real eave extension, fascia, gutter, downpipe, porch frame, while core foundation/anchor/envelope remain unchanged.

### Task A1.4: end-to-end detail proof
Extend CLI with detail compilation/build output under the existing build root and add proof checks that detail is chained to the accepted geometry SHA.

## Acceptance

A1 is accepted only after:
- pure Python detail tests PASS
- Blender detail contract PASS
- two independent seed-18427 detail builds produce identical canonical detail JSON/SHA
- original accepted geometry SHA remains:
  `sha256:73243c4b90863d432d8b56b444754f335e6fc8807d70c2da168b6a102614a3aa`
