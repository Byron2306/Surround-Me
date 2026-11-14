"""Exit nonzero until Golden Four bytes and mandatory visual checks pass."""
import argparse
import json
from pathlib import Path
from world_art_pipeline import verify

if __name__ == '__main__':
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument('--root', type=Path, default=Path(__file__).resolve().parents[1])
    a = p.parse_args()
    errors = verify(a.root)
    print(json.dumps({'status': 'REFUSE' if errors else 'PASS', 'errors': errors}, indent=2))
    raise SystemExit(bool(errors))
