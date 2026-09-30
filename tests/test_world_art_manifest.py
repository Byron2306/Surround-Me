import json
import pathlib
import unittest

ROOT = pathlib.Path(__file__).resolve().parents[1]
MANIFEST = ROOT / 'world-art' / 'hd-iso-v1' / 'manifest.json'


class WorldArtManifestTests(unittest.TestCase):
    def load(self):
        with MANIFEST.open('r', encoding='utf-8') as f:
            return json.load(f)

    def test_manifest_declares_hd_iso_v1_contract(self):
        data = self.load()
        self.assertEqual(data['schema'], 'surround-me-world-art-v1')
        self.assertEqual(data['projection']['type'], 'orthographic_isometric')
        for key in ('lighting', 'scale', 'runtime', 'assets'):
            self.assertIn(key, data)

    def test_asset_ids_are_unique_and_paths_are_relative(self):
        from tools.validate_world_art_manifest import validate_manifest
        data = self.load()
        ids = [a['id'] for a in data['assets']]
        self.assertEqual(len(ids), len(set(ids)))
        errors = validate_manifest(MANIFEST)
        self.assertFalse([e for e in errors if 'path' in e.lower() or 'duplicate' in e.lower()], errors)

    def test_asset_anchor_is_normalized_bottom_contact(self):
        data = self.load()
        for asset in data['assets']:
            x, y = asset['anchor']
            self.assertGreaterEqual(x, 0)
            self.assertLessEqual(x, 1)
            self.assertGreaterEqual(y, 0)
            self.assertLessEqual(y, 1)
            self.assertEqual(y, 1)

    def test_master_resolution_is_not_smaller_than_runtime_resolution(self):
        data = self.load()
        for asset in data['assets']:
            mw, mh = asset['masterPixels']
            rw, rh = asset['runtimePixels']
            self.assertGreaterEqual(mw, rw)
            self.assertGreaterEqual(mh, rh)

    def test_phase_a_required_categories_are_declared(self):
        data = self.load()
        categories = {a['category'] for a in data['assets']}
        required = {'road', 'building', 'vehicle', 'street_furniture', 'utility', 'clutter', 'vegetation', 'atmosphere'}
        self.assertTrue(required.issubset(categories), required - categories)


if __name__ == '__main__':
    unittest.main()
