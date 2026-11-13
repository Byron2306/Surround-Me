# HD-ISO-V1 Golden Four Generation Contract

Status: LOCKED PROMPT PREFIX

Every Golden Four generation begins with the exact shared contract below. Subject-specific text may follow it, but may not contradict it.

## Shared immutable prefix

Create a **single production-ready game asset for Surround Me** in a strict orthographic game-isometric view that matches a 64×32 isometric diamond world grid at 45° yaw and the established 30° elevation convention. The asset must be designed to remain crisp when Aliza is approximately **165 screen pixels tall** at the closest normal gameplay zoom.

Use realistic, high-definition, weathered materials with physically plausible wear: chipped paint, oxidized metal, broken glazing, stained masonry, cracked concrete, faded markings, grime, dead vegetation, and restrained debris appropriate to the subject. Preserve clean readable silhouettes and Diablo-like gameplay readability while evoking lonely Silent-Hill-like suburban decay.

Lighting is fixed: neutral-cool overcast ambient light with the key direction from **northwest toward southeast** and consistent southeast-cast contact shadow logic. Do not change sun/key direction between assets.

For object assets, render the complete object with **transparent background**, generous clean padding, no cropping, no matte fringe, and a clear bottom-center ground-contact point. Do not bake fog, haze, depth-of-field, vignette, bloom, cinematic lens effects, perspective convergence, or environment background into the asset. Do not render painterly softness, miniature-diorama blur, pixel-art treatment, mosaic noise, or warped geometry.

Scale references are fixed: a normal exterior door is **2.0 m** tall; a normal sedan is **4.5 m** long; one Phase A planning tile represents **2.0 m** of ground. Match these references instead of resizing the subject artistically.

Generate at the master resolution stated for the subject. Preserve realistic microtexture that survives downsampling. If projection, scale, ground contact, or lighting cannot be held exactly, regenerate rather than correcting with arbitrary runtime scale/warp.

## Subject A: suburban house

Asset ID: `building.house.suburban.01`
Master: 2048×2048 RGBA

A detached one-to-two-storey abandoned suburban residence with believable garage/porch geometry, broken windows, weathered siding or masonry, damaged roof surfaces, dead garden growth and restrained decay. The building itself must remain the dominant object. No large baked street or neighboring lot.

## Subject B: corner shop

Asset ID: `building.shop.corner.01`
Master: 2048×2048 RGBA

A low-rise abandoned corner commercial building suitable for pharmacy/grocery/diner frontage variants. Flat or shallow roof, readable shopfront bays, broken glazing, faded sign fascia without copyrighted branding, service door and realistic urban wear. Complete isolated building only.

## Subject C: sedan

Asset ID: `vehicle.sedan.01`
Master: 1536×1536 RGBA

A generic late-20th/early-21st-century four-door sedan, abandoned and weathered but structurally readable. Correct 4.5 m reference length. Dust, faded paint, minor dents, cracked or dirty windows, deflated or aged tyres. No road baked beneath it.

## Subject D: four-way road intersection

Asset ID: `road.intersection.4way.01`
Master: 2048×2048 RGBA

A strict isometric four-way asphalt intersection aligned to the canonical grid, with continuous curb/sidewalk geometry and faded road markings. Realistic cracks and patching may be present but must remain restrained because additional damage is layered as transparent decals. No buildings, vehicles, street furniture or fog.

## Negative constraints

perspective camera, vanishing point, cinematic lens, depth of field, tilt shift, miniature effect, painterly, watercolor, concept art blur, pixel art, mosaic texture, baked fog, dramatic sunset, warm golden-hour light, cropped object, white background, black background, opaque matte, floating object, inconsistent door scale, exaggerated vehicle proportions, fisheye, warped roof, impossible road topology
