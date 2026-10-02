# House Master A Greybox Proof Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a deterministic House Master A geometry pipeline that compiles exact metre-space geometry, renders it through a frozen Blender camera in PRoot Debian, and emits a PASS/REFUSE proof bundle aligned to Surround Me's 64x32 dimetric world.

**Architecture:** Pure Python owns template parsing, geometry contracts, deterministic compilation, projection math, and validation. A thin Blender adapter consumes validated geometry JSON to construct and render the greybox under one immutable orthographic camera. Proof tooling compares declared world law to generated geometry and projected output; no image generator or runtime rescaling may repair structural drift.

**Tech Stack:** Python 3, stdlib dataclasses/json/hashlib/subprocess, pytest, Blender Python (`bpy`) in headless PRoot Debian, existing Surround Me HD-ISO-V1 manifest/DNA files.

**Spec:** `docs/superpowers/specs/2026-10-02-surround-me-deterministic-3d-geometry-generator-design.md`

## Global Constraints

- Target environment: Termux -> PRoot Debian -> Blender headless.
- Projection: 2:1 orthographic dimetric, no perspective.
- Logical ground tile: `64 x 32 px` for `2.0 x 2.0 m`.
- Ground projection: `screenX=(worldX-worldY)*16`, `screenY=(worldX+worldY)*8` before origin/zoom offsets.
- House A core footprint: exactly `7.5 x 6.0 m` = `3.75 x 3.0 tiles`.
- Maximum envelope: `4.8 m`.
- Door: exactly `2.0 m` high, `0.90 m` wide for v1.
- Anchor: `[0.5, 1.0]`.
- Per-asset camera drift and post-render geometry scaling are forbidden.
- Porch is a governed attachment and may not redefine core footprint.
- Same template DNA + same structural seed => identical geometry JSON/hash.
- Greybox proof only. No final grime materials, AI appearance, district generation, shop/sedan work, or road integration.

## Review Focus

- Unknown/malformed template IDs fail closed with explicit REFUSE reasons.
- Boundary-valid structural values pass; out-of-range values refuse before Blender.
- Door/window/porch geometry may not violate wall/corner/roof/footprint constraints.
- Camera/render-setting drift must refuse, never auto-normalize.
- Repeated builds preserve geometry hash, camera hash, footprint projection, and anchor.

---

### Task 1: Canonical projection contract

**Files:**
- Create: `tools/hd_iso/geometry/projection.py`
- Test: `tests/hd_iso/test_projection_transform.py`

**Interfaces:**
- Produces `project_ground(world_x_m: float, world_y_m: float) -> tuple[float, float]`
- Produces `anchor_world_position(width_m: float, depth_m: float, anchor: tuple[float, float]) -> tuple[float, float]`

- [ ] Write failing tests asserting `(2,0)->(32,16)`, `(0,2)->(-32,16)`, `(2,2)->(0,32)`, and House A anchor `(3.75,6.0)`.
- [ ] Run `pytest -q tests/hd_iso/test_projection_transform.py` and confirm RED.
- [ ] Implement exact projection helpers.
- [ ] Re-run and confirm GREEN.
- [ ] Commit: `feat: lock hd iso projection transform`.

### Task 2: Typed geometry model and House A template contract

**Files:**
- Create: `tools/hd_iso/geometry/model.py`
- Create: `world-art/hd-iso-v1/templates/house-master-a.json`
- Create: `world-art/hd-iso-v1/geometry/schemas/geometry-output.schema.json`
- Test: `tests/hd_iso/test_house_a_geometry.py`

**Interfaces:** Produces immutable `HouseGeometry`, `OpeningSocket`, `AttachmentSocket`, `GeometryManifest` dataclasses.

- [ ] Write failing tests for exact 7.5x6.0 m, 3.75x3.0 tiles, 4.8 m max, anchor `[0.5,1.0]`, door 2.0x0.90 m, gable roof pitch range 26..38 degrees.
- [ ] Run test and confirm RED.
- [ ] Create template/schema/model with no Blender dependency.
- [ ] Re-run and confirm GREEN.
- [ ] Commit: `feat: define house master a geometry contract`.

### Task 3: Deterministic House A compiler

**Files:**
- Create: `tools/hd_iso/geometry/primitives.py`
- Create: `tools/hd_iso/geometry/house_a.py`
- Create: `tools/hd_iso/geometry/sockets.py`
- Create: `tools/hd_iso/compile_geometry.py`
- Test: `tests/hd_iso/test_house_a_determinism.py`

**Interfaces:** `compile_house_a(template: dict, structural_seed: int) -> GeometryManifest`, `compile_template(template_id: str, structural_seed: int = 0) -> GeometryManifest`, `geometry_sha256(manifest: GeometryManifest) -> str`.

- [ ] Write failing determinism tests proving same seed => identical manifest/hash.
- [ ] Assert differing legal seeds never change footprint, anchor, facade orientation, or max envelope.
- [ ] Run and confirm RED.
- [ ] Implement deterministic primitives/compiler using local `random.Random(seed)` only.
- [ ] Re-run and confirm GREEN.
- [ ] Commit: `feat: compile deterministic house master a geometry`.

### Task 4: Fail-closed pure-Python validation

**Files:**
- Create: `tools/hd_iso/geometry/validation.py`
- Test: `tests/hd_iso/test_house_a_validation.py`

**Interfaces:** `ValidationResult(status: Literal['PASS','REFUSE'], reasons: tuple[str,...])`; `validate_house_a(manifest: GeometryManifest, template: dict) -> ValidationResult`.

- [ ] Write failing tests: exact geometry PASS; width/depth drift REFUSE; height >4.8 REFUSE; door height !=2.0 REFUSE; roof pitch outside 26..38 REFUSE; corner collision REFUSE; porch outside allowance REFUSE; unknown template REFUSE.
- [ ] Run and confirm RED.
- [ ] Implement world-space validation with no raster tolerances.
- [ ] Re-run and confirm GREEN.
- [ ] Commit: `feat: refuse invalid house geometry before render`.

### Task 5: Compile/validate CLI

**Files:**
- Create: `tools/hd_iso/__init__.py`
- Create: `tools/hd_iso/geometry/__init__.py`
- Create: `tools/hd_iso/cli.py`
- Test: `tests/hd_iso/test_hd_iso_cli.py`

**Interfaces:** `python -m tools.hd_iso.cli compile|validate house.master.a [--seed N] [--out PATH]`.

- [ ] Write failing CLI tests for deterministic geometry output and PASS/REFUSE exit codes.
- [ ] Run and confirm RED.
- [ ] Implement compile/validate with default output `build/hd-iso/<template-id>/geometry.json`; keep Blender imports out of top-level path.
- [ ] Re-run and confirm GREEN.
- [ ] Commit: `feat: add hd iso geometry cli`.

### Task 6: Canonical Blender camera lock

**Files:**
- Create: `tools/hd_iso/blender/__init__.py`
- Create: `tools/hd_iso/blender/camera.py`
- Test: `tests/hd_iso/test_blender_camera_lock.py`

**Interfaces:** `ensure_canonical_camera(scene) -> CameraProof`.

- [ ] Write headless Blender test asserting ORTHO camera, canonical roll/transform, required 2:1 ground basis, and REFUSE after manual nudge.
- [ ] Run `blender -b --factory-startup --python tests/hd_iso/test_blender_camera_lock.py` and confirm RED.
- [ ] Implement canonical camera construction and lock verification; no per-asset controls.
- [ ] Re-run and confirm GREEN.
- [ ] Commit: `feat: freeze canonical hd iso blender camera`.

### Task 7: Blender mesh construction from manifest

**Files:**
- Create: `tools/hd_iso/blender/build_mesh.py`
- Create: `tools/hd_iso/blender/build_scene.py`
- Test: `tests/hd_iso/test_blender_house_a_mesh.py`

**Interfaces:** `build_house_objects(bpy, manifest: dict) -> dict[str, object]`.

- [ ] Write Blender test asserting foundation dimensions 7.5x6.0, door Z span 2.0, max Z <=4.8, and exact manifest-driven origin/anchor.
- [ ] Run and confirm RED.
- [ ] Implement mechanical Blender adapter; it must not choose dimensions, seeds, pitch, sockets, or footprint.
- [ ] Re-run and confirm GREEN.
- [ ] Commit: `feat: build house master a mesh from geometry manifest`.

### Task 8: Authoritative render passes and anchor metadata

**Files:**
- Create: `tools/hd_iso/blender/render_passes.py`
- Test: `tests/hd_iso/test_blender_render_anchor.py`

**Interfaces:** Produces `beauty.png`, `silhouette.png`, `object-id.png`, `depth.exr`, `normals.exr`, `scene-manifest.json`.

- [ ] Write failing test for transparent film, fixed output dimensions, required files, projected anchor agreement, and REFUSE after camera/render-size drift.
- [ ] Run and confirm RED.
- [ ] Implement neutral-grey render passes only.
- [ ] Re-run and confirm GREEN.
- [ ] Commit: `feat: render authoritative house proof passes`.

### Task 9: Geometry/projection proof bundle

**Files:**
- Create: `tools/hd_iso/proof/__init__.py`
- Create: `tools/hd_iso/proof/verify_geometry.py`
- Create: `tools/hd_iso/proof/verify_projection.py`
- Create: `tools/hd_iso/proof/calibration_card.py`
- Test: `tests/hd_iso/test_house_a_golden_proof.py`

**Interfaces:** Produces `proof.json`, `calibration.png`, overall PASS/REFUSE.

- [ ] Write failing proof tests requiring PASS for footprint, height, anchor, door scale, camera, footprint pixels, anchor pixel.
- [ ] Add tamper tests for footprint, height, door, anchor, camera matrix, and render dimensions, each requiring overall REFUSE.
- [ ] Run and confirm RED.
- [ ] Implement proof aggregation and deterministic calibration card from geometry/projection metadata, never image generation.
- [ ] Re-run and confirm GREEN.
- [ ] Commit: `feat: add house master a geometry proof bundle`.

### Task 10: End-to-end render/prove/build CLI

**Files:**
- Modify: `tools/hd_iso/cli.py`
- Modify: `tools/hd_iso/blender/build_scene.py`
- Test: `tests/hd_iso/test_hd_iso_cli.py`
- Test: `tests/hd_iso/test_house_a_golden_proof.py`

**Interfaces:** `python -m tools.hd_iso.cli render|prove|build house.master.a --seed N`.

- [ ] Add failing integration test for `compile -> validate -> Blender render -> prove` and nonzero exit on any failed proof.
- [ ] Run and confirm RED.
- [ ] Implement orchestration via `subprocess.run`; `BLENDER_BIN` defaults to `blender`.
- [ ] Run `python -m tools.hd_iso.cli build house.master.a --seed 18427` and require final PASS.
- [ ] Commit: `feat: build house master a end to end`.

### Task 11: Determinism murder test and acceptance evidence

**Files:**
- Modify: `tests/hd_iso/test_house_a_golden_proof.py`
- Create: `world-art/hd-iso-v1/proofs/house-master-a-greybox-acceptance.md`

**Interfaces:** Produces final greybox evidence only; no final visual-master promotion.

- [ ] Build seed `18427` twice into separate output roots and assert identical canonical geometry JSON, geometry SHA, camera hash, projected footprint, anchor, output dimensions, and PASS proof manifests.
- [ ] Run `pytest -q tests/hd_iso`.
- [ ] Run all Blender contract tests plus both end-to-end builds in PRoot Debian.
- [ ] Record commands, Python version, Blender version, geometry hashes, camera hash, and PASS/REFUSE evidence in acceptance doc.
- [ ] Commit: `test: prove house master a greybox determinism`.

## Final Verification

```bash
git diff --check
pytest -q tests/hd_iso
python -m tools.hd_iso.cli build house.master.a --seed 18427
python -m tools.hd_iso.cli build house.master.a --seed 18427 --out /tmp/house-a-repeat
```

Then run all Blender contract tests in PRoot Debian and compare both proof bundles.

Completion requires all applicable tests PASS, both builds PASS, geometry hashes match, camera hashes match, anchor/footprint projections match, and House A remains unpromoted to final visual master until the later material/decay phase.
