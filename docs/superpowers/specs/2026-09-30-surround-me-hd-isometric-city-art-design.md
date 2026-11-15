# Surround Me HD Isometric City Art System

Date: 2026-09-30
Status: LOCKED DESIGN
Branch: `design/hd-isometric-city-art-system`

## Purpose

Build Surround Me's world as a coherent high-definition isometric city system that preserves the large-scale composition of the recovered town concepts while remaining crisp, realistic, and readable when Aliza is shown at normal close gameplay zoom.

The master-town renders are spatial references, not runtime textures. Runtime environments are assembled from modular HD assets with a strict shared camera, scale, lighting, anchor, and material contract.

## Core Principle

**Macro layout controls geography. Modular HD assets control fidelity.**

The production pipeline is:

`master city plan -> district square IDs -> reference crop -> HD regeneration / asset assembly -> iso alignment -> runtime asset -> Aliza-scale validation`

No category is mass-generated until one representative asset passes in-engine at the closest intended gameplay camera.

## Canonical Visual Contract

Every world asset must obey the same contract:

- true isometric / orthographic projection
- identical camera pitch and yaw
- identical world scale
- identical lighting direction and shadow logic
- realistic weathered materials
- transparent background where appropriate
- complete object visible, no clipping
- clean and documented ground-contact anchor
- no baked fog except dedicated atmospheric overlays
- no cinematic depth of field
- no perspective-lens distortion
- no painterly softness
- physically plausible grime, wear, damage, and age
- texture detail sufficient to survive Aliza-scale gameplay zoom

Target visual language: **Silent Hill suburban decay + Diablo readability + realistic architectural texture.**

## Phase A: The One Perfect Block

Before building the city, prove the language on one four-way intersection.

Required minimum slice:

- 1 four-way intersection
- 2 detached houses
- 1 apartment / mixed-use block
- 2 shops
- 1 petrol station or garage
- 4 vehicle types
- traffic lights
- streetlights
- utility poles
- overhead wires
- bins / dumpsters
- road signs
- cracked-road variants
- sidewalk / curb variants
- trash and clutter
- weeds / encroachment
- fences
- fog overlay
- Aliza placed at closest normal gameplay zoom

### Phase A Exit Gate

The block must look excellent at the closest normal gameplay camera. If scale, texture density, projection, or readability fails, the canonical contract is corrected before any category-scale generation begins.

## Asset Families

### 1. Roads and Ground

Base surfaces:

- asphalt
- old asphalt
- patched asphalt
- heavily cracked asphalt
- concrete
- sidewalk
- dirt shoulder
- gravel
- parking lot
- industrial concrete

Geometry:

- straight N/S and E/W
- four corners
- four T-junctions
- four-way intersection
- cul-de-sac
- driveway mouths
- parking entrances
- alley entrances
- service roads

Transparent road decals:

- potholes
- longitudinal cracks
- alligator cracking
- patch repairs
- faded center lines
- broken lane markings
- oil stains
- tyre marks
- manholes
- drains
- repaired trenches
- puddles
- weeds through asphalt
- debris patches

Decay should be composable. Avoid baking every crack into every road tile.

### 2. Residential Pack

Base buildings should include roughly 12-20 architectural families before variants:

- bungalow
- ranch house
- two-storey detached house
- duplex
- townhouse
- damaged Victorian
- prefab / low-cost house
- affluent suburban house
- corner-lot house
- house with garage
- house with carport
- abandoned shell

Secondary residential assets:

- garages
- sheds
- fences
- gates
- mailboxes
- driveways
- porches
- pools
- swings
- trampolines
- garden furniture
- broken lawn equipment
- bins
- RVs / trailers
- satellite dishes
- garden walls

### 3. Commercial Pack

- grocery store
- pharmacy
- convenience store
- diner
- takeaway
- small retail unit
- laundromat
- hardware shop
- pawn shop
- motel
- strip mall
- mechanic
- tyre shop
- petrol station
- small supermarket
- bank
- abandoned office
- two-storey mixed-use building
- department-store shell

Facade variants may include boarded windows, broken glass, alternate awnings, faded signage, shutters, graffiti, collapsed entrances, burned facades, and intact-but-abandoned versions.

### 4. Civic and Landmark Pack

- police station
- fire station
- hospital
- clinic
- school
- church
- cemetery gate / chapel
- town hall
- courthouse
- library
- post office
- community hall
- water tower
- radio tower

Hospitals, churches, and other major landmarks are hero assets and receive larger masters and stricter review.

### 5. Industrial Pack

- warehouse
- factory
- machine shop
- loading dock
- fuel depot
- silos
- water-treatment building
- electrical substation
- generators
- tanks
- piping
- cooling equipment
- stacks / chimneys
- gantries
- shipping containers
- forklifts
- industrial fencing
- service sheds

### 6. Vehicle Pack

- sedan
- hatchback
- station wagon
- pickup
- SUV
- van
- panel van
- ambulance
- police car
- fire appliance
- delivery truck
- bus
- taxi
- motorcycle
- tow truck

Important vehicles should support intact-abandoned, damaged, wrecked, and burned states. Directional variants should be generated where runtime rotation degrades realism.

### 7. Street Furniture and Infrastructure

- traffic lights
- stop signs
- street-name signs
- road signs
- lamp posts
- power poles
- transformers
- junction boxes
- hydrants
- bollards
- parking meters
- bus stops
- benches
- utility cabinets
- dumpsters
- wheelie bins
- mailboxes
- newspaper boxes
- bike racks

Power poles and wire anchor points are isolated assets. Wires should preferably be drawn dynamically or composed as transparent overlays rather than baked into large scene images.

### 8. Urban Clutter

- trash bags
- loose paper
- cardboard
- pallets
- tyres
- crates
- barrels
- bottles
- cones
- barricades
- shopping carts
- broken signs
- mattresses
- chairs / tables
- abandoned bicycles
- roadworks equipment
- rubble
- bricks
- pipes
- broken glass
- tarps
- dead appliances

### 9. Vegetation and Encroachment

- dead grass tufts
- weeds
- sidewalk grass
- shrubs
- hedges
- dead trees
- living trees
- ivy
- vines
- moss
- leaf piles
- branches
- overgrown fence lines
- neglected gardens

### 10. Damage and Decay Overlays

- boarded windows
- broken-window overlays
- wall cracks
- scorch
- graffiti
- water stains
- moss
- exposed brick
- collapsed plaster
- broken roof sections
- rust
- smashed doors
- police tape
- optional blood / organic contamination where appropriate
- Samsarra corruption layers

Prefer reusable overlays over multiplying whole-building variants unnecessarily.

## Greyline and Samsarra Visual Layers

Physical geography remains stable while perception and visual state change.

### Restraint

- desaturation
- severe quietness
- emptier roads
- harder shadows
- narrowed visibility
- distant fog
- sterile order

### Flux

- maximum environmental readability
- balanced fog
- coherent lighting
- truthful spatial cues

### Compulsion

- heightened contrast
- clutter density
- visual noise
- harsher lights
- peripheral movement overlays
- distorted signage
- aggressive haze

### Samsarra

- alternate facade textures
- corrupted windows
- impossible darkness
- violet-grey contamination
- geometry-adjacent manifestations
- architectural / organic distortion
- environmental repetition

The system should transform experience without requiring a separate full town map.

## District Grammars

Residential: houses + yards + local roads + school/church + small shops.

Commercial: shops + parking + signage + service alleys + mixed-use buildings.

Civic: hospital/police/fire/school + open lots + formal street geometry.

Industrial: wide roads + warehouses + yards + fencing + tanks + heavy clutter.

Transitional fringe: petrol stations + motels + trailers + scrub + broken retail.

Downtown: mid-rise blocks + offices + dense road fabric + parking structures.

Recovered macro-town artwork remains a planning and composition reference, not a direct runtime background.

## Source Resolution Strategy

Suggested master classes:

- small props: 1024-1536 px
- normal buildings / vehicles: ~2048 px
- hero buildings / large structures: 3072-4096 px

Keep three stages where useful:

`MASTER -> CLEANED -> RUNTIME`

Example:

`hospital_master_4096.png -> hospital_clean_4096.png -> hospital_runtime_1536.webp`

Final runtime dimensions are validated against the real camera rather than selected by habit.

## Mandatory QC Gauntlet

Every asset receives PASS / REFUSE against:

1. Projection: aligns with canonical iso grid.
2. Scale: doors, windows, vehicles, and props are believable beside Aliza.
3. Lighting: shadow direction and softness match the world contract.
4. Anchor: object sits correctly on terrain.
5. Transparency: no matte halo, clipping, or baked background where forbidden.
6. Texture: close-camera detail survives without becoming noisy.
7. Style: asset belongs beside previously approved masters.
8. Gameplay readability: collision / walkable boundaries remain understandable.
9. Repetition: nearby duplicate use does not immediately expose the asset library.

## Production Order

1. Freeze canonical camera / scale reference.
2. Generate minimal road kit.
3. Build Phase A One Perfect Block.
4. Validate with Aliza at close camera.
5. Expand residential pack.
6. Expand vehicles and clutter.
7. Expand commercial pack.
8. Build civic landmarks.
9. Build industrial pack.
10. Add vegetation and encroachment.
11. Add damage decals.
12. Add Greyline / Samsarra visual variants.
13. Assemble district grammars and town-scale world.

## Non-Negotiable Production Rule

**Never mass-generate a category before one representative example passes in-engine.**

Generate one hospital and test it. Generate one shop and test it. Generate one road intersection and test it. Generate one vehicle and test it. Freeze scale, camera, lighting, texture density, and anchor behavior only after these representatives prove the contract.

## First Implementation Milestone

### SURROUND ME WORLD ART PHASE A: THE ONE PERFECT BLOCK

Deliverable: one complete HD four-way intersection environment that looks excellent with Aliza at normal gameplay zoom and demonstrates the canonical road, building, vehicle, prop, vegetation, lighting, and atmospheric language.

Only after this passes does the project enter asset-factory mode.