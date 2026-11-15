import json
import pathlib
import unittest

ROOT = pathlib.Path(__file__).resolve().parents[1]
LAYOUT = ROOT / 'world-art' / 'phase-a' / 'street-layout-v1.json'
SCENE = ROOT / 'world-art' / 'phase-a' / 'one-perfect-block.json'


class PhaseAStreetLayoutTests(unittest.TestCase):
    def load_layout(self):
        return json.loads(LAYOUT.read_text(encoding='utf-8'))

    def load_scene(self):
        return json.loads(SCENE.read_text(encoding='utf-8'))

    def test_street_geometry_uses_frozen_world_scale(self):
        data = self.load_layout()
        self.assertEqual(data['schema'], 'surround-me-phase-a-street-layout-v1')
        self.assertEqual(data['worldTileSizeM'], 2.0)
        self.assertEqual(data['road']['carriagewayWidthM'], 8.0)
        self.assertEqual(data['road']['carriagewayWidthTiles'], 4.0)
        self.assertEqual(data['sidewalk']['widthM'], 2.0)
        self.assertEqual(data['sidewalk']['widthTiles'], 1.0)

    def test_lots_contain_their_declared_asset_footprints(self):
        data = self.load_layout()
        for lot in data['lots']:
            asset = lot.get('assetFootprintM')
            if asset is None:
                continue
            self.assertLessEqual(asset[0], lot['sizeM'][0], lot['id'])
            self.assertLessEqual(asset[1], lot['sizeM'][1], lot['id'])
            self.assertGreaterEqual(lot['setbackM'], 0, lot['id'])

    def test_sedan_parking_bay_has_real_clearance(self):
        data = self.load_layout()
        bay = next(row for row in data['parkingBays'] if row['id'] == 'parking.sedan.01')
        self.assertGreaterEqual(bay['sizeM'][0], 5.0)
        self.assertGreaterEqual(bay['sizeM'][1], 2.2)
        self.assertEqual(bay['vehicleSizeM'], [4.5, 1.8])

    def test_golden_four_positions_match_scene(self):
        layout = self.load_layout()
        scene = self.load_scene()
        expected = {row['assetId']: row['world'] for row in layout['goldenFourPlacements']}
        self.assertEqual(expected[scene['ground']['assetId']], [scene['ground']['worldX'], scene['ground']['worldY']])
        for obj in scene['objects']:
            if obj['assetId'] in expected:
                self.assertEqual(expected[obj['assetId']], [obj['worldX'], obj['worldY']])

    def test_pedestrian_routes_are_at_least_one_metre_clear(self):
        data = self.load_layout()
        for route in data['pedestrianRoutes']:
            self.assertGreaterEqual(route['clearWidthM'], 1.0, route['id'])
            self.assertGreaterEqual(len(route['points']), 2, route['id'])


if __name__ == '__main__':
    unittest.main()
