from __future__ import annotations

import argparse
import json
from pathlib import Path

from .compile_geometry import compile_template, manifest_dict
from .geometry.validation import validate_house_a


def _repo_root() -> Path:
    return Path(__file__).resolve().parents[2]


def _template_data(root: Path) -> dict:
    return json.loads((root / "world-art/hd-iso-v1/templates/house-master-a.json").read_text())


def _default_out(root: Path, template_id: str) -> Path:
    return root / "build" / "hd-iso" / template_id / "geometry.json"


def _write_manifest(path: Path, manifest) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(manifest_dict(manifest), indent=2, sort_keys=True) + "\n")


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(prog="hd-iso")
    parser.add_argument("command", choices=("compile", "validate"))
    parser.add_argument("template_id")
    parser.add_argument("--seed", type=int, default=0)
    parser.add_argument("--out", type=Path)
    args = parser.parse_args(argv)

    root = _repo_root()
    out = args.out or _default_out(root, args.template_id)
    try:
        manifest = compile_template(args.template_id, args.seed, root)
    except ValueError:
        print(json.dumps({"status": "REFUSE", "reasons": ["unknown_template"]}))
        return 2

    _write_manifest(out, manifest)
    if args.command == "compile":
        print(json.dumps({"status": "PASS", "output": str(out)}))
        return 0

    result = validate_house_a(manifest, _template_data(root))
    print(json.dumps({"status": result.status, "reasons": list(result.reasons), "output": str(out)}))
    return 0 if result.status == "PASS" else 2


if __name__ == "__main__":
    raise SystemExit(main())
