from __future__ import annotations

import copy
from pathlib import Path

from tools.hd_iso.compile_geometry import compile_template, manifest_dict
from tools.hd_iso.compile_detail import compile_house_a_detail
from tools.hd_iso.compile_surface import compile_house_a_surface
from tools.hd_iso.compile_surface_fidelity import compile_house_a_surface_fidelity
from tools.hd_iso.surface_fidelity.validation import validate_house_a_surface_fidelity

ROOT = Path(__file__).resolve().parents[2]


def _fixtures():
    geometry = manifest_dict(compile_template("house.master.a", structural_seed=18427, root=ROOT))
    detail = compile_house_a_detail(geometry, detail_seed=4104)
    surface = compile_house_a_surface(
        geometry,
        detail,
        appearance_seed=7001,
        decay_seed=9907,
    )
    fidelity = compile_house_a_surface_fidelity(
        geometry,
        detail,
        surface,
        fidelity_seed=27182,
    )
    return geometry, detail, surface, fidelity


def test_canonical_surface_fidelity_passes_validation():
    geometry, detail, surface, fidelity = _fixtures()
    result = validate_house_a_surface_fidelity(geometry, detail, surface, fidelity)
    assert result.status == "PASS", result.reasons
    assert result.reasons == ()


def test_parent_hash_tamper_refuses():
    geometry, detail, surface, fidelity = _fixtures()

    cases = (
        ("sourceGeometrySha256", "source_geometry_hash_mismatch"),
        ("sourceDetailSha256", "source_detail_hash_mismatch"),
        ("sourceSurfaceSha256", "source_surface_hash_mismatch"),
    )
    for field, reason in cases:
        bad = copy.deepcopy(fidelity)
        bad[field] = "sha256:" + ("0" * 64)
        result = validate_house_a_surface_fidelity(geometry, detail, surface, bad)
        assert result.status == "REFUSE"
        assert reason in result.reasons


def test_seed_lineage_and_schema_mismatch_refuse():
    geometry, detail, surface, fidelity = _fixtures()

    mutations = (
        ("schemaVersion", "bogus", "fidelity_schema_mismatch"),
        ("structuralSeed", 999, "structural_seed_mismatch"),
        ("detailSeed", 999, "detail_seed_mismatch"),
        ("appearanceSeed", 999, "appearance_seed_mismatch"),
        ("decaySeed", 999, "decay_seed_mismatch"),
    )
    for field, value, reason in mutations:
        bad = copy.deepcopy(fidelity)
        bad[field] = value
        result = validate_house_a_surface_fidelity(geometry, detail, surface, bad)
        assert result.status == "REFUSE"
        assert reason in result.reasons


def test_channel_sets_are_exact():
    geometry, detail, surface, fidelity = _fixtures()

    bad = copy.deepcopy(fidelity)
    del bad["channels"]["walls"]["microScale"]
    result = validate_house_a_surface_fidelity(geometry, detail, surface, bad)
    assert result.status == "REFUSE"
    assert "fidelity_channel_set_mismatch" in result.reasons

    bad = copy.deepcopy(fidelity)
    bad["channels"]["roof"]["secretDisplacement"] = 0.5
    result = validate_house_a_surface_fidelity(geometry, detail, surface, bad)
    assert result.status == "REFUSE"
    assert "fidelity_channel_set_mismatch" in result.reasons

    bad = copy.deepcopy(fidelity)
    bad["channels"]["soil"] = {"scale": 1.0}
    result = validate_house_a_surface_fidelity(geometry, detail, surface, bad)
    assert result.status == "REFUSE"
    assert "fidelity_block_set_mismatch" in result.reasons


def test_unit_channels_refuse_out_of_range_values():
    geometry, detail, surface, fidelity = _fixtures()

    bad = copy.deepcopy(fidelity)
    bad["channels"]["walls"]["microStrength"] = 1.1
    result = validate_house_a_surface_fidelity(geometry, detail, surface, bad)
    assert result.status == "REFUSE"
    assert "fidelity_unit_value_out_of_range" in result.reasons

    bad = copy.deepcopy(fidelity)
    bad["channels"]["metal"]["rustEdgeBias"] = -0.01
    result = validate_house_a_surface_fidelity(geometry, detail, surface, bad)
    assert result.status == "REFUSE"
    assert "fidelity_unit_value_out_of_range" in result.reasons


def test_scale_channels_refuse_values_outside_declared_bounds():
    geometry, detail, surface, fidelity = _fixtures()

    bad = copy.deepcopy(fidelity)
    bad["channels"]["walls"]["microScale"] = 1000.0
    result = validate_house_a_surface_fidelity(geometry, detail, surface, bad)
    assert result.status == "REFUSE"
    assert "fidelity_scale_out_of_range" in result.reasons

    bad = copy.deepcopy(fidelity)
    bad["channels"]["glass"]["scratchScale"] = 0.001
    result = validate_house_a_surface_fidelity(geometry, detail, surface, bad)
    assert result.status == "REFUSE"
    assert "fidelity_scale_out_of_range" in result.reasons


def test_fidelity_manifest_cannot_smuggle_geometry_or_displacement_authority():
    geometry, detail, surface, fidelity = _fixtures()

    forbidden = (
        "widthM",
        "anchor",
        "cameraMatrix",
        "projectionAdapter",
        "displacement",
        "displaceModifier",
        "geometryNodes",
        "vertexOffset",
    )
    for field in forbidden:
        bad = copy.deepcopy(fidelity)
        bad[field] = 1
        result = validate_house_a_surface_fidelity(geometry, detail, surface, bad)
        assert result.status == "REFUSE"
        assert "forbidden_fidelity_authority" in result.reasons
