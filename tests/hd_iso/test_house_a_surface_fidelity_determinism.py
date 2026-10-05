from __future__ import annotations

from copy import deepcopy
from pathlib import Path

from tools.hd_iso.compile_geometry import compile_template, manifest_dict
from tools.hd_iso.compile_detail import compile_house_a_detail
from tools.hd_iso.compile_surface import compile_house_a_surface, surface_sha256
from tools.hd_iso.compile_surface_fidelity import (
    canonical_surface_fidelity_json,
    compile_house_a_surface_fidelity,
    surface_fidelity_sha256,
)

ROOT = Path(__file__).resolve().parents[2]
ACCEPTED_GEOMETRY_SHA = "sha256:820ca6b7bcd774eb93c2ad3bcb93567a8a42bde484d7d1e4a71e9cc6bd9104a1"
ACCEPTED_DETAIL_SHA = "sha256:e2f1d4ac85cef2b32db76c424fd11988cf8912afb452b593aeaae81c416308e4"
ACCEPTED_SURFACE_SHA = "sha256:c32c73d9d82d624f07186089e03e5c029f33aa338e68f7f90bc243434f84aa1b"


def _parents():
    geometry = manifest_dict(compile_template("house.master.a", structural_seed=18427, root=ROOT))
    detail = compile_house_a_detail(geometry, detail_seed=4104)
    surface = compile_house_a_surface(
        geometry,
        detail,
        appearance_seed=7001,
        decay_seed=9907,
    )
    return geometry, detail, surface


def test_fidelity_compiler_chains_to_all_accepted_parents_without_mutation():
    geometry, detail, surface = _parents()
    before_geometry = deepcopy(geometry)
    before_detail = deepcopy(detail)
    before_surface = deepcopy(surface)

    fidelity = compile_house_a_surface_fidelity(
        geometry,
        detail,
        surface,
        fidelity_seed=27182,
    )

    assert geometry == before_geometry
    assert detail == before_detail
    assert surface == before_surface

    assert fidelity["schemaVersion"] == "hd-iso-surface-fidelity-v1"
    assert fidelity["templateId"] == "house.master.a"
    assert fidelity["structuralSeed"] == 18427
    assert fidelity["detailSeed"] == 4104
    assert fidelity["appearanceSeed"] == 7001
    assert fidelity["decaySeed"] == 9907
    assert fidelity["fidelitySeed"] == 27182

    assert fidelity["sourceGeometrySha256"] == ACCEPTED_GEOMETRY_SHA
    assert fidelity["sourceDetailSha256"] == ACCEPTED_DETAIL_SHA
    assert fidelity["sourceSurfaceSha256"] == ACCEPTED_SURFACE_SHA
    assert surface_sha256(surface) == ACCEPTED_SURFACE_SHA


def test_same_fidelity_seed_is_byte_deterministic():
    geometry, detail, surface = _parents()
    a = compile_house_a_surface_fidelity(geometry, detail, surface, fidelity_seed=27182)
    b = compile_house_a_surface_fidelity(geometry, detail, surface, fidelity_seed=27182)

    assert canonical_surface_fidelity_json(a) == canonical_surface_fidelity_json(b)
    assert surface_fidelity_sha256(a) == surface_fidelity_sha256(b)


def test_fidelity_channels_are_bounded_and_complete():
    geometry, detail, surface = _parents()
    fidelity = compile_house_a_surface_fidelity(geometry, detail, surface, fidelity_seed=27182)

    expected = {
        "walls": {
            "microScale", "microStrength", "verticalStreakBias", "lowerWallDirtBias",
            "crackFrequency", "crackContrast",
        },
        "roof": {
            "macroVariationScale", "stainClusterScale", "runoffBias",
            "edgeWearBias", "mossPatchScale",
        },
        "metal": {
            "rustClusterScale", "rustEdgeBias", "runoffBias", "roughnessVariation",
        },
        "glass": {
            "hazeScale", "hazeStrength", "streakScale", "streakStrength", "scratchScale",
        },
        "trim": {
            "grainScale", "wearEdgeBias", "roughnessVariation",
        },
    }

    assert set(fidelity["channels"]) == set(expected)
    for family, names in expected.items():
        assert set(fidelity["channels"][family]) == names

    unit_keys = {
        "microStrength", "verticalStreakBias", "lowerWallDirtBias",
        "crackFrequency", "crackContrast", "runoffBias", "edgeWearBias",
        "rustEdgeBias", "roughnessVariation", "hazeStrength",
        "streakStrength", "wearEdgeBias",
    }
    for block in fidelity["channels"].values():
        for key, value in block.items():
            if key in unit_keys:
                assert 0.0 <= float(value) <= 1.0
            else:
                assert float(value) > 0.0


def test_fidelity_seed_cannot_change_parent_surface_truth():
    geometry, detail, surface = _parents()
    a = compile_house_a_surface_fidelity(geometry, detail, surface, fidelity_seed=1)
    b = compile_house_a_surface_fidelity(geometry, detail, surface, fidelity_seed=2)

    for key in (
        "sourceGeometrySha256",
        "sourceDetailSha256",
        "sourceSurfaceSha256",
        "structuralSeed",
        "detailSeed",
        "appearanceSeed",
        "decaySeed",
    ):
        assert a[key] == b[key]

    assert surface_sha256(surface) == ACCEPTED_SURFACE_SHA
