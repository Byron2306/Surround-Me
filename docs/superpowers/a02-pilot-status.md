# A-02 governed pilot

A-02 is a 6 × 6 metre, single-storey, no-porch sibling of `house.master.a` with structural seed 18428. The legacy master compiler remains unchanged. The strict variant contract, optional-porch Blender stages, exact export verifier and runtime review loader are implemented.

Run on a host with Blender, Python, Pillow and pytest:

```bash
bash tools/build_house_a02.sh
```

Set `BLENDER_BIN` to the Blender executable if it is not on PATH. The script stops if compile, render, proof or export refuses. Export applies the canonical `mirror_x` projection adapter to the Blender beauty pass; it does not remove pixels by colour. Installation compares exact alpha with the mirrored structural silhouette and binds source manifests, structural masks and final PNG bytes. Content-addressed PNGs and receipts are installed before one atomic metadata pointer switch.

After successful installation, open the running game at `?house-variant=house.a.02`. The review places A-02 beside the existing master at camera zoom 3.0. Normal gameplay retains zoom 2.4. A missing or mismatched variant asset stops the review with a visible reason. Existing master runtime PNG remains required for the comparison.

## Gates

- Geometry/detail/surface/fidelity and runtime tests: verified in this session.
- Legacy master seed-18427 canonical geometry: identical bytes to the parent revision.
- Blender: unavailable in this environment; build returns render REFUSE. No new rendered asset or visual PASS is claimed.
- Full Python collection: blocked by six existing Blender modules importing unavailable `bpy`; a separate focused non-Blender suite is reported, not a full-suite PASS.
- Human review: PENDING. Check alpha, ground contact, depth sorting, entrance clearance, collision and relative size before accepting the pilot.

The city planner and six-house variety factory remain subsequent work. This pilot establishes one structural sibling and its governed export path.

## Validation and review record

- Node suite: 41 passed.
- Focused Python regression suite: 66 passed, 1 skipped (Blender-only variant test).
- CLI compile, validate and render-refusal regressions: 3 passed, 4 deselected.
- A-02 build attempted: REFUSE at render because `blender` is absent.
- Fresh independent code review found stale scene/mask authority, installation pointer safety and review zoom issues. These were corrected and covered by regression checks. No second review was requested.
- Full non-Blender run was interrupted during existing expensive generative checks; it is not reported as passing.
- Implementation task ledger: contract/compiler, optional-porch pipeline and export/runtime code complete. Render and human visual gates remain pending.
