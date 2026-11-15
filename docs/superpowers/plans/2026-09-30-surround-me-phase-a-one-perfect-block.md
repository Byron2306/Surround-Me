# Surround Me Phase A: One Perfect Block Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build one deterministic, walkable, HD isometric four-way urban block in the live Surround Me runtime that proves the canonical camera, scale, lighting, texture-density, anchoring, road, building, vehicle, prop, and fog contracts at Aliza's closest intended gameplay zoom.

**Architecture:** Keep the existing `game.js` runtime and add a small world-art subsystem beside it rather than restructuring the monolith. A manifest owns asset metadata and scale; a pure calibration module owns canonical projection/anchor math; a deterministic Phase A scene definition owns placement; `game.js` consumes those interfaces for loading, collision, depth sorting, debug teleport, and rendering. Golden-master image assets remain replaceable data, never hard-coded geometry.

**Tech Stack:** Existing browser Canvas/JavaScript runtime, JSON asset manifests, Python 3 standard-library validation/tests, Node `--check` syntax verification, PNG/WebP production assets.

**Spec:** `docs/superpowers/specs/2026-09-30-surround-me-hd-isometric-city-art-design.md`

## Global Constraints

- Master-town renders are spatial references, not runtime textures.
- Macro layout controls geography; modular HD assets control fidelity.
- True isometric / orthographic projection only; no perspective-lens distortion.
- All world assets share identical camera pitch/yaw, world scale, lighting direction, shadow logic, and ground-contact convention.
- Transparent background where appropriate; complete object visible; no clipped edges.
- No baked fog except dedicated atmospheric overlays.
- No cinematic depth of field or painterly softness.
- Materials must remain realistic, weathered, physically plausible, and readable at Aliza-scale gameplay zoom.
- No asset category may be mass-generated until its Phase A representative passes in-engine at the closest intended gameplay camera.
- Target visual language: **Silent Hill suburban decay + Diablo readability + realistic architectural texture.**
- Phase A minimum scene: one four-way intersection, two detached houses, one apartment/mixed-use block, two shops, one petrol station or garage, four vehicle types, traffic lights, streetlights, utility poles/wires, bins/dumpsters, signs, cracked roads, sidewalk/curb variants, trash/clutter, weeds, fences, and fog.

## Review Focus

1. **Camera/scale drift:** assets produced at the wrong projection or pixels-per-world-unit must fail validation instead of being visually fudged in `game.js`.
2. **Anchor mismatch:** transparent PNG padding or incorrect ground-contact anchors must not make buildings/vehicles float, sink, or depth-sort incorrectly.
3. **Missing/failed assets:** the Phase A scene must degrade visibly and diagnostically, never silently substitute unrelated legacy fantasy props.
4. **Close-camera texture collapse:** the acceptance harness must expose the closest intended gameplay zoom and make insufficient source detail obvious before asset-family expansion.
5. **Legacy-world regression:** ordinary procedural Verge/Holdfast generation and existing combat/UI must remain functional when Phase A debug mode is off.

---

### Task 1: Freeze the HD-ISO-V1 Manifest and Naming Contract

**Files:**
- Create: `world-art/hd-iso-v1/manifest.json`
- Create: `world-art/hd-iso-v1/README.md`
- Create: `tools/validate_world_art_manifest.py`
- Create: `tests/test_world_art_manifest.py`

**Interfaces:**
- Consumes: canonical requirements from the locked design spec.
- Produces: `manifest.json` with top-level `schema`, `projection`, `lighting`, `scale`, `runtime`, and `assets`; asset records expose `id`, `category`, `source`, `runtimeSource`, `footprintTiles`, `anchor`, `nominalHeightM`, `masterPixels`, `runtimePixels`, `transparent`, and `status`.
- Produces: `validate_manifest(path: pathlib.Path) -> list[str]`, returning an empty list only for a valid manifest.

- [ ] **Step 1: Write the failing manifest tests**

Create tests named:

```python
def test_manifest_declares_hd_iso_v1_contract(): ...
def test_asset_ids_are_unique_and_paths_are_relative(): ...
def test_asset_anchor_is_normalized_bottom_contact(): ...
def test_master_resolution_is_not_smaller_than_runtime_resolution(): ...
def test_phase_a_required_categories_are_declared(): ...
```

Assertions must pin `schema == "surround-me-world-art-v1"`, `projection.type == "orthographic_isometric"`, normalized anchors to `[0,1]`, relative repo paths only, and the Phase A required categories `road`, `building`, `vehicle`, `street_furniture`, `utility`, `clutter`, `vegetation`, `atmosphere`.

- [ ] **Step 2: Run the tests and verify they fail**

Run: `python -m unittest tests.test_world_art_manifest -v`

Expected: FAIL because `manifest.json` and `validate_world_art_manifest.py` do not exist.

- [ ] **Step 3: Implement the validator and seed manifest**

Implement `validate_manifest(path: pathlib.Path) -> list[str]` in `tools/validate_world_art_manifest.py`. Seed `manifest.json` with the canonical contract plus Phase A placeholder records using `status: "planned"`; do not invent final pixel scale before Task 2 calibration.

- [ ] **Step 4: Run tests**

Run: `python -m unittest tests.test_world_art_manifest -v`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add world-art/hd-iso-v1 tools/validate_world_art_manifest.py tests/test_world_art_manifest.py
git commit -m "world-art: freeze HD ISO v1 manifest contract"
```

---

### Task 2: Add Canonical Isometric Calibration Math and Debug Board

**Files:**
- Create: `world-art/hd-iso-v1/calibration.js`
- Create: `world-art/hd-iso-v1/calibration-board.js`
- Create: `tests/world_art_calibration.test.js`
- Modify: `index.html` near the final game script includes
- Modify: `game.js` near camera/world-to-screen helpers and debug-input handling

**Interfaces:**
- Consumes: manifest contract from Task 1.
- Produces: `window.SurroundWorldArtCalibration` exposing:
  - `worldToIso(x, y, tileWidth, tileHeight) -> { x, y }`
  - `isoToWorld(screenX, screenY, tileWidth, tileHeight) -> { x, y }`
  - `anchorScreenPosition(worldX, worldY, anchor, camera) -> { x, y }`
  - `CALIBRATION_MODE_ID = "hd-iso-v1"`
- Produces: `drawCalibrationBoard(ctx, camera, calibrationState)` that renders an isometric grid, 1 m / doorway / car reference markers, anchor crosshairs, and closest-camera framing without mutating game state.

- [ ] **Step 1: Write failing calibration tests**

Tests must assert round-trip `worldToIso`/`isoToWorld`, consistent diamond dimensions, bottom-center anchor behavior, and finite coordinates for negative world positions.

- [ ] **Step 2: Verify failure**

Run: `node --test tests/world_art_calibration.test.js`

Expected: FAIL because the calibration module does not exist.

- [ ] **Step 3: Implement pure calibration functions**

Keep the functions DOM-free so Node tests can execute them. Export via CommonJS when `module.exports` exists and attach the same object to `window` in the browser.

- [ ] **Step 4: Add the visual calibration board and debug toggle**

Load `calibration.js` and `calibration-board.js` before `game.js` in `index.html`. Add a developer-only toggle in `game.js` that shows the board and the current Aliza screen-height measurement; the debug path must not alter normal game state when disabled.

- [ ] **Step 5: Run verification**

Run:

```bash
node --test tests/world_art_calibration.test.js
node --check world-art/hd-iso-v1/calibration.js
node --check world-art/hd-iso-v1/calibration-board.js
node --check game.js
```

Expected: all PASS / syntax OK.

- [ ] **Step 6: Commit**

```bash
git add index.html game.js world-art/hd-iso-v1/calibration.js world-art/hd-iso-v1/calibration-board.js tests/world_art_calibration.test.js
git commit -m "world-art: add canonical isometric calibration board"
```

---

### Task 3: Measure Runtime Scale and Freeze Pixels-Per-World-Unit

**Files:**
- Modify: `world-art/hd-iso-v1/manifest.json`
- Create: `world-art/hd-iso-v1/calibration-report.md`
- Modify: `tests/test_world_art_manifest.py`

**Interfaces:**
- Consumes: calibration board and current Aliza/camera runtime from Task 2.
- Produces: manifest values `scale.tileWidthPx`, `scale.tileHeightPx`, `scale.alizaReferenceHeightPx`, `scale.referenceDoorHeightM`, `scale.referenceCarLengthM`, and `runtime.closestNormalZoom`.
- Produces: `calibration-report.md` recording measured current-runtime values, chosen canonical values, and any deliberate deviation.

- [ ] **Step 1: Extend manifest tests to reject unfrozen calibration values**

Add assertions that Phase A cannot progress when any canonical scale field is `null`, zero, negative, or marked `planned`.

- [ ] **Step 2: Run tests and verify failure**

Run: `python -m unittest tests.test_world_art_manifest -v`

Expected: FAIL because calibration remains unfrozen.

- [ ] **Step 3: Measure the live runtime**

Launch the game locally, enable the calibration board, record Aliza's closest-normal-zoom screen height, current tile diamond width/height, and the camera zoom value. Use the board's door and car references to choose the canonical pixels-per-world-unit relationship; do not eyeball asset-by-asset scale.

- [ ] **Step 4: Freeze the values in manifest and report**

Replace the Task 1 placeholders with measured/final Phase A values. Document why they were selected and what constitutes an allowed tolerance for generated art.

- [ ] **Step 5: Run tests**

Run: `python -m unittest tests.test_world_art_manifest -v`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add world-art/hd-iso-v1/manifest.json world-art/hd-iso-v1/calibration-report.md tests/test_world_art_manifest.py
git commit -m "world-art: freeze runtime scale calibration"
```

---

### Task 4: Produce and Validate the Golden Four Masters

**Files:**
- Create: `world-art/hd-iso-v1/masters/building_house_suburban_01.png`
- Create: `world-art/hd-iso-v1/masters/building_shop_corner_01.png`
- Create: `world-art/hd-iso-v1/masters/vehicle_sedan_01.png`
- Create: `world-art/hd-iso-v1/masters/road_intersection_4way_01.png`
- Create: `world-art/hd-iso-v1/prompts/golden-four.md`
- Create: `tools/validate_world_art_images.py`
- Create: `tests/test_world_art_images.py`
- Modify: `world-art/hd-iso-v1/manifest.json`

**Interfaces:**
- Consumes: frozen camera/scale/lighting contract from Tasks 1-3.
- Produces: four approved master PNGs with known dimensions, alpha expectations, and bottom-contact anchors.
- Produces: `inspect_image(path: pathlib.Path, record: dict) -> list[str]` checking dimensions, alpha presence when required, transparent-edge contamination, and manifest/master consistency.

- [ ] **Step 1: Write failing image-validation tests**

Tests must reject wrong dimensions, missing alpha on transparent assets, opaque corner pixels where transparency is required, absent files, and manifest paths that point outside `world-art/hd-iso-v1/`.

- [ ] **Step 2: Verify failure**

Run: `python -m unittest tests.test_world_art_images -v`

Expected: FAIL because the validator and Golden Four do not exist.

- [ ] **Step 3: Write the canonical generation prompt sheet**

`golden-four.md` must contain one shared immutable HD-ISO-V1 prefix covering orthographic/isometric camera, frozen scale references, lighting direction, realistic weathering, full-object framing, transparency, no fog, no depth-of-field, no perspective distortion, and no painterly treatment. Subject blocks may vary only the house, shop, sedan, and intersection content.

- [ ] **Step 4: Generate the four masters**

Generate each asset against the shared prompt contract. Prefer regeneration over manual geometric warping when projection is wrong. Keep source masters at or above the manifest master resolution.

- [ ] **Step 5: Implement and run the image validator**

Run:

```bash
python -m unittest tests.test_world_art_images -v
python tools/validate_world_art_images.py world-art/hd-iso-v1/manifest.json
```

Expected: PASS and zero validation errors.

- [ ] **Step 6: Human visual gate**

Inspect the four masters together on the calibration board. Reject the set if door/car scale, roof pitch projection, shadow direction, material sharpness, or ground contact differ visibly. Do not proceed by compensating each asset with arbitrary runtime scale constants.

- [ ] **Step 7: Commit approved masters**

```bash
git add world-art/hd-iso-v1/masters world-art/hd-iso-v1/prompts/golden-four.md world-art/hd-iso-v1/manifest.json tools/validate_world_art_images.py tests/test_world_art_images.py
git commit -m "world-art: add approved HD ISO golden four"
```

---

### Task 5: Build the Runtime Asset Registry and Layered Renderer

**Files:**
- Create: `world-art/hd-iso-v1/runtime-registry.js`
- Create: `world-art/hd-iso-v1/world-object-renderer.js`
- Create: `tests/world_art_registry.test.js`
- Modify: `index.html` final script includes
- Modify: `game.js` asset loading and world rendering paths

**Interfaces:**
- Consumes: `manifest.json`, loaded browser images, canonical anchors and calibration math.
- Produces: `WorldArtRegistry.get(id) -> AssetRecord`, `WorldArtRegistry.require(id) -> AssetRecord`, and `WorldArtRegistry.phaseAAssets() -> AssetRecord[]`.
- Produces: `drawWorldArtObject(ctx, object, camera, registry)` where `object` includes `{ assetId, worldX, worldY, zBias, collisionFootprint, variant? }`.
- Rendering order must be derived from projected ground contact plus `zBias`, not source-image height.

- [ ] **Step 1: Write failing registry tests**

Cover known-ID lookup, missing-ID diagnostic errors, duplicate IDs, rejected `status != "approved"` assets in production placement, and stable phase-A enumeration.

- [ ] **Step 2: Verify failure**

Run: `node --test tests/world_art_registry.test.js`

Expected: FAIL because registry/renderer do not exist.

- [ ] **Step 3: Implement registry**

Keep manifest parsing/lookup independent from Canvas so it remains unit-testable.

- [ ] **Step 4: Implement layered renderer and game integration**

Use manifest anchors and footprint metadata. Add explicit rendering bands for ground, road/decal, structure/vehicle/prop, vegetation, atmosphere, while preserving existing HUD/post-process order.

- [ ] **Step 5: Verify**

Run:

```bash
node --test tests/world_art_registry.test.js
node --check world-art/hd-iso-v1/runtime-registry.js
node --check world-art/hd-iso-v1/world-object-renderer.js
node --check game.js
python -m unittest tests.test_world_art_manifest tests.test_world_art_images -v
```

Expected: all PASS.

- [ ] **Step 6: Commit**

```bash
git add index.html game.js world-art/hd-iso-v1/runtime-registry.js world-art/hd-iso-v1/world-object-renderer.js tests/world_art_registry.test.js
git commit -m "world-art: add manifest-driven layered renderer"
```

---

### Task 6: Define the Deterministic Phase A Block and Collision Footprints

**Files:**
- Create: `world-art/phase-a/one-perfect-block.json`
- Create: `world-art/phase-a/scene.js`
- Create: `tests/phase_a_scene.test.js`
- Modify: `game.js` world setup / collision integration

**Interfaces:**
- Consumes: registry and renderer from Task 5.
- Produces: `loadPhaseABlock(sceneData, registry) -> { objects, collisionRects, spawn }`.
- Scene schema contains `spawn`, `bounds`, `ground`, `objects`, and `atmosphere`; every placed object references an approved manifest `assetId`.
- Scene placement is deterministic and contains no `Math.random()` calls.

- [ ] **Step 1: Write failing scene tests**

Tests must assert deterministic output, no overlapping blocking footprints at Aliza spawn, every referenced asset ID resolves, all objects remain within scene bounds, and object ordering is stable for equal projected depth.

- [ ] **Step 2: Verify failure**

Run: `node --test tests/phase_a_scene.test.js`

Expected: FAIL because scene loader/data do not exist.

- [ ] **Step 3: Implement scene loader and seed Golden Four placement**

Create the four-way intersection around a known Phase A origin and place the Golden Four at canonical footprints. Keep collision rectangles derived from manifest/scene metadata rather than image opaque pixels.

- [ ] **Step 4: Integrate debug teleport without replacing the normal world**

Add a developer route/key that teleports Aliza to `scene.spawn` and activates Phase A rendering. When disabled, legacy procedural generation remains authoritative.

- [ ] **Step 5: Verify tests and syntax**

Run:

```bash
node --test tests/phase_a_scene.test.js
node --test tests/world_art_registry.test.js tests/world_art_calibration.test.js
node --check game.js
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add game.js world-art/phase-a tests/phase_a_scene.test.js
git commit -m "world-art: add deterministic Phase A block"
```

---

### Task 7: Expand Phase A to the Minimum Complete Street Kit

**Files:**
- Create/modify: `world-art/hd-iso-v1/masters/` for the additional approved Phase A assets
- Create/modify: `world-art/hd-iso-v1/runtime/` for optimized runtime exports
- Modify: `world-art/hd-iso-v1/manifest.json`
- Modify: `world-art/phase-a/one-perfect-block.json`
- Modify: `world-art/hd-iso-v1/prompts/golden-four.md` or create category prompt sheets under `world-art/hd-iso-v1/prompts/`
- Modify: `tests/test_world_art_manifest.py`
- Modify: `tests/test_world_art_images.py`
- Modify: `tests/phase_a_scene.test.js`

**Interfaces:**
- Consumes: approved Golden Four style contract and Phase A scene pipeline.
- Produces: approved assets sufficient for the locked minimum Phase A scene: second house, apartment/mixed-use block, second shop, petrol station/garage, three more vehicle classes, traffic lights, streetlights, utility poles, wire overlay/segments, bins/dumpsters, signs, road/curb variants, clutter, weeds, fences, and fog overlay.

- [ ] **Step 1: Extend tests for the complete required Phase A inventory**

Tests must fail until every locked Phase A category/count is represented by at least one approved manifest record and scene placement.

- [ ] **Step 2: Generate by category in small batches**

Generate only the assets needed by the One Perfect Block. Each batch reuses the frozen HD-ISO-V1 prompt prefix and passes the image validator plus visual calibration board before the next batch begins.

- [ ] **Step 3: Export runtime variants**

Create optimized runtime images from approved masters while preserving alpha edges and close-camera readability. Update `runtimeSource` and `runtimePixels`; never overwrite the master.

- [ ] **Step 4: Dress the deterministic scene**

Place all required buildings, vehicles, street furniture, utilities, clutter, vegetation, and fog. Roads remain base geometry plus composable decal/damage assets rather than a single baked mega-image.

- [ ] **Step 5: Run automated gauntlet**

Run:

```bash
python -m unittest tests.test_world_art_manifest tests.test_world_art_images -v
node --test tests/world_art_calibration.test.js tests/world_art_registry.test.js tests/phase_a_scene.test.js
node --check game.js
```

Expected: all PASS.

- [ ] **Step 6: Commit**

```bash
git add world-art tests game.js
git commit -m "world-art: complete Phase A street asset kit"
```

---

### Task 8: Close-Camera Murder Test and Phase A Acceptance

**Files:**
- Create: `world-art/phase-a/ACCEPTANCE.md`
- Create: `world-art/phase-a/acceptance-checklist.json`
- Create: `tools/verify_phase_a_acceptance.py`
- Create: `tests/test_phase_a_acceptance.py`
- Modify: `world-art/hd-iso-v1/manifest.json` statuses only after visual approval

**Interfaces:**
- Consumes: complete Phase A scene from Task 7.
- Produces: machine-readable acceptance checklist and `verify_acceptance(path) -> list[str]`.
- Acceptance states: `PASS`, `REFUSE`, `NEEDS_REVIEW`; Phase A is complete only when every mandatory item is `PASS`.

- [ ] **Step 1: Write failing acceptance tests**

Pin mandatory checks for projection consistency, Aliza/door/car scale, closest-normal-zoom texture readability, transparent-edge quality, ground contact, depth sorting, collision/navigation, road continuity, missing-asset diagnostics, fog layering, and legacy-world regression.

- [ ] **Step 2: Verify failure**

Run: `python -m unittest tests.test_phase_a_acceptance -v`

Expected: FAIL until the checklist exists and contains completed evidence.

- [ ] **Step 3: Perform the in-engine murder test**

At minimum inspect far zoom, normal gameplay zoom, and closest normal zoom. Walk Aliza around every building corner, between parked vehicles, along curbs, beneath/near utility infrastructure, and through the intersection. Specifically look for flat source detail, floating anchors, wrong perspective, scale jumps, alpha halos, depth-sort pops, collision mismatch, repeated-looking clutter, and fog obscuring gameplay truth.

- [ ] **Step 4: Record evidence and refuse failures**

Any failed visual contract item is `REFUSE`; regenerate/fix the offending asset or metadata. Do not mark a failure PASS by hiding it with fog, reducing zoom, or shrinking the object.

- [ ] **Step 5: Run full verification**

Run:

```bash
python -m unittest discover -s tests -v
python tools/validate_world_art_manifest.py world-art/hd-iso-v1/manifest.json
python tools/validate_world_art_images.py world-art/hd-iso-v1/manifest.json
python tools/verify_phase_a_acceptance.py world-art/phase-a/acceptance-checklist.json
node --check game.js
```

Expected: all automated checks PASS and verifier returns zero acceptance errors.

- [ ] **Step 6: Freeze HD-ISO-V1**

Update approved manifest records from `candidate` to `approved` only after the murder test. `ACCEPTANCE.md` records the final canonical camera/scale/lighting values and explicitly authorizes subsequent residential/commercial/civic/industrial generation plans to inherit HD-ISO-V1.

- [ ] **Step 7: Commit**

```bash
git add world-art/phase-a world-art/hd-iso-v1/manifest.json tools/verify_phase_a_acceptance.py tests/test_phase_a_acceptance.py
git commit -m "world-art: accept the One Perfect Block"
```

---

## Plan Self-Review

**Spec coverage:** This plan intentionally implements only the design spec's Phase A proof gate and the reusable calibration/registry/validation foundation. Full residential, commercial, civic, industrial, vehicle-family, damage-overlay, Greyline/Samsarra, and district-generation expansion remain separate follow-on plans after HD-ISO-V1 is accepted. No full-city mass generation is authorized here.

**Step scan:** Every implementation task owns a test cycle and independently reviewable deliverable. Image generation is gated by machine validation plus human visual calibration rather than treated as a one-shot prompt operation.

**Type consistency:** Manifest asset IDs are the sole key crossing generation, registry, scene placement, renderer, and validation. Calibration functions and Phase A loader signatures are fixed above and must not be renamed casually between tasks.

**Review focus coverage:** Task 2 covers camera/projection math; Task 4 covers alpha/anchor and source quality; Task 5 covers missing assets and depth rendering; Task 6 covers deterministic placement and legacy-world isolation; Task 8 covers close-camera fidelity and full regression acceptance.

**Proportion:** Phase A remains a vertical slice. The plan does not attempt to pre-author the hundreds of assets belonging to later district factories.
