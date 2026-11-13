# Surround Me — Phase A: One Perfect Block

Status: **IN PROGRESS / REFUSE PRODUCTION PROMOTION**

This directory is the controlled close-camera proving ground for the HD-ISO-V1 city art system.

## What exists now

- `calibration-preview.html` — fixed-camera art calibration board: recovered house + deterministic HD intersection + Aliza scale reference + explicit missing Golden Master slots.
- `street-layout-preview.html` — civil-geometry diagnostic view for carriageway, lots, parking, crossings, pedestrian routes, street-furniture zones and Golden Four anchors.
- `playable-preview.html` — WASD/arrow-key playable close-camera murder chamber using the real Phase A scene loader, collisions, actual Aliza art, recovered house candidate and deterministic intersection prototype.
- `one-perfect-block.json` — deterministic scene placement.
- `street-layout-v1.json` — frozen civil geometry for the proving block.
- `scene.js` — deterministic scene loading / depth / collision extraction.
- `player.js` — deterministic dt-scaled player movement and collision.
- `acceptance-checklist.json` — refusal-first visual and gameplay acceptance gate.

## Launch locally

From the repository root, serve files over HTTP rather than opening the HTML with `file://` because the previews load JSON and image assets with `fetch`.

```bash
python3 -m http.server 8080
```

Then open:

- `http://127.0.0.1:8080/world-art/phase-a/calibration-preview.html`
- `http://127.0.0.1:8080/world-art/phase-a/street-layout-preview.html`
- `http://127.0.0.1:8080/world-art/phase-a/playable-preview.html`

## Playable controls

- `WASD` or arrow keys: move Aliza
- `R`: reset to Phase A spawn

The playable preview deliberately uses a **diagnostic-only registry** so candidate/planned footprints can be inspected. The production `WorldArtRegistry.require()` remains approval-gated and continues to refuse every asset whose manifest status is not `approved`.

## Frozen scale

- isometric diamond: `64 × 32` logical px
- world tile size: `2.0 m`
- closest normal zoom: `2.0625`
- Aliza: `80` logical px / approximately `165` screen px
- sedan: `4.5 m × 1.8 m` = `2.25 × 0.9` tiles
- corner shop: `6.0 m × 4.0 m` = `3 × 2` tiles
- intersection: `8.0 m × 8.0 m` = `4 × 4` tiles

## Golden Four gate

Current honest state:

1. `building.house.suburban.01` — **candidate**, recovered original Surround Me master.
2. `road.intersection.4way.01` — **reproducible prototype**, deterministic source compiler exists; final binary/visual acceptance pending.
3. `building.shop.corner.01` — **planned**, generation DNA frozen, master missing.
4. `vehicle.sedan.01` — **planned**, generation DNA frozen, master missing.

No mass city asset generation and no blueprint materialization until all four survive the shared calibration/murder-test gate.
