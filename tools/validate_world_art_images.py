from __future__ import annotations

import json
import pathlib
import sys
from typing import Any

from PIL import Image

HD_ISO_ROOT = pathlib.PurePosixPath('world-art/hd-iso-v1')


def _within_hd_iso(path_value: str) -> bool:
    p = pathlib.PurePosixPath(path_value)
    if p.is_absolute() or '..' in p.parts:
        return False
    return tuple(p.parts[:len(HD_ISO_ROOT.parts)]) == tuple(HD_ISO_ROOT.parts)


def inspect_image(path: pathlib.Path, record: dict[str, Any]) -> list[str]:
    errors: list[str] = []
    if not path.exists():
        return [f"{record.get('id', '<unknown>')}: missing image {path}"]

    try:
        with Image.open(path) as image:
            expected = tuple(record.get('masterPixels', []))
            if len(expected) == 2 and image.size != expected:
                errors.append(
                    f"{record.get('id')}: dimensions {image.size[0]}x{image.size[1]} != expected {expected[0]}x{expected[1]}"
                )

            requires_alpha = bool(record.get('transparent'))
            has_alpha = image.mode in ('RGBA', 'LA') or 'transparency' in image.info
            if requires_alpha and not has_alpha:
                errors.append(f"{record.get('id')}: transparent asset is missing alpha channel")
            elif requires_alpha:
                rgba = image.convert('RGBA')
                w, h = rgba.size
                corners = ((0, 0), (w - 1, 0), (0, h - 1), (w - 1, h - 1))
                contaminated = [corner for corner in corners if rgba.getpixel(corner)[3] > 8]
                if contaminated:
                    errors.append(f"{record.get('id')}: opaque corner contamination at {contaminated}")
    except OSError as exc:
        errors.append(f"{record.get('id')}: unreadable image: {exc}")
    return errors


def validate_manifest_images(manifest_path: pathlib.Path, repo_root: pathlib.Path | None = None) -> list[str]:
    data = json.loads(manifest_path.read_text(encoding='utf-8'))
    if repo_root is None:
        repo_root = manifest_path.resolve().parents[3]
    errors: list[str] = []
    for record in data.get('assets', []):
        source = str(record.get('source', ''))
        if not _within_hd_iso(source):
            errors.append(f"{record.get('id')}: source must remain inside world-art/hd-iso-v1/: {source}")
            continue
        if record.get('status') == 'planned':
            continue
        errors.extend(inspect_image(repo_root / source, record))
    return errors


def main(argv: list[str]) -> int:
    if len(argv) != 2:
        print('usage: validate_world_art_images.py <manifest.json>', file=sys.stderr)
        return 2
    errors = validate_manifest_images(pathlib.Path(argv[1]))
    if errors:
        for error in errors:
            print(f'REFUSE: {error}')
        return 1
    print('PASS: world-art image validation')
    return 0


if __name__ == '__main__':
    raise SystemExit(main(sys.argv))
