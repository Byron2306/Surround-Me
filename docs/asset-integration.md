# Phase A asset integration

Implements the supplied render plan against main `2992c78`. The first integration
includes candidate ingestion, deterministic road compilation, manifest-driven
playable preview loading, three review zooms, and acceptance verification.

## Import a Golden Four master

Requires Python 3.10+ and Pillow with WebP support. Run from the repository root:

```sh
python3 tools/ingest_world_art_candidate.py --asset-id vehicle.sedan.01 --input /absolute/path/sedan.png
python3 -m http.server 8080
```

Open `world-art/phase-a/playable-preview.html` through that server. Candidate
images are loaded for diagnostic review; planned/missing images retain explicit
diagnostics and collision footprints. Keys 1, 2, 3 select 1×, 1.5×, and 2.0625×.
Production registry approval is unchanged.

The importer checks registration, geometry, dimensions, visible alpha and clear
corners; copies immutable PNG bytes; exports lossless WebP; records both SHA-256
hashes; and sets candidate status. It refuses existing output paths and never
promotes assets. Automated alpha checks do not establish visual edge quality,
projection correctness, door scale, or an accurate contact anchor.

## Reproduce the intersection

```sh
python3 tools/build_hd_iso_intersection.py --material world-art/greyline-ground/greyline_asphalt_v2_2048.png --output /tmp/intersection.png
```

The committed intersection is a candidate, compiled from this material. Its lower
half contains a 2:1 diamond, positioned in the preview with its ground centre at
the collision/world origin. Road continuity still needs visual acceptance.

## Acceptance and remaining work

```sh
python3 tools/verify_phase_a_acceptance.py
python3 -m unittest discover -s tests -p 'test_*.py'
node --test tests/*.test.mjs
```

Acceptance intentionally exits 1 until all Golden Four are approved, their PNG
and WebP bytes match import receipts, and all eleven mandatory checklist entries
have PASS with evidence. Batch B imports remain locked until that succeeds.

The house, shop and sedan canonical masters remain missing. A02 acceptance is
not transferred to a different canonical identity. Batch B's 30 proposed subjects
remain unpromoted; existing registry geometry takes precedence over proposed
dimensions. No main-game replacement or GitHub Pages deployment is included.

Validation: 86 JavaScript tests and 7 Python tests. Browser launch is blocked in
the execution environment by its socket policy, so the live three-zoom visual
and navigation checks remain pending.
