# House A G1.8 In-Game Incarnation Test

Status: **READY FOR HUMAN GAME-SCALE REVIEW**

Launch the existing game with:

```text
?house-test=1
```

The test scene injects one governed `house.master.a` near the Holdfast.

## Frozen game incarnation law

- logical sprite canvas: 512 x 512
- physical source master: 2048 x 2048
- canonical sprite anchor: [220, 334] logical pixels
- world footprint: 3.75 x 3.0 game units
- collision bounds relative to anchor:
  - X: -1.875 .. +1.875
  - Y: -3.0 .. 0.0
- game camera zoom remains 2.0625
- projection remains the existing 64 x 32 dimetric law

The runtime must not eyeball-rescale the asset or invent a new collision box.

## Human acceptance checks

- Aliza reads at plausible scale beside the building.
- Ground contact is convincing.
- House anchor does not slide relative to the tile field.
- Collision follows the footprint rather than the visible transparent canvas.
- The sprite retains useful detail at normal and closest gameplay scale.
- No black/white alpha fringe is visible.
- Depth sorting reads correctly when Aliza walks in front of and behind the anchor line.
- The building still reads as the accepted G1.8 House A master.

This test intentionally precedes the House A Variant Factory.
