"""Validated candidate ingestion and Phase A acceptance. No automatic promotion."""
import hashlib
import json
import math
from pathlib import Path
from PIL import Image

GOLDEN = ('building.house.suburban.01', 'road.intersection.4way.01',
          'building.shop.corner.01', 'vehicle.sedan.01')
CHECKS = ('projection_consistency', 'aliza_door_car_scale',
          'closest_zoom_texture_readability', 'transparent_edge_quality',
          'ground_contact', 'depth_sorting', 'collision_navigation',
          'road_continuity', 'missing_asset_diagnostics', 'fog_layering',
          'legacy_world_regression')
MANIFEST = 'world-art/hd-iso-v1/manifest.json'

def sha256(path):
    return hashlib.sha256(Path(path).read_bytes()).hexdigest()

def inside(root, path):
    root = Path(root).resolve()
    target = (root / path).resolve()
    if not target.is_relative_to(root) or target == root:
        raise ValueError(f'path escapes repository: {path}')
    return target

def read_json(path):
    return json.loads(Path(path).read_text())

def write_json(path, data):
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_suffix(path.suffix + '.tmp')
    temporary.write_text(json.dumps(data, indent=2) + '\n')
    temporary.replace(path)

def validate_image(path, pixels):
    with Image.open(path) as image:
        image.load()
        if list(image.size) != pixels:
            raise ValueError(f'dimension mismatch: {path}: {image.size} != {pixels}')
        if 'A' not in image.getbands():
            raise ValueError(f'alpha channel missing: {path}')
        alpha = image.getchannel('A')
        if alpha.getextrema()[0] != 0 or alpha.getextrema()[1] == 0:
            raise ValueError(f'asset must have transparent and visible pixels: {path}')
        if any(alpha.getpixel(p) != 0 for p in ((0,0),(image.width-1,0),(0,image.height-1),(image.width-1,image.height-1))):
            raise ValueError(f'opaque corner: {path}')
        return image.convert('RGBA')

def validate_geometry(record):
    for key in ('physicalSizeM', 'footprintTiles', 'masterPixels', 'runtimePixels'):
        values = record.get(key)
        if not isinstance(values, list) or len(values) != 2 or not all(isinstance(v,(int,float)) and math.isfinite(v) and v > 0 for v in values):
            raise ValueError(f'invalid {key}: {record.get("id")}')
    if record.get('anchor') != [.5, 1]:
        raise ValueError('expected bottom contact anchor [0.5, 1]')
    for metres, tiles in zip(record['physicalSizeM'], record['footprintTiles']):
        if abs(metres - tiles * 2) > metres * .03:
            raise ValueError('physical footprint exceeds 3% scale tolerance')

def ingest(root, asset_id, input_path):
    root = Path(root)
    manifest = read_json(root / MANIFEST)
    records = [r for r in manifest['assets'] if r['id'] == asset_id]
    if len(records) != 1:
        raise ValueError(f'expected one registered asset: {asset_id}')
    record = records[0]
    if asset_id not in GOLDEN and verify(root):
        raise ValueError('Batch B locked: Phase A acceptance has not passed')
    if record['status'] not in ('planned', 'candidate'):
        raise ValueError('approved/refused assets cannot be overwritten')
    validate_geometry(record)
    source = inside(root, record['source'])
    runtime = inside(root, record['runtimeSource'])
    receipt_path = runtime.with_suffix('.receipt.json')
    if len({source, runtime, receipt_path}) != 3 or any(p.exists() for p in (source, runtime, receipt_path)):
        raise ValueError('immutable asset destination already exists or overlaps')
    image = validate_image(input_path, record['masterPixels'])
    with Image.open(input_path) as master:
        if master.format != 'PNG':
            raise ValueError('master must be a PNG')
    exported = image.resize(tuple(record['runtimePixels']), Image.Resampling.LANCZOS)
    for path in (source, runtime): path.parent.mkdir(parents=True, exist_ok=True)
    source.write_bytes(Path(input_path).read_bytes())
    exported.save(runtime, 'WEBP', lossless=True, exact=True, method=6)
    receipt = dict(schema='surround-me-candidate-receipt-v1', assetId=asset_id,
                   master=record['source'], runtime=record['runtimeSource'],
                   masterSha256=sha256(source), runtimeSha256=sha256(runtime),
                   status='candidate', visualReview='NEEDS_REVIEW')
    write_json(receipt_path, receipt)
    record['status'] = 'candidate'
    record['receipt'] = receipt_path.relative_to(root).as_posix()
    write_json(root / MANIFEST, manifest)
    return receipt

def verify(root):
    root = Path(root)
    errors = []
    try:
        manifest = read_json(root / MANIFEST)
        records = {r['id']: r for r in manifest['assets']}
        if len(records) != len(manifest['assets']): errors.append('duplicate asset IDs')
    except (OSError, ValueError, KeyError, TypeError) as exc:
        return [f'manifest: {exc}']
    for asset_id in GOLDEN:
        try:
            r = records.get(asset_id)
            if not r: raise ValueError('missing registration')
            if r.get('status') != 'approved': raise ValueError(f'status={r.get("status")}')
            validate_geometry(r)
            receipt = read_json(inside(root, r['receipt']))
            if receipt.get('assetId') != asset_id: raise ValueError('receipt identity mismatch')
            for path_key, hash_key, size_key in (('source','masterSha256','masterPixels'),('runtimeSource','runtimeSha256','runtimePixels')):
                path = inside(root, r[path_key])
                validate_image(path, r[size_key])
                if sha256(path) != receipt.get(hash_key): raise ValueError(f'hash mismatch: {path_key}')
        except (OSError, ValueError, KeyError, TypeError) as exc:
            errors.append(f'{asset_id}: {exc}')
    try:
        checklist = read_json(root / 'world-art/phase-a/acceptance-checklist.json')
        checks = checklist['checks']
        ids = [c['id'] for c in checks]
        if len(ids) != len(set(ids)): errors.append('checklist: duplicate checks')
        for check_id in CHECKS:
            c = next((c for c in checks if c['id'] == check_id), {})
            if c.get('state') != 'PASS' or not str(c.get('evidence','')).strip():
                errors.append(f'checklist: {check_id} requires PASS with evidence')
    except (OSError, ValueError, KeyError, TypeError) as exc:
        errors.append(f'checklist: {exc}')
    return errors
