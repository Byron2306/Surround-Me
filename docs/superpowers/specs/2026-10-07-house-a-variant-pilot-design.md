# House A Variant Contract and A-02 Pilot

Status: proposed implementation contract; not a rendered or accepted asset.

## Outcome

Generate one structurally distinct sibling of the accepted House A master through the existing Blender-governed pipeline. Verify that its actual exported geometry, appearance, alpha, anchor, entrance and collision agree before using this family to populate a planned residential block. City generation and the six-house batch follow this pilot; they are outside this implementation.

## Preserve the master

Retain `house.master.a` as the parent family and preserve existing seed-18427 outputs and tests. Add explicit variant identity rather than replacing the master's identity or copying its proof. Existing commands without a variant continue to produce the existing master.

The versioned variant contract records variant ID, parent template, structural/detail/appearance/decay seeds, allowed structural choices, and selected material/decay profiles. Seed domains remain independent: appearance or decay changes cannot alter geometry, footprint, entrance or collision. Unknown fields and unsupported values refuse; no silent correction or fallback to the master.

## Pilot geometry

`house.a.02` is a narrower, single-storey sibling with no porch:

| Property | A-02 value |
| --- | --- |
| Structural seed | 18428 |
| Footprint | 6.0 × 6.0 metres; 3.0 × 3.0 world units |
| Maximum height envelope | 4.8 metres |
| Wall height | 2.6856203614167002 metres |
| Roof | Gable; ridge axis X; pitch 33.59802181853683 degrees |
| Eave overhang | 0.3547842106675055 metres |
| Door | FRONT; 0.9 × 2.0 metres; lateral position 0.32 |
| Front window | One; lateral position 0.72; width 0.9 m; height 1.24 m; sill 0.85 m |
| Porch | Absent in geometry, detail, mesh and masks |
| Ground anchor convention | [0.5, 1.0] of the main footprint |

The pilot explicitly selects these values; the seed is provenance, not permission to override them. Derive roof rise from pitch and depth. Validate envelope, opening clearances and facade containment against the effective variant contract, rather than the master's fixed dimensions. Subsequent variants can sample supported contract ranges deterministically; they cannot invent unsupported topology.

## Pipeline integration

Resolve the effective variant before geometry compilation. Pass that same contract through geometry and detail validation. Remove the assumption that a porch must exist: absence is an explicit valid state. Detail construction must emit no porch object or porch region when absent. Surface and fidelity stages must tolerate that absence without treating it as missing evidence.

Blender consumes validated manifests and makes no new structural choices. Preserve the existing canonical orthographic camera: azimuth 45°, elevation 30°, roll 0°, ortho scale 16√2. Preserve the verified projection adapter and camera hash. Do not independently mirror, rotate, crop or refit variants to improve visual appearance.

Logical export canvas is 512 × 512; physical export is 2048 × 2048 at render scale 4, set explicitly because the current CLI defaults to scale 1. Anchor pixels come from the actual Blender scene/render transform, not the master's hardcoded [220,334]. Entrance comes from the door socket. Bounds include relevant attachment geometry when present. Runtime collision derives from ground-level blocking geometry, never transparent sprite bounds.

## Export and authority

Every final asset must be an actual RGBA PNG of the declared dimensions, with nonempty foreground and transparent exterior. Reject flattened RGB imports and dimension/hash mismatches. Blender silhouette/region masks own structural coverage; alpha repair cannot invent that authority. Any appearance processing must be intersected with the validated silhouette and accounted for in the final receipt. Unexpected attached black matte requires repair and review before acceptance; do not automatically delete legitimate dark materials to earn a PASS.

Record hashes for the variant contract, geometry, scene/camera, masks and exact final PNG. Final PNG hash and dimensions must be checked again during runtime installation. Never reuse the master's receipt for A-02. Geometry PASS, Blender/render PASS, export PASS and human in-game acceptance are separate results. Missing Blender or unfinished appearance yields REFUSE or pending review at the corresponding stage, not a release PASS.

## Acceptance and rollout

1. Regression: the existing master remains deterministic and its original tests pass.
2. Variant: A-02 compiles identically from the same contract/seeds; appearance and decay seeds leave structural bytes unchanged.
3. No porch: geometry attachments, detail output, Blender objects and structural masks agree on its absence.
4. Refusals: unknown variant, nonfinite dimensions, overlapping/out-of-facade openings, impossible roof envelope, invalid seed and mismatched receipt fail explicitly.
5. Blender: render at scale 4 and verify projection, silhouette, region coverage and anchor from the real scene.
6. Export: reject RGB/incorrect-size/stale-hash files; verify exact installed bytes.
7. Game: review A-02 beside the master at zoom 3.0, checking ground contact, front/back depth sorting, door approach, collision and absence of black artifacts.

Only after these gates pass does the factory expand to six houses for a planned lane and plots. A geometry-only pilot is useful evidence, but is not an accepted visual sibling.
