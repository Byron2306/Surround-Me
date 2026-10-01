from __future__ import annotations

from copy import deepcopy
from typing import Any


class BlueprintLockedError(RuntimeError):
    pass


ROAD_GRAMMAR_BY_KIND = {
    'institutional': 'institutional_courtyard_grid',
    'civic': 'civic_arterial_grid',
    'residential': 'residential_culdesac',
    'commercial': 'commercial_boulevard',
    'industrial': 'industrial_service_alley',
    'transitional_fringe': 'fringe_service_road',
    'mixed_civic_commercial': 'commercial_boulevard',
    'residential_civic': 'residential_culdesac',
}

BUILDINGS_BY_KIND = {
    'institutional': ['old_institution', 'fire_station', 'office', 'service_building'],
    'civic': ['hospital', 'clinic', 'municipal_office', 'public_building'],
    'residential': ['house', 'duplex', 'townhouse', 'apartment_complex', 'school'],
    'commercial': ['shop', 'pharmacy', 'office', 'apartment_complex', 'petrol_station'],
    'industrial': ['warehouse', 'factory', 'workshop', 'substation', 'processing_plant'],
    'transitional_fringe': ['motel', 'service_station', 'trailer', 'bus_depot', 'small_shop'],
    'mixed_civic_commercial': ['shop', 'pharmacy', 'office', 'police_station', 'apartment_complex'],
    'residential_civic': ['house', 'duplex', 'church', 'cemetery_chapel', 'small_shop'],
}

ASSET_FAMILIES_BY_KIND = {
    'institutional': ['building.institutional', 'road.urban', 'clutter.civic', 'vegetation.neglect'],
    'civic': ['building.civic', 'road.urban', 'vehicle.service', 'street_furniture', 'vegetation.neglect'],
    'residential': ['building.residential', 'road.local', 'vehicle.civilian', 'lot_dressing', 'vegetation.residential'],
    'commercial': ['building.commercial', 'road.urban', 'vehicle.civilian', 'street_furniture', 'clutter.commercial'],
    'industrial': ['building.industrial', 'road.service', 'vehicle.heavy', 'utility', 'clutter.industrial'],
    'transitional_fringe': ['building.fringe', 'road.fringe', 'vehicle.civilian', 'clutter.fringe', 'vegetation.encroachment'],
    'mixed_civic_commercial': ['building.commercial', 'building.civic', 'road.urban', 'street_furniture', 'clutter.commercial'],
    'residential_civic': ['building.residential', 'building.civic', 'road.local', 'vegetation.residential', 'clutter.civic'],
}


def _recipe_for(district: dict[str, Any]) -> dict[str, Any]:
    kind = str(district['kind'])
    if kind not in ROAD_GRAMMAR_BY_KIND:
        raise ValueError(f'unsupported district kind: {kind}')
    return {
        'districtId': district['id'],
        'kind': kind,
        'center': list(district['center']),
        'radius': district['radius'],
        'roadGrammar': ROAD_GRAMMAR_BY_KIND[kind],
        'buildingPrograms': list(BUILDINGS_BY_KIND[kind]),
        'assetFamilies': list(ASSET_FAMILIES_BY_KIND[kind]),
        'landmarks': list(district.get('landmarks', [])),
    }


def compile_blueprint(blueprint: dict[str, Any], *, allow_materialization: bool) -> dict[str, Any]:
    if blueprint.get('schema') != 'surround-me-city-blueprint-v1':
        raise ValueError('unsupported city blueprint schema')

    locked = blueprint.get('status') == 'planning_only_until_phase_a_pass'
    if allow_materialization and locked:
        raise BlueprintLockedError('Phase A has not passed; city materialization is REFUSED')

    recipes = [_recipe_for(row) for row in blueprint.get('districts', [])]
    recipes.sort(key=lambda row: row['districtId'])

    corridors = deepcopy(blueprint.get('corridors', []))
    corridors.sort(key=lambda row: row['id'])

    return {
        'schema': 'surround-me-city-compiled-plan-v1',
        'sourceBlueprint': blueprint['name'],
        'materializationAllowed': bool(allow_materialization and not locked),
        'districtRecipes': recipes,
        'corridors': corridors,
        'heroLandmarks': sorted(blueprint.get('landmarkRules', {}).get('heroLandmarks', [])),
        'greylineHooks': deepcopy(blueprint.get('greylineHooks', {})),
    }


__all__ = ['compile_blueprint', 'BlueprintLockedError']
