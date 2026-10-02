# HD-ISO-V1 Master Template Calibration Cards

Status: **LOCKED FOR PHASE A CALIBRATION**

These cards define the structural law for reusable Surround Me asset classes. Visual variants may change only the allowed appearance fields. Projection, footprint, anchor, human scale, and physical dimensions remain governed.

## Global contract

- Projection: orthographic isometric
- Yaw: 45°
- Pitch: 30°
- Tile: 64×32 logical px
- World tile: 2.0m × 2.0m
- Closest normal zoom: 2.0625
- Aliza reference: ~165 screen px
- Lighting: northwest → southeast
- Transparent background required
- No baked street or neighborhood context
- Full object visible
- Contact plane must be unambiguous

## House Master A

**Class:** small detached suburban house  
**Footprint:** 3.75 × 3.0 tiles  
**Physical size:** 7.5m × 6.0m  
**Nominal height:** 4.8m  
**Storeys:** 1  
**Anchor:** [0.5, 1.0]  
**Door reference:** 2.0m

### PASS
- Foundation occupies the declared footprint within ±5%.
- Door and windows remain believable beside Aliza.
- Roof ridge and wall height read as a real one-storey residence.
- Immediate attached steps/stoop may remain.
- Fine grime, paint wear, roof staining, gutter detail and decay survive close zoom.

### REFUSE
- Perspective drift.
- Full yard, driveway, street, tree, fence perimeter, bins or detached clutter baked into master.
- Storey count changes.
- Footprint drift beyond tolerance.
- Dollhouse scale.

## Corner Shop Master A

**Class:** two-storey corner commercial building  
**Footprint:** 3.0 × 2.0 tiles  
**Physical size:** 6.0m × 4.0m  
**Nominal height:** 5.5m  
**Storeys:** 2  
**Anchor:** [0.5, 1.0]  
**Door reference:** 2.0m

### PASS
- Reads immediately as a corner-lot structure with two exposed street facades.
- Clearly taller and more massive than House Master A.
- Human-scale doors, glazing and upper-floor windows are coherent.
- Flat roof, HVAC, signage frame, awning and damage may vary without altering class geometry.
- Building shell occupies declared footprint within ±5%.

### REFUSE
- Tiny two-storey mass relative to Aliza.
- Perspective or facade-angle drift.
- Sidewalk, parking lot, poles, bins, vehicles or surrounding block baked into master.
- Corner-lot identity lost.

## Sedan Master A

**Class:** abandoned mid-size four-door sedan  
**Footprint:** 2.25 × 0.9 tiles  
**Physical size:** 4.5m × 1.8m  
**Nominal height:** 1.5m  
**Anchor:** [0.5, 1.0]

### PASS
- Wheel/body contact fits declared footprint within ±3%.
- Roof height and body length read correctly beside Aliza.
- Tires visually contact the ground plane.
- Paint, rust, glass damage, hubcaps and mild wreck state may vary.

### REFUSE
- Vehicle-class drift into hatchback, SUV, sports car or limousine.
- Ground plane or parking bay baked into asset.
- Perspective drift or incorrect wheel contact.
- Toy-scale appearance.

## Variant factory rule

Variants inherit a locked master class. Randomization may alter **appearance**, never geometric law.

`MASTER TEMPLATE → CONTROLLED VARIANT → MODULAR DRESSING → DISTRICT ASSEMBLY`

A generated variant is REFUSED if it changes any forbidden field in `master-template-dna-v1.json`.
