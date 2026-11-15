from __future__ import annotations

import argparse
import hashlib
import json
import pathlib
import shutil
import sys
import tempfile
from typing import Any

from PIL import Image

from tools.validate_world_art_images import inspect_image


class CandidateIngestError(RuntimeError):
    pass


def _contained(path: pathlib.Path, parent: pathlib.Path) -> bool:
    try:
        path.resolve().relative_to(parent.resolve())
        return True
    except ValueError:
        return False


def _sha256(path: pathlib.Path) -> str:
    digest = hashlib.sha256()
    with path.open('rb') as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b''):
            digest.update(chunk)
    return 'sha256:' + digest.hexdigest()


def _load_manifest(path: pathlib.Path) -> dict[str, Any]:
    try:
        data = json.loads(path.read_text(encoding='utf-8'))
    except (OSError, json.JSONDecodeError) as exc:
        raise CandidateIngestError(f'invalid manifest: {exc}') from exc
    if data.get('schema') != 'surround-me-world-art-v1':
        raise CandidateIngestError('unsupported manifest schema')
    if not isinstance(data.get('assets'), list):
        raise CandidateIngestError('manifest assets must be a list')
    return data


def ingest_candidate(
    manifest_path: pathlib.Path,
    asset_id: str,
    incoming_path: pathlib.Path,
    *,
    repo_root: pathlib.Path,
) -> dict[str, Any]:
    manifest_path = pathlib.Path(manifest_path)
    incoming_path = pathlib.Path(incoming_path)
    repo_root = pathlib.Path(repo_root).resolve()
    data = _load_manifest(manifest_path)

    record = next(
        (row for row in data['assets'] if isinstance(row, dict) and row.get('id') == asset_id),
        None,
    )
    if record is None:
        raise CandidateIngestError(f'unknown asset: {asset_id}')
    if record.get('status') != 'planned':
        raise CandidateIngestError(
            f'asset must be planned before candidate ingestion: {asset_id} status={record.get("status")}'
        )
    if not incoming_path.is_file():
        raise CandidateIngestError(f'incoming image not found: {incoming_path}')
    if incoming_path.suffix.lower() != '.png':
        raise CandidateIngestError('candidate master must be supplied as PNG')

    source_value = str(record.get('source') or '')
    runtime_value = str(record.get('runtimeSource') or '')
    if not source_value or not runtime_value:
        raise CandidateIngestError('asset source and runtimeSource are required')

    master_path = (repo_root / source_value).resolve()
    runtime_path = (repo_root / runtime_value).resolve()
    hd_root = (repo_root / 'world-art' / 'hd-iso-v1').resolve()
    if not _contained(master_path, hd_root) or not _contained(runtime_path, hd_root):
        raise CandidateIngestError('candidate paths must remain inside world-art/hd-iso-v1')

    errors = inspect_image(incoming_path, record)
    if errors:
        raise CandidateIngestError('; '.join(errors))

    runtime_pixels = record.get('runtimePixels')
    if (
        not isinstance(runtime_pixels, list)
        or len(runtime_pixels) != 2
        or not all(isinstance(value, int) and value > 0 for value in runtime_pixels)
    ):
        raise CandidateIngestError('runtimePixels must contain two positive integers')

    master_path.parent.mkdir(parents=True, exist_ok=True)
    runtime_path.parent.mkdir(parents=True, exist_ok=True)

    # Build both outputs in temporary files first. The manifest is not touched
    # until source validation and runtime generation have succeeded.
    with tempfile.TemporaryDirectory(dir=str(master_path.parent)) as td:
        td_path = pathlib.Path(td)
        staged_master = td_path / master_path.name
        staged_runtime = td_path / runtime_path.name
        shutil.copyfile(incoming_path, staged_master)

        with Image.open(incoming_path).convert('RGBA') as image:
            runtime = image.resize(tuple(runtime_pixels), Image.Resampling.LANCZOS)
            runtime.save(staged_runtime, 'WEBP', quality=95, method=6)

        # Re-open generated runtime before committing either output.
        try:
            with Image.open(staged_runtime) as runtime_check:
                if runtime_check.size != tuple(runtime_pixels):
                    raise CandidateIngestError('generated runtime dimensions do not match manifest')
        except OSError as exc:
            raise CandidateIngestError(f'generated runtime is unreadable: {exc}') from exc

        staged_master.replace(master_path)
        staged_runtime.replace(runtime_path)

    record['status'] = 'candidate'
    record['candidateSha256'] = _sha256(master_path)
    record['candidateSourceFilename'] = incoming_path.name

    manifest_tmp = manifest_path.with_suffix(manifest_path.suffix + '.tmp')
    manifest_tmp.write_text(json.dumps(data, indent=2) + '\n', encoding='utf-8')
    manifest_tmp.replace(manifest_path)

    return {
        'assetId': asset_id,
        'status': 'candidate',
        'master': str(master_path),
        'runtime': str(runtime_path),
        'sha256': record['candidateSha256'],
    }


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description='Validate and ingest one HD-ISO-V1 candidate master.')
    parser.add_argument('--manifest', type=pathlib.Path, default=pathlib.Path('world-art/hd-iso-v1/manifest.json'))
    parser.add_argument('--asset-id', required=True)
    parser.add_argument('--input', required=True, type=pathlib.Path)
    parser.add_argument('--repo-root', type=pathlib.Path, default=pathlib.Path('.'))
    args = parser.parse_args(argv)

    try:
        result = ingest_candidate(
            args.manifest,
            args.asset_id,
            args.input,
            repo_root=args.repo_root,
        )
    except CandidateIngestError as exc:
        print(f'REFUSE: {exc}', file=sys.stderr)
        return 1

    print(json.dumps(result, indent=2))
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
