import json
import pathlib
import tempfile
import unittest

from tools.compile_city_blueprint import compile_blueprint, BlueprintLockedError

ROOT = pathlib.Path(__file__).resolve().parents[1]
BLUEPRINT = ROOT / 'world-art' / 'city-blueprint-v1.json'


class CityBlueprintCompilerTests(unittest.TestCase):
    def load(self):
        return json.loads(BLUEPRINT.read_text(encoding='utf-8'))

    def test_compilation_is_deterministic(self):
        data = self.load()
        first = compile_blueprint(data, allow_materialization=False)
        second = compile_blueprint(data, allow_materialization=False)
        self.assertEqual(first, second)

    def test_planning_compile_maps_every_district_to_a_generation_recipe(self):
        data = self.load()
        compiled = compile_blueprint(data, allow_materialization=False)
        self.assertEqual(len(compiled['districtRecipes']), len(data['districts']))
        ids = {row['districtId'] for row in compiled['districtRecipes']}
        self.assertEqual(ids, {row['id'] for row in data['districts']})
        for row in compiled['districtRecipes']:
            self.assertTrue(row['roadGrammar'])
            self.assertTrue(row['buildingPrograms'])
            self.assertTrue(row['assetFamilies'])

    def test_materialization_refuses_while_phase_a_is_locked(self):
        data = self.load()
        with self.assertRaises(BlueprintLockedError):
            compile_blueprint(data, allow_materialization=True)

    def test_expected_road_grammars_exist(self):
        data = self.load()
        compiled = compile_blueprint(data, allow_materialization=False)
        by_id = {row['districtId']: row for row in compiled['districtRecipes']}
        self.assertEqual(by_id['district.east_residential']['roadGrammar'], 'residential_culdesac')
        self.assertEqual(by_id['district.main_street']['roadGrammar'], 'commercial_boulevard')
        self.assertEqual(by_id['district.industrial_fringe']['roadGrammar'], 'industrial_service_alley')


if __name__ == '__main__':
    unittest.main()
