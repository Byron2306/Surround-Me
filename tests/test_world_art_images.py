import json
import pathlib
import tempfile
import unittest

from PIL import Image

ROOT = pathlib.Path(__file__).resolve().parents[1]


class WorldArtImageTests(unittest.TestCase):
    def record(self, source, size=(64, 64), transparent=True):
        return {
            'id': 'fixture.asset',
            'source': source,
            'masterPixels': list(size),
            'transparent': transparent,
        }

    def test_rejects_absent_file(self):
        from tools.validate_world_art_images import inspect_image
        errors = inspect_image(ROOT / 'does-not-exist.png', self.record('world-art/hd-iso-v1/masters/missing.png'))
        self.assertTrue(any('missing' in e.lower() for e in errors), errors)

    def test_rejects_wrong_dimensions(self):
        from tools.validate_world_art_images import inspect_image
        with tempfile.TemporaryDirectory() as td:
            path = pathlib.Path(td) / 'asset.png'
            Image.new('RGBA', (32, 64), (0, 0, 0, 0)).save(path)
            errors = inspect_image(path, self.record('world-art/hd-iso-v1/masters/asset.png', (64, 64)))
            self.assertTrue(any('dimensions' in e.lower() for e in errors), errors)

    def test_rejects_missing_alpha_for_transparent_asset(self):
        from tools.validate_world_art_images import inspect_image
        with tempfile.TemporaryDirectory() as td:
            path = pathlib.Path(td) / 'asset.png'
            Image.new('RGB', (64, 64), (0, 0, 0)).save(path)
            errors = inspect_image(path, self.record('world-art/hd-iso-v1/masters/asset.png'))
            self.assertTrue(any('alpha' in e.lower() for e in errors), errors)

    def test_rejects_opaque_corner_contamination(self):
        from tools.validate_world_art_images import inspect_image
        with tempfile.TemporaryDirectory() as td:
            path = pathlib.Path(td) / 'asset.png'
            image = Image.new('RGBA', (64, 64), (0, 0, 0, 0))
            image.putpixel((0, 0), (255, 255, 255, 255))
            image.save(path)
            errors = inspect_image(path, self.record('world-art/hd-iso-v1/masters/asset.png'))
            self.assertTrue(any('corner' in e.lower() for e in errors), errors)

    def test_rejects_manifest_paths_outside_hd_iso_root(self):
        from tools.validate_world_art_images import validate_manifest_images
        payload = {'assets': [self.record('../outside.png')]}
        with tempfile.TemporaryDirectory() as td:
            manifest = pathlib.Path(td) / 'manifest.json'
            manifest.write_text(json.dumps(payload), encoding='utf-8')
            errors = validate_manifest_images(manifest, repo_root=ROOT)
            self.assertTrue(any('world-art/hd-iso-v1' in e for e in errors), errors)

    def test_accepts_clean_transparent_asset(self):
        from tools.validate_world_art_images import inspect_image
        with tempfile.TemporaryDirectory() as td:
            path = pathlib.Path(td) / 'asset.png'
            image = Image.new('RGBA', (64, 64), (0, 0, 0, 0))
            for x in range(16, 48):
                for y in range(16, 60):
                    image.putpixel((x, y), (100, 90, 80, 255))
            image.save(path)
            self.assertEqual(inspect_image(path, self.record('world-art/hd-iso-v1/masters/asset.png')), [])


if __name__ == '__main__':
    unittest.main()
