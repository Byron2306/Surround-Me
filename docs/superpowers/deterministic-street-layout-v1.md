# Deterministic Street Layout v1

Purpose: replace ad-hoc road painting with a deterministic city skeleton that can be rendered from existing road and concrete assets.

## Authority

Street geometry owns placement. Art only paints legal cells.

- one logical grid cell = one world tile
- road segments are explicit horizontal or vertical integer-grid contracts
- intersections are set unions of road cells
- curb is the first cardinal ring outside road
- sidewalk is the second ring outside curb
- road wins over curb; curb wins over sidewalk
- every output cell has one role and stable coordinates
- no RNG, camera logic, or sprite dimensions influence topology

## Current asset binding

- road: `groundRoad`
- curb: `groundConcrete`
- sidewalk: `groundConcrete`

The current compiler deliberately separates **topology** from **visual tile choice**. Later curb art can replace `groundConcrete` without changing streets.

## Curb variants

The compiler records which road edge a curb touches:

- `curb-n/e/s/w`
- straight dual-edge forms
- corner forms
- junction forms

Renderer work can map these variants onto deterministic curb cap/corner sprites without recomputing street geometry.

## First city slice

Start with one east-west residential street plus one north-south crossing. Only after the road/curb/sidewalk seam is visually accepted should lots, driveways, drains, markings, street furniture, and house sockets be added.

This module does not alter current world generation yet. It establishes the deterministic plan contract first.
