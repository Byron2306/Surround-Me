from __future__ import annotations

import copy
from pathlib import Path

from tools.hd_iso.compile_geometry import compile_template, manifest_dict
from tools.hd_iso.compile_detail import compile_house_a_detail
from tools.hd_iso.compile_surface import compile_house_a_surface
from tools.hd_iso.surface.validation import validate_house_a_surface

ROOT = Path(__file__).resolve().parents[2]


def _fixtures():
    geometry = manifest_dict(compile_template("house.master.a", structural_seed=18427, root=ROOT))
    detail = compile_house_a_detail(geometry, detail_seed=4104)
    surface = compile_house_a_surface(geometry, detail, appearance_seed=7001, decay_seed=9907)
    return geometry, detail, surface


def test_canonical_surface_passes_validation():
    geometry, detail, surface = _fixtures()
    result = validate_house_a_surface(geometry, detail, surface)
    assert result.status == "PASS", result.reasons
    assert result.reasons == ()


def test_parent_hash_tamper_refuses():
    geometry, detail, surface = _fixtures()

    bad = copy.deepcopy(surface)
    bad["sourceGeometrySha256"] = "sha256:" + ("0" * 64)
    result = validate_house_a_surface(geometry, detail, bad)
    assert result.status == "REFUSE"
    assert "source_geometry_hash_mismatch" in result.reasons

    bad = copy.deepcopy(surface)
    bad["sourceDetailSha256"] = "sha256:" + ("f" * 64)
    result = validate_house_a_surface(geometry, detail, bad)
    assert result.status == "REFUSE"
    assert "source_detail_hash_mismatch" in result.reasons


def test_illegal_material_families_refuse():
    geometry, detail, surface = _fixtures()

    bad = copy.deepcopy(surface)
    bad["materials"]["walls"]["family"] = "MAGIC_STUCCO"
    result = validate_house_a_surface(geometry, detail, bad)
    assert result.status == "REFUSE"
    assert "wall_material_family_invalid" in result.reasons

    bad = copy.deepcopy(surface)
    bad["materials"]["roof"]["family"] = "THATCH"
    result = validate_house_a_surface(geometry, detail, bad)
    assert result.status == "REFUSE"
    assert "roof_material_family_invalid" in result.reasons

    bad = copy.deepcopy(surface)
    bad["materials"]["glass"]["state"] = "PORTAL"
    result = validate_house_a_surface(geometry, detail, bad)
    assert result.status == "REFUSE"
    assert "glass_state_invalid" in result.reasons


def test_material_numeric_channels_are_bounded():
    geometry, detail, surface = _fixtures()

    bad = copy.deepcopy(surface)
    bad["materials"]["walls"]["roughness"] = 1.5
    result = validate_house_a_surface(geometry, detail, bad)
    assert result.status == "REFUSE"
    assert "material_roughness_out_of_range" in result.reasons

    bad = copy.deepcopy(surface)
    bad["materials"]["roof"]["baseColorRgba"][0] = -0.1
    result = validate_house_a_surface(geometry, detail, bad)
    assert result.status == "REFUSE"
    assert "material_color_out_of_range" in result.reasons


def test_decay_channels_must_stay_inside_unit_interval():
    geometry, detail, surface = _fixtures()

    bad = copy.deepcopy(surface)
    bad["decay"]["grime"] = 1.25
    result = validate_house_a_surface(geometry, detail, bad)
    assert result.status == "REFUSE"
    assert "decay_channel_out_of_range" in result.reasons

    bad = copy.deepcopy(surface)
    bad["decay"]["rust"] = -0.1
    result = validate_house_a_surface(geometry, detail, bad)
    assert result.status == "REFUSE"
    assert "decay_channel_out_of_range" in result.reasons


def test_seed_and_schema_mismatch_refuse():
    geometry, detail, surface = _fixtures()

    bad = copy.deepcopy(surface)
    bad["schemaVersion"] = "bogus"
    result = validate_house_a_surface(geometry, detail, bad)
    assert result.status == "REFUSE"
    assert "surface_schema_mismatch" in result.reasons

    bad = copy.deepcopy(surface)
    bad["structuralSeed"] = 999
    result = validate_house_a_surface(geometry, detail, bad)
    assert result.status == "REFUSE"
    assert "structural_seed_mismatch" in result.reasons

    bad = copy.deepcopy(surface)
    bad["detailSeed"] = 999
    result = validate_house_a_surface(geometry, detail, bad)
    assert result.status == "REFUSE"
    assert "detail_seed_mismatch" in result.reasons


def test_surface_manifest_cannot_smuggle_structural_authority():
    geometry, detail, surface = _fixtures()

    for forbidden in ("widthM", "depthM", "anchor", "wallHeightM", "roofPitchDegrees", "cameraMatrix"):
        bad = copy.deepcopy(surface)
        bad[forbidden] = 123
        result = validate_house_a_surface(geometry, detail, bad)
        assert result.status == "REFUSE"
        assert "forbidden_structural_field" in result.reasons
