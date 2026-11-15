import json
import pathlib
import unittest

ROOT = pathlib.Path(__file__).resolve().parents[1]
BLUEPRINT = ROOT / 'world-art' / 'city-blueprint-v1.json'


class CityBlueprintTests(unittest.TestCase):
    def load(self):
        with BLUEPRINT.open('r', encoding='utf-8') as handle:
            return json.load(handle)

    def test_schema_and_phase_a_gate(self):
        data = self.load()
        self.assertEqual(data['schema'], 'surround-me-city-blueprint-v1')
        self.assertEqual(data['status'], 'planning_only_until_phase_a_pass')

    def test_district_ids_are_unique(self):
        data = self.load()
        ids = [row['id'] for row in data['districts']]
        self.assertEqual(len(ids), len(set(ids)))

    def test_district_centres_are_inside_normalized_plan(self):
        data = self.load()
        for row in data['districts']:
            x, y = row['center']
            self.assertGreaterEqual(x, 0, row['id'])
            self.assertLessEqual(x, 100, row['id'])
            self.assertGreaterEqual(y, 0, row['id'])
            self.assertLessEqual(y, 100, row['id'])
            self.assertGreater(row['radius'], 0, row['id'])

    def test_required_city_families_exist(self):
        data = self.load()
        kinds = {row['kind'] for row in data['districts']}
        required = {'institutional', 'civic', 'residential', 'commercial', 'industrial', 'transitional_fringe'}
        self.assertTrue(required.issubset(kinds), required - kinds)

    def test_hero_landmarks_are_declared_by_a_district(self):
        data = self.load()
        declared = {landmark for row in data['districts'] for landmark in row['landmarks']}
        for landmark in data['landmarkRules']['heroLandmarks']:
            self.assertIn(landmark, declared)

    def test_corridor_ids_are_unique_and_endpoints_are_valid(self):
        data = self.load()
        ids = [row['id'] for row in data['corridors']]
        self.assertEqual(len(ids), len(set(ids)))
        for row in data['corridors']:
            for point in (row['from'], row['to']):
                self.assertEqual(len(point), 2)
                self.assertTrue(all(0 <= value <= 100 for value in point))


if __name__ == '__main__':
    unittest.main()
