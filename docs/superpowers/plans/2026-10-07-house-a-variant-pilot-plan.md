# House A Variant Pilot Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build and verify the no-porch A-02 sibling through the existing Blender-governed pipeline, then review it beside the master.

**Architecture:** Resolve a strict versioned variant contract before geometry compilation. Keep `house.master.a` as the parent, carry variant identity through manifests and receipts, and use the existing Blender renderer and proof tools. Validate the exact final exported bytes before installation; do not treat runtime alpha repair as proof.

**Tech Stack:** Python/dataclasses/pytest, Blender Python, Pillow, existing JavaScript canvas runtime and Node tests.

**Spec:** `docs/superpowers/specs/2026-10-07-house-a-variant-pilot-design.md` (approved).

## Global Constraints

- Preserve existing master seed-18427 outputs and default command behavior.
- A-02 is 6.0 × 6.0 metres, 3.0 × 3.0 world units, one storey, no porch, structural seed 18428.
- Copy all remaining pilot dimensions and opening positions exactly from the spec's table.
- Projection: canonical 45° azimuth, 30° elevation, 0° roll, ortho scale 16√2; preserve existing verified adapter.
- Render scale 4: 2048 × 2048 physical RGBA PNG; 512 × 512 logical canvas.
- Derive anchor, entrance and collision from this variant's geometry/scene; no copied master anchor pixels.
- Appearance/decay seeds never change structural geometry; absent Blender cannot produce a render PASS.
- Human in-game review at zoom 3.0 remains separate from automated proof results.

## Review Focus

- Missing/unknown variant or unexpected contract field must refuse, never fall back to master.
- Nonfinite dimensions, invalid seeds and opening/envelope violations must refuse before Blender.
- No-porch must propagate through detail, surface, fidelity, Blender objects and mask counts.
- Stale geometry/scene/mask/final-file hashes must refuse installation.
- Failed render/export must not overwrite an accepted runtime asset or reuse a stale receipt.

### Task 1: Strict variant contract and geometry compilation

**Files:** Create `world-art/hd-iso-v1/templates/house-a-variants-v1.json` and `tools/hd_iso/variants.py`; modify `geometry/model.py`, `compile_geometry.py`, `geometry/validation.py` and `cli.py` beneath `tools/hd_iso/`; create `tests/hd_iso/test_house_a_variants.py`.

**Interfaces:** `compile_variant(variant_id: str, root: Path | None = None) -> tuple[GeometryManifest, dict, dict]` returns manifest, effective validation template, and canonical contract. Add optional `variant_id: str | None = None` to GeometryManifest; serialize `variantId` only when present, preserving legacy canonical bytes. CLI gains `--variant house.a.02`; default seed is legacy 0 without a variant, contract seed 18428 with it. An explicitly conflicting structural seed refuses.

- [ ] Write failing tests asserting A-02's exact spec values, empty attachments, geometry validation PASS, deterministic canonical bytes and distinct geometry hash from master. Assert unknown variant, unknown contract field, invalid/nonfinite values, conflicting seed and opening overlap refuse.
- [ ] Run `python -m pytest -q tests/hd_iso/test_house_a_variants.py`; confirm the missing behavior fails.
- [ ] Implement the contract resolver and variant compilation without changing the legacy RNG path. Validate against the resolved variant template in every CLI compile/build stage. Preserve family identity and include variant identity in source hashes.
- [ ] Run new tests plus `test_house_a_geometry.py`, `test_house_a_determinism.py`, `test_house_a_validation.py` and compile/validate CLI tests. Compare legacy master canonical bytes with the parent revision.
- [ ] Commit the validated contract/compiler change.

### Task 2: Porch absence through detail and Blender

**Files:** Modify `tools/hd_iso/detail/{house_a,validation}.py`, `tools/hd_iso/blender/{build_detail,render_passes}.py` and any demonstrated porch assumptions in surface/fidelity stages; create `tests/hd_iso/test_house_a_variant_detail.py` and `tests/hd_iso/test_blender_house_a_variant.py`.

**Interfaces:** No porch is represented as `detail['porch'] = None` only when geometry has no porch attachment. `build_house_detail_objects` returns no porch object for that state. Mask manifests retain the porch region with zero coverage/count when absent. Variant identity is carried in downstream manifests and hash bindings.

- [ ] Write failing tests: A-02 detail has no porch and passes validation; adding a porch to that detail refuses; master detail remains unchanged; changing appearance/decay seeds leaves geometry canonical bytes unchanged.
- [ ] Run the Python tests and confirm the existing mandatory-porch path fails for A-02.
- [ ] Implement optional porch handling in compilation, validation, Blender object construction and mask enumeration. Never pass `None` as a render object. Audit surface/fidelity stages against actual A-02 inputs.
- [ ] Under Blender, assert no `HouseA.Detail.PorchFrame` exists, porch mask count is zero, windows/door match the manifest and projection remains canonical. Run existing Blender tests as regressions.
- [ ] Commit only after non-Blender checks pass; record Blender checks as blocked if Blender is absent, not passed.

### Task 3: Exact export verification, installation and pilot review

**Files:** Create `tools/hd_iso/variant_export.py` and `tools/build_house_a02.sh`; modify CLI/proof integration as needed, `game.js` and `index.html`; create `tests/hd_iso/test_house_a_variant_export.py` and `tests/house_variant_runtime.test.mjs`.

**Interfaces:** `verify_variant_export(contract_path: Path, geometry_path: Path, scene_path: Path, masks_path: Path, png_path: Path) -> dict` returns PASS/REFUSE plus reasons and bound hashes. `install_variant(receipt_path: Path, png_path: Path, runtime_dir: Path) -> dict` verifies exact bytes and writes PNG, runtime metadata and receipt only on success. Metadata includes variant/family IDs, physical/logical dimensions, scene-derived anchor pixels, door approach and blocking bounds. The build script selects A-02, supplies scale 4 and stops on any refused stage.

- [ ] Write failing tests for RGB/incorrect-size/empty-foreground/opaque-exterior exports, stale hash/receipt, missing scene/masks and tampered variant identity. Assert failed installation leaves any existing accepted asset unchanged.
- [ ] Implement verification using the existing scene/projection/mask proof outputs. Verify alpha against silhouette coverage; do not use a colour-keyed runtime repair to obtain export PASS. Bind the final appearance PNG's actual bytes into a fresh receipt.
- [ ] Add a variant review scene enabled by `?house-variant=house.a.02`, loading the installed asset and its own metadata before world generation. Keep normal game/master-test behavior intact; set review camera to 3.0. Add Node checks for metadata-derived anchor/collision and refusing invalid metadata.
- [ ] Run the full Node suite and Python suite. Report all Blender/dependency failures explicitly; run the non-Blender subset separately without calling it the full suite.
- [ ] On a Blender-capable host, run the build script. Inspect 2048 RGBA export and receipts, install verified bytes, then review beside the master for alpha, ground contact, depth sorting, entrance and collision. Only human acceptance clears the visual pilot gate.
- [ ] Commit and package an apply-ready patch because this session's GitHub push lacks credentials. Do not claim the six-house factory or city planner is implemented by this pilot.

## Execution and Completion

Recommended execution: native, in this session. These tasks share existing compiler/renderer interfaces, so sequential implementation keeps the change coherent. An unavailable Blender host limits completion to tested code and a reproducible render command; it does not justify substituting a generated image for a Blender proof.
