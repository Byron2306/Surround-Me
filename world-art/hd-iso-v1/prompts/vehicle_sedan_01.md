# HD-ISO-V1 Golden Master Prompt — Sedan 01

Status: PRODUCTION READY / awaiting image generation
Asset ID: `vehicle.sedan.01`
Master target: 1536×1536 RGBA PNG
Physical size: **4.5 m long × 1.8 m wide × ~1.5 m high**
Frozen footprint: **2.25 × 0.9 world tiles** at 2.0 m/tile
Anchor: bottom centre `(0.5, 1.0)`

## Immutable HD-ISO-V1 contract

Create one isolated production-quality vehicle asset for an isometric action RPG. True orthographic isometric projection, 45° yaw and approximately 30° pitch, no perspective convergence. Match the frozen Surround Me world scale. Lighting is neutral-cool overcast, key from northwest toward southeast, with restrained physically believable reflections and soft shadowing.

Transparent background only. Entire vehicle visible with generous padding. No road, no curb, no scenery, no fog, no depth of field, no cinematic lens blur, no painterly treatment.

## Subject

A late-1980s to mid-1990s ordinary four-door sedan, abandoned for years in a decaying American small town. Generic unbranded design, not recognisably tied to a real manufacturer. Canonical colour: faded beige / dusty taupe with oxidised clearcoat and grime. Vehicle remains structurally readable and mostly intact, but neglected: dusty glass, light rust around arches and seams, faded paint, one slightly deflated tyre, small dents, minor cracked lamp or trim damage.

The car should feel mundane and eerily plausible rather than post-apocalyptic spectacle. No crushed roof, no giant missing doors, no flames, no vegetation engulfing the whole car.

## Scale calibration

The model must preserve a real-world body envelope of approximately **4.5 m × 1.8 m × 1.5 m**. In Surround Me this maps to **2.25 × 0.9 tiles** because one world tile is 2.0 m. At the frozen 64×32 isometric diamond this produces a canonical projected draw width of **100.8 logical pixels** before camera zoom and approximately **207.9 screen pixels** at the normal 2.0625 gameplay zoom.

Use these scale references together:
- Aliza: 80 logical px tall / approximately 165 screen px at normal zoom
- standard doorway: 2.0 m tall
- sedan body: 4.5 m long, 1.8 m wide

Do not enlarge the car to make it visually impressive. It must read as a correctly scaled ordinary sedan beside Aliza and the storefront.

## Detail language

- distinct window frames and door seams
- readable tyre sidewalls/tread at master size
- dull dirty glass with subtle interior silhouettes
- corroded wheel rims/hubcaps
- fine scratches and small dents
- oxidised paint and rain streaking
- slightly mismatched grime on lower panels
- readable headlights/tail lights and bumper geometry

Close-camera quality target: the abandoned sedan visible in the recovered `Abandoned urban block in decay` reference, but recreated as a clean isolated asset with higher local detail and no baked environment.

## Composition / gameplay rules

- canonical orientation: vehicle longitudinal axis aligned to a primary isometric road direction, nose toward southeast
- bottom-centre contact anchor stable at tyre-ground contact
- entire silhouette, mirrors and bumpers inside canvas
- no driver, passengers, corpse, luggage, debris pile or narrative object baked in
- no large painted ground plane; only tight soft tyre/contact AO is acceptable
- proportions must remain plausible beside a 2 m door and 165 px Aliza close-zoom reference

## Reject if

Camera is perspective rather than orthographic; wheels do not sit on one coherent ground plane; body proportions look toy-like; body envelope departs materially from 4.5 m × 1.8 m; background is opaque; dramatic crash damage dominates; vehicle is too futuristic; reflections imply a different light direction; texture detail collapses when downsampled; orientation does not align with the HD-ISO-V1 road grid.
