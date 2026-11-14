# Occupied Suburb and Commercial Street Implementation Plan

**Goal:** Fill connected residential blocks with 18 additional homes and begin a four-shop commercial street connected to the existing four-house Fringe Street and Civic Loop.
**Architecture:** A deterministic town-expansion module supplies streets, parcels, structures, signs and chunked ground. Existing Canvas renderer and collisions consume it. New art remains candidate artwork, with no changes to canonical Phase A approval records.
**Tech Stack:** JavaScript ES modules, Canvas, Node tests, generated PNG sprites.
**Spec:** User request in this session: a fully occupied suburb and beginning of commercial district.

- [x] Define 18 occupied parcels and four shops with unique addresses, yards and door approaches; connect three residential streets and a commercial street to the existing network.
- [x] Test footprints, continuous access, world limits and connected roads, then implement deterministic plan and ground chunks.
- [x] Integrate art, depth ordering, collisions, signs and authored-area haze protection; expose the town as the default experience while preserving explicit legacy district URLs.
- [x] Run existing tests and browser smoke checks, inspect a rendered view, then commit a reviewable branch.

Review focus: intersections remain connected; door routes remain outside all buildings; procedural blockers are cleared only in authored regions; authored town does not take edge damage; missing art fails visibly; canonical art approvals remain unchanged.

Validation: 88 Node tests pass; expansion overview rendered with the actual ground/building functions. Interactive browser verification blocked by unavailable browser connection; no claim of completed in-game camera or art acceptance.
