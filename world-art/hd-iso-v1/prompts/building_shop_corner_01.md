# HD-ISO-V1 Golden Master Prompt — Corner Shop 01

Status: PRODUCTION READY / awaiting image generation
Asset ID: `building.shop.corner.01`
Master target: 2048×2048 RGBA PNG
Footprint: 3×2 world tiles
Anchor: bottom centre `(0.5, 1.0)`

## Immutable HD-ISO-V1 contract

Create one isolated, production-quality building asset for an isometric action RPG. Use a true orthographic isometric camera with 45° yaw and approximately 30° pitch. No perspective convergence. Match the frozen Surround Me world scale where one world tile is 2 metres and Aliza appears approximately 165 px tall at closest normal gameplay zoom. Lighting is neutral-cool overcast, with the key from northwest toward southeast and soft shadowing consistent with that direction.

The entire building must be visible with generous transparent padding. Transparent background only. No fog, no sky, no terrain, no street, no neighbouring buildings, no props extending beyond the building footprint, no depth of field, no painterly softness, no cinematic lens effects. Crisp physically believable materials that survive close gameplay zoom.

## Subject

A decaying two-storey American small-town corner shop / mixed retail building suitable for a Silent-Hill-like abandoned district. Rectangular brick construction, approximately 3 tiles by 2 tiles footprint, flat roof with low parapet, believable rooftop HVAC equipment, drain pipes, metal service door, storefront glazing, narrow awning or fascia, rear/service-side architectural detail.

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

Perspective is photographic rather than orthographic; facade angle differs from HD-ISO-V1; the building is cropped; background is opaque; roads/sidewalk are baked in; text is prominent or malformed; materials smear when downsampled; the building scale does not plausibly fit a 2 m doorway / 4.5 m sedan reference; lighting direction disagrees with the set.
