# North Suburb / Market Street

22 authored homes total: the existing four Fringe Street homes plus 18 additional occupied residential parcels. Four new commercial premises use the shared corner-shop candidate: Grocer, Pharmacy, Hardware and Laundrette. These are exterior premises; shop interiors, resident NPCs and trading interactions are not implemented by this expansion.

The default entry and `?district=town` load the expansion, retain the existing Civic Loop, and start Aliza at Cedar Street. Explicit `?district=civic`, `?suburb=1&fringe=4`, and `?district=verge` retain their older entry behavior.

- Three residential streets, linked north/south roads and connected Market Street.
- Addressed homes, parcel ground, concrete door approaches and commercial signs.
- Plaster and brick house candidates plus shared corner-shop candidate, exported as 1024px WebP derivatives. Original generated images remain separate; no canonical art acceptance status is changed.
- Authored-area blocker clearing and edge-haze damage exemption.
- `overview.webp` is an offline overview rendered from the expansion's ground and building functions; it is not an interactive gameplay screenshot.

Validation: Node suite passes. Interactive browser validation was blocked by the preview environment: local Chromium failed on a restricted Unix socket and the shared browser could not reach the local server. Camera conformance, final physical scale and human visual acceptance remain pending. This branch has not been deployed to GitHub Pages.
