"""Import a canonical PNG and reproducible lossless WebP as a candidate."""
import argparse
import json
from pathlib import Path
from world_art_pipeline import ingest

if __name__ == '__main__':
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument('--root', type=Path, default=Path(__file__).resolve().parents[1])
    p.add_argument('--asset-id', required=True)
    p.add_argument('--input', type=Path, required=True)
    a = p.parse_args()
    try:
        print(json.dumps(ingest(a.root, a.asset_id, a.input), indent=2))
    except (ValueError, OSError, KeyError) as e:
        p.exit(1, f'REFUSE: {e}\n')
