import json
import pathlib
import tempfile
import unittest

from PIL import Image

from tools.ingest_world_art_candidate import CandidateIngestError, ingest_candidate


class CandidateIngestTests(unittest.TestCase):
    def fixture(self, root: pathlib.Path):
        manifest = root / 'world-art' / 'hd-iso-v1' / 'manifest.json'
        manifest.parent.mkdir(parents=True, exist_ok=True)
        payload = {
            'schema': 'surround-me-world-art-v1',
            'assets': [{
                'id': 'building.fixture.01',
                'source': 'world-art/hd-iso-v1/masters/building_fixture_01.png',
                'runtimeSource': 'world-art/hd-iso-v1/runtime/building_fixture_01.webp',
                'masterPixels': [64, 64],
                'runtimePixels': [32, 32],
                'transparent': True,
                'status': 'planned',
            }],
        }
        manifest.write_text(json.dumps(payload), encoding='utf-8')
        return manifest

    def clean_rgba(self, path: pathlib.Path, size=(64, 64)):
        image = Image.new('RGBA', size, (0, 0, 0, 0))
        for x in range(size[0] // 4, 3 * size[0] // 4):
            for y in range(size[1] // 4, 7 * size[1] // 8):
                image.putpixel((x, y), (90, 80, 70, 255))
        image.save(path)

    def test_ingest_writes_master_runtime_and_promotes_candidate(self):
        with tempfile.TemporaryDirectory() as td:
            root = pathlib.Path(td)
            manifest = self.fixture(root)
            incoming = root / 'incoming.png'
            self.clean_rgba(incoming)

            result = ingest_candidate(manifest, 'building.fixture.01', incoming, repo_root=root)

            master = root / 'world-art/hd-iso-v1/masters/building_fixture_01.png'
            runtime = root / 'world-art/hd-iso-v1/runtime/building_fixture_01.webp'
            self.assertTrue(master.is_file())
            self.assertTrue(runtime.is_file())
            self.assertEqual(Image.open(master).size, (64, 64))
            self.assertEqual(Image.open(runtime).size, (32, 32))
            updated = json.loads(manifest.read_text(encoding='utf-8'))
            record = updated['assets'][0]
            self.assertEqual(record['status'], 'candidate')
            self.assertTrue(record['candidateSha256'].startswith('sha256:'))
            self.assertEqual(result['assetId'], 'building.fixture.01')

    def test_ingest_refuses_wrong_dimensions_without_mutating_manifest(self):
        with tempfile.TemporaryDirectory() as td:
            root = pathlib.Path(td)
            manifest = self.fixture(root)
            before = manifest.read_bytes()
            incoming = root / 'incoming.png'
            self.clean_rgba(incoming, (32, 64))

            with self.assertRaises(CandidateIngestError):
                ingest_candidate(manifest, 'building.fixture.01', incoming, repo_root=root)

            self.assertEqual(manifest.read_bytes(), before)

    def test_ingest_refuses_opaque_corner_contamination(self):
        with tempfile.TemporaryDirectory() as td:
            root = pathlib.Path(td)
            manifest = self.fixture(root)
            incoming = root / 'incoming.png'
            self.clean_rgba(incoming)
            image = Image.open(incoming).convert('RGBA')
            image.putpixel((0, 0), (255, 255, 255, 255))
            image.save(incoming)

            with self.assertRaises(CandidateIngestError):
                ingest_candidate(manifest, 'building.fixture.01', incoming, repo_root=root)

    def test_ingest_refuses_non_planned_asset(self):
        with tempfile.TemporaryDirectory() as td:
            root = pathlib.Path(td)
            manifest = self.fixture(root)
            payload = json.loads(manifest.read_text(encoding='utf-8'))
            payload['assets'][0]['status'] = 'approved'
            manifest.write_text(json.dumps(payload), encoding='utf-8')
            incoming = root / 'incoming.png'
            self.clean_rgba(incoming)

            with self.assertRaises(CandidateIngestError):
                ingest_candidate(manifest, 'building.fixture.01', incoming, repo_root=root)


if __name__ == '__main__':
    unittest.main()
