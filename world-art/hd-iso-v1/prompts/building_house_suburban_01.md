# HD-ISO-V1 Golden Master Prompt — Suburban House 01

Status: PRODUCTION READY / awaiting image generation
Asset ID: `building.house.suburban.01`
Master target: 2048×2048 RGBA PNG
Physical footprint: **7.5 m × 6.0 m**
Frozen footprint: **3.75 × 3.0 world tiles** at 2.0 m/tile
Nominal overall height: **~4.8 m to roof ridge**
Anchor: bottom centre `(0.5, 1.0)`

## Why this replacement exists

The recovered original Surround Me `house2` image is visually excellent but is **REFUSED as a production building asset** because it bakes an entire lot into one image: curb, sidewalk, driveway, mailbox, fence, bins, weeds, tyres, debris and yard dressing. That prevents close-camera interaction, independent Greyline mutation, procedural lot variation and believable reuse.

This Golden Master must preserve the old image's material/detail language while isolating **the building structure only**.

## Immutable HD-ISO-V1 contract

Create one isolated production-quality suburban house for an isometric psychological action RPG. True orthographic isometric projection, 45° yaw and approximately 30° pitch, with no perspective convergence. Match Surround Me's frozen 64×32 logical-pixel isometric grid, 2.0 m world tiles and normal gameplay zoom of 2.0625.

Lighting is neutral-cool overcast, key from northwest toward southeast. Shadows are soft and restrained. Transparent background only. Entire structure visible with generous padding and a stable bottom-centre ground-contact anchor.

## Subject

A small, ordinary late-20th-century American detached suburban house with an attached single-car garage. It should feel mundane, plausible and quietly abandoned rather than theatrically ruined.

Architecture:
- one main storey
- shallow-to-medium pitched asphalt-shingle roof
- attached single-car garage integrated into the building mass
- small front porch / two or three entrance steps physically attached to the structure
- timber or weatherboard cladding with modest brick or masonry base accents
- ordinary residential windows, some dirty/cracked/partly boarded
- gutters, downpipes, vents, chimney or small flue where plausible
- rear/service-side wall detail sufficient to avoid a cardboard facade

Decay language:
- faded paint and weathered timber
- aged roof shingles with believable patching and leaf accumulation on the roof itself
- grime and water streaks below gutters
- broken or dirty glazing
- modest rust on fittings
- minor structural neglect, not spectacular collapse

## Strict modularity rule

**BUILDING ONLY.** Do not include:
- lawn or grass patch
- driveway slab extending away from the garage
- street or road
- curb or gutter
- sidewalk or path extending away from the doorstep
- fence or gate
- mailbox
- bins, dumpster or trash bags
- tyres, pallets, furniture or debris piles
- trees, hedges, bushes or free-standing weeds
- parked vehicles
- fog or atmospheric bank
- free-standing lamp posts, utility poles or signs

A tiny structure-attached threshold, porch slab and very tight contact/AO shadow are acceptable. Nothing else may create a reusable 'mini-scene' around the house.

## Physical scale calibration

The outer building envelope is approximately **7.5 m × 6.0 m**, with roof ridge around **4.8 m**. Use a standard **2.0 m exterior door** as the primary human-scale reference.

Use these references together:
- Aliza: 80 logical px tall / approximately 165 screen px at normal zoom
- standard door: 2.0 m tall
- sedan: 4.5 m × 1.8 m
- house envelope: 7.5 m × 6.0 m

Do not enlarge windows, doors or garage openings for readability. Detail density must come from the 2048 master.

## Close-camera texture target

At closest normal gameplay zoom the asset must retain:
- individual roof-shingle rhythm
- readable weatherboard/plank courses
- window-frame geometry
- garage-panel geometry
- gutter/downpipe separation
- chipped paint, grime and staining
- damaged glass edges
- subtle material differences between timber, brick, roofing, glass and metal

Aim for the realism and texture density of the recovered detailed urban block, not the painterly softness of the original whole-town renders.

## Composition / gameplay rules

- canonical front orientation toward southeast
- complete roof silhouette visible
- complete garage/body footprint visible
- stable bottom-centre anchor at structural ground contact
- no clipping at any edge
- no opaque matte or checkerboard baked into pixels
- no important readable brand/logo text
- no people, corpses, monsters or narrative props

## Reject if

Any yard/road/curb/driveway/fence/mailbox/free-standing clutter is baked in; camera is perspective; building is cropped; door scale is implausible; garage scale cannot fit an ordinary sedan; material detail smears at runtime downsample; lighting conflicts with northwest-to-southeast overcast contract; background is not true transparency; the asset looks like a diorama rather than an isolated building.
