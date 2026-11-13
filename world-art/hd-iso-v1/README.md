# HD-ISO-V1 World Art Contract

This directory is the canonical world-art contract for Surround Me Phase A.

## Rule

Macro town renders define geography and composition. Runtime scenes are assembled from modular HD assets that share one frozen orthographic-isometric camera, world scale, lighting direction, bottom-contact anchor convention, and realistic material language.

## Asset lifecycle

`planned -> candidate -> approved` or `refused`

Only `approved` assets may be placed by the production world-art registry. Task 1 intentionally leaves runtime scale fields unfrozen; Task 2/3 calibrate them against Aliza and the live camera before any mass generation.

## Path and anchor conventions

- All `source` and `runtimeSource` values are repository-relative paths inside `world-art/hd-iso-v1/`.
- Transparent object assets use normalized bottom-contact anchors `[x, 1.0]`.
- Master files are never overwritten by runtime exports.
- Fog is a dedicated atmosphere layer and is not baked into structures, vehicles, roads, or props.
