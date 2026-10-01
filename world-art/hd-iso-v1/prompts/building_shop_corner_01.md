# HD-ISO-V1 Golden Master Prompt — Corner Shop 01

Status: PRODUCTION READY / awaiting image generation
Asset ID: `building.shop.corner.01`
Master target: 2048×2048 RGBA PNG
Physical footprint: **6.0 m × 4.0 m**
Frozen footprint: **3 × 2 world tiles** at 2.0 m/tile
Nominal overall height: **~5.5 m**
Anchor: bottom centre `(0.5, 1.0)`

## Immutable HD-ISO-V1 contract

Create one isolated, production-quality building asset for an isometric action RPG. Use a true orthographic isometric camera with 45° yaw and approximately 30° pitch. No perspective convergence. Match the frozen Surround Me world scale where one world tile is 2 metres and Aliza appears approximately 165 px tall at closest normal gameplay zoom. Lighting is neutral-cool overcast, with the key from northwest toward southeast and soft shadowing consistent with that direction.

The entire building must be visible with generous transparent padding. Transparent background only. No fog, no sky, no terrain, no street, no neighbouring buildings, no props extending beyond the building footprint, no depth of field, no painterly softness, no cinematic lens effects. Crisp physically believable materials that survive close gameplay zoom.

## Physical scale calibration

The building occupies a **6.0 m × 4.0 m** ground footprint and is approximately **5.5 m high** from ground contact to parapet/top mechanical silhouette. Use a standard **2.0 m doorway** as the primary human-scale reference. Ground-floor storefront glazing, service doors, upper windows, brick courses and rooftop HVAC must all remain proportional to that doorway.

At the frozen 64×32 isometric grid, a 3×2 footprint produces a canonical projected draw width of **160 logical pixels** before camera zoom and approximately **330 screen pixels** at the normal 2.0625 gameplay zoom. Do not enlarge the building to showcase details. Detail density must come from the 2048 master, not from cheating world scale.

Use these scale references together:
- Aliza: 80 logical px tall / approximately 165 screen px at normal zoom
- standard doorway: 2.0 m tall
- sedan: 4.5 m long × 1.8 m wide
- shop footprint: 6.0 m × 4.0 m

## Subject

A decaying two-storey American small-town corner shop / mixed retail building suitable for a Silent-Hill-like abandoned district. Rectangular brick construction, flat roof with low parapet, believable rooftop HVAC equipment, drain pipes, metal service door, storefront glazing, narrow awning or fascia, rear/service-side architectural detail.

The building should feel like a once-ordinary grocery/pharmacy/hardware-type premises rather than a fantasy structure. Use generic fictional signage shapes only, with no important readable text. Signs may be faded, peeling, sun-bleached and partially broken. Ground floor storefront windows should include believable cracked or missing panes and dark interior depth without becoming pitch-black featureless holes. Upper windows should vary between dirty, cracked, partly boarded and broken.

## Material language

- weathered red/brown brick with individual brick-course readability
- aged concrete lintels and parapet caps
- rusted metal awning/fascia hardware
- dusty, grimy glazing with broken sections
- stained masonry around gutters and downpipes
- oxidised rooftop HVAC housings and vents
- subtle moss/weeds only where physically plausible on the structure itself
- peeling paint, water staining, soot, faded commercial trim
- no exaggerated apocalypse destruction; neglect first, catastrophe second

Close-camera quality target: the same micro-detail density as the recovered `Abandoned urban block in decay` reference, including readable masonry texture, window frames, rooftop mechanical detail, grime, chipped edges and material variation.

## Composition / gameplay rules

- canonical orientation faces southeast toward the player camera
- bottom-centre contact anchor must be obvious and stable
- complete roof, facade, side wall and rear edge visible within canvas
- silhouette must remain readable at reduced runtime size
- do not bake sidewalk, road, curb, trash piles, cars, poles, fog, vegetation masses or neighbouring structures into the asset
- a very narrow soft ambient-occlusion/contact shadow directly under the wall footprint is acceptable; no large painted ground shadow
- no people, corpses, monsters or narrative props

## Reject if

Perspective is photographic rather than orthographic; facade angle differs from HD-ISO-V1; the building is cropped; background is opaque; roads/sidewalk are baked in; text is prominent or malformed; materials smear when downsampled; doorway/window proportions violate the 2.0 m human-scale reference; the building does not plausibly fit beside the 4.5 m sedan; lighting direction disagrees with the set.
