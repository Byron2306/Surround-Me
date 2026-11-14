import importlib.util
import json
import sys
import tempfile
import unittest
from pathlib import Path
from PIL import Image

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'tools'))

class PipelineTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.manifest = self.root / 'world-art/hd-iso-v1/manifest.json'
        self.manifest.parent.mkdir(parents=True)
        self.record = dict(id='vehicle.sedan.01', source='world-art/hd-iso-v1/masters/car.png', runtimeSource='world-art/hd-iso-v1/runtime/car.webp', masterPixels=[32,32], runtimePixels=[16,16], status='planned', anchor=[.5,1], physicalSizeM=[4.5,1.8], footprintTiles=[2.25,.9])
        self.manifest.write_text(json.dumps({'assets':[self.record]}))
        self.input = self.root / 'input.png'
        image = Image.new('RGBA', (32,32))
        for x in range(8,24):
            for y in range(8,32): image.putpixel((x,y),(70,75,80,255))
        image.save(self.input)

    def test_candidate_export_is_hashed_and_never_approved(self):
        from world_art_pipeline import ingest, sha256
        receipt = ingest(self.root, 'vehicle.sedan.01', self.input)
        record = json.loads(self.manifest.read_text())['assets'][0]
        self.assertEqual(record['status'], 'candidate')
        self.assertEqual(receipt['masterSha256'], sha256(self.input))
        with Image.open(self.root / record['runtimeSource']) as runtime:
            self.assertEqual(runtime.size, (16,16))
        self.assertEqual(receipt['runtimeSha256'], sha256(self.root / record['runtimeSource']))
        with self.assertRaises(ValueError): ingest(self.root, 'vehicle.sedan.01', self.input)

    def test_opaque_or_wrong_size_is_rejected_without_mutation(self):
        from world_art_pipeline import ingest
        Image.new('RGB',(32,32)).save(self.input)
        with self.assertRaises(ValueError): ingest(self.root, 'vehicle.sedan.01', self.input)
        self.assertEqual(json.loads(self.manifest.read_text())['assets'][0]['status'], 'planned')
        self.assertFalse((self.root / self.record['runtimeSource']).exists())

    def test_paths_cannot_escape_repository(self):
        from world_art_pipeline import ingest
        self.record['source'] = '../escape.png'
        self.manifest.write_text(json.dumps({'assets':[self.record]}))
        with self.assertRaises(ValueError): ingest(self.root, 'vehicle.sedan.01', self.input)

    def test_batch_b_stays_locked(self):
        from world_art_pipeline import ingest
        self.record['id'] = 'clutter.tyres.01'
        self.manifest.write_text(json.dumps({'assets':[self.record]}))
        with self.assertRaises(ValueError): ingest(self.root, self.record['id'], self.input)

    def test_intersection_is_deterministic_transparent_and_ground_centered(self):
        from build_hd_iso_intersection import compile_intersection
        a = compile_intersection(self.input, 256)
        b = compile_intersection(self.input, 256)
        self.assertEqual(a.tobytes(), b.tobytes())
        self.assertEqual(a.getpixel((0,0))[3], 0)
        self.assertEqual(a.getpixel((128,192))[3], 255)
        self.assertEqual(a.getbbox(), (0,128,256,256))

    def test_verifier_refuses_missing_golden_four_and_visual_checks(self):
        from world_art_pipeline import verify
        errors = verify(self.root)
        self.assertTrue(any('building.house.suburban.01' in e for e in errors))
        self.assertTrue(any('checklist' in e for e in errors))

    def test_verifier_detects_changed_bytes_after_acceptance(self):
        from world_art_pipeline import ingest, verify, GOLDEN, CHECKS
        records = []
        for index, asset_id in enumerate(GOLDEN):
            record = dict(self.record, id=asset_id,
                          source=f'world-art/hd-iso-v1/masters/{index}.png',
                          runtimeSource=f'world-art/hd-iso-v1/runtime/{index}.webp')
            records.append(record)
        self.manifest.write_text(json.dumps({'assets':records}))
        for asset_id in GOLDEN: ingest(self.root, asset_id, self.input)
        manifest = json.loads(self.manifest.read_text())
        for record in manifest['assets']: record['status'] = 'approved'
        self.manifest.write_text(json.dumps(manifest))
        checklist = self.root / 'world-art/phase-a/acceptance-checklist.json'
        checklist.parent.mkdir(parents=True)
        checklist.write_text(json.dumps({'checks':[dict(id=c,state='PASS',evidence='test fixture only') for c in CHECKS]}))
        self.assertEqual(verify(self.root), [])
        runtime = self.root / records[0]['runtimeSource']
        image = Image.open(runtime).convert('RGBA')
        image.putpixel((8,8),(1,2,3,255))
        image.save(runtime,'WEBP',lossless=True)
        self.assertTrue(any('hash mismatch' in e for e in verify(self.root)))

if __name__ == '__main__': unittest.main()
