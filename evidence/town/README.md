# North Suburb / Market Street

22 authored homes total: the existing four Fringe Street homes plus 18 additional occupied residential parcels. Four new commercial premises use the shared corner-shop candidate: Grocer, Pharmacy, Hardware and Laundrette. These are exterior premises; shop interiors, resident NPCs and trading interactions are not implemented by this expansion.

The default entry and `?district=town` load the expansion, retain the existing Civic Loop, and start Aliza at Cedar Street. Explicit `?district=civic`, `?suburb=1&fringe=4`, and `?district=verge` retain their older entry behavior.

- Three residential streets, linked north/south roads and connected Market Street.
- Addressed homes, parcel ground, concrete door approaches and commercial signs.
- Plaster and brick house candidates plus shared corner-shop candidate, exported as 1024px WebP derivatives. Original generated images remain separate; no canonical art acceptance status is changed.
- Authored-area blocker clearing and edge-haze damage exemption.
- `overview.webp` is an offline overview rendered from the expansion's ground and building functions; it is not an interactive gameplay screenshot.

Validation: Node suite passes. Interactive browser validation was blocked by the preview environment: local Chromium failed on a restricted Unix socket and the shared browser could not reach the local server. Camera conformance, final physical scale and human visual acceptance remain pending. This branch has not been deployed to GitHub Pages.

## Rendering correction

- Ground chunks now paint terrain before streets across the entire town and Civic Loop. This removes grass strips that previously overwrote roads at eight-tile chunk boundaries.
- House, shop and chapel facades use measured source contact points and separate affine facade transforms to align their base edges with the 64x32 world projection while keeping walls vertical. This is a renderer correction; it does not confer final canonical art approval.
- Existing Holdfast building identities, collision footprints and NPCs are retained. The chapel uses a new realistic sprite; support buildings use the town house/shop candidates. A paved courtyard replaces the old brown floor.
- Market Street shop parcels move east of the Holdfast to avoid displacing its buildings. All nine original Holdfast structures survive the town installation.
- 93 Node tests pass. The updated offline overview is checked; interactive verification on the player's local server remains pending.
