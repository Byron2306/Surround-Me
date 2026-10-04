from __future__ import annotations

from copy import deepcopy
from pathlib import Path

from tools.hd_iso.compile_geometry import compile_template, manifest_dict
from tools.hd_iso.compile_detail import compile_house_a_detail, canonical_detail_json, detail_sha256
from tools.hd_iso.compile_surface import (
    canonical_surface_json,
    compile_house_a_surface,
    surface_sha256,
)

ROOT = Path(__file__).resolve().parents[2]
ACCEPTED_GEOMETRY_SHA = "sha256:820ca6b7bcd774eb93c2ad3bcb93567a8a42bde484d7d1e4a71e9cc6bd9104a1"
ACCEPTED_DETAIL_SHA = "sha256:e2f1d4ac85cef2b32db76c424fd11988cf8912afb452b593aeaae81c416308e4"


def _parents():
    geometry_obj = compile_template("house.master.a", structural_seed=18427, root=ROOT)
    geometry = manifest_dict(geometry_obj)
    detail = compile_house_a_detail(geometry, detail_seed=4104)
    return geometry, detail


def test_surface_compiler_chains_to_accepted_parent_hashes_without_mutation():
    geometry, detail = _parents()
    geometry_before = deepcopy(geometry)
    detail_before = deepcopy(detail)

    surface = compile_house_a_surface(
        geometry,
        detail,
        appearance_seed=7001,
        decay_seed=9907,
    )

    assert geometry == geometry_before
    assert detail == detail_before
    assert surface["schemaVersion"] == "hd-iso-surface-v1"
    assert surface["templateId"] == "house.master.a"
    assert surface["structuralSeed"] == 18427
    assert surface["detailSeed"] == 4104
    assert surface["appearanceSeed"] == 7001
    assert surface["decaySeed"] == 9907
    assert surface["sourceGeometrySha256"] == ACCEPTED_GEOMETRY_SHA
    assert surface["sourceDetailSha256"] == ACCEPTED_DETAIL_SHA


def test_same_surface_seeds_are_byte_deterministic():
    geometry, detail = _parents()
    a = compile_house_a_surface(geometry, detail, appearance_seed=7001, decay_seed=9907)
    b = compile_house_a_surface(geometry, detail, appearance_seed=7001, decay_seed=9907)

    assert canonical_surface_json(a) == canonical_surface_json(b)
    assert surface_sha256(a) == surface_sha256(b)


def test_surface_families_and_decay_channels_are_bounded():
    geometry, detail = _parents()
    surface = compile_house_a_surface(geometry, detail, appearance_seed=7001, decay_seed=9907)

    assert surface["materials"]["walls"]["family"] in {"PLASTER", "PAINTED_MASONRY", "BRICK"}
    assert surface["materials"]["roof"]["family"] in {"WEATHERED_METAL", "ASPHALT_SHINGLE", "CLAY_TILE"}
    assert surface["materials"]["glass"]["state"] in {"DIRTY_INTACT", "CRACKED", "BOARDED"}

    for value in surface["decay"].values():
        assert 0.0 <= float(value) <= 1.0


def test_appearance_seed_does_not_change_decay_channels():
    geometry, detail = _parents()
    a = compile_house_a_surface(geometry, detail, appearance_seed=1, decay_seed=9907)
    b = compile_house_a_surface(geometry, detail, appearance_seed=2, decay_seed=9907)

    assert a["decay"] == b["decay"]
    assert a["sourceGeometrySha256"] == b["sourceGeometrySha256"]
    assert a["sourceDetailSha256"] == b["sourceDetailSha256"]


def test_decay_seed_does_not_change_base_material_palette():
    geometry, detail = _parents()
    a = compile_house_a_surface(geometry, detail, appearance_seed=7001, decay_seed=1)
    b = compile_house_a_surface(geometry, detail, appearance_seed=7001, decay_seed=2)

    assert a["materials"]["walls"] == b["materials"]["walls"]
    assert a["materials"]["roof"] == b["materials"]["roof"]
    assert a["materials"]["trim"] == b["materials"]["trim"]
    assert a["materials"]["metal"] == b["materials"]["metal"]
    assert a["sourceGeometrySha256"] == b["sourceGeometrySha256"]
    assert a["sourceDetailSha256"] == b["sourceDetailSha256"]
