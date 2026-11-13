# HD-ISO-V1 Calibration Report

Date: 2026-09-30
Status: FROZEN FOR PHASE A

## Runtime evidence

The current Surround Me runtime declares:

- `TILE_W = 64`
- `TILE_H = 32`
- `CAMERA_ZOOM = 2.0625`
- player sprite render height `spriteH = 80` pixels before camera scaling
- the world canvas applies `ctx.scale(camera.zoom, camera.zoom)` before world rendering

Therefore the normal gameplay Aliza reference height is `80 × 2.0625 = 165 px` on screen.

## Canonical HD-ISO-V1 values

- Projection: orthographic game-isometric, 45° world yaw / 30° elevation convention
- Tile diamond: 64 × 32 px before camera zoom
- Closest normal gameplay zoom: 2.0625
- Aliza reference screen height: 165 px
- Reference door height: 2.0 m
- Reference car length: 4.5 m
- World planning tile: 2.0 m per tile for Phase A footprint planning
- Asset scale tolerance: ±3% before regeneration or metadata review is required

## Rationale

Phase A inherits the current runtime projection instead of warping every new asset to a new camera. This protects combat readability and existing movement while giving the art pipeline a fixed scale target. New masters must be generated to this contract rather than corrected with arbitrary per-asset runtime scale constants.

The `165 px` Aliza target is the close-normal gameplay acceptance reference. The One Perfect Block is judged at this scale, not only at map zoom.
