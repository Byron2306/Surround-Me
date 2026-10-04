from __future__ import annotations

import copy
from pathlib import Path

from tools.hd_iso.compile_geometry import compile_template, manifest_dict
from tools.hd_iso.compile_detail import compile_house_a_detail
from tools.hd_iso.detail.validation import validate_house_a_detail

ROOT = Path(__file__).resolve().parents[2]


def _fixtures():
    geometry = manifest_dict(compile_template("house.master.a", structural_seed=18427, root=ROOT))
    detail = compile_house_a_detail(geometry, detail_seed=4104)
    return geometry, detail


def test_canonical_detail_passes_validation():
    geometry, detail = _fixtures()
    result = validate_house_a_detail(geometry, detail)
    assert result.status == "PASS", result.reasons
    assert result.reasons == ()


def test_source_geometry_hash_tamper_refuses():
    geometry, detail = _fixtures()
    bad = copy.deepcopy(detail)
    bad["sourceGeometrySha256"] = "sha256:" + ("0" * 64)
    result = validate_house_a_detail(geometry, bad)
    assert result.status == "REFUSE"
    assert "source_geometry_hash_mismatch" in result.reasons


def test_window_detail_must_exactly_match_geometry_socket():
    geometry, detail = _fixtures()
    bad = copy.deepcopy(detail)
    bad["windows"][0]["widthM"] += 0.01
    result = validate_house_a_detail(geometry, bad)
    assert result.status == "REFUSE"
    assert "window_socket_mismatch" in result.reasons


def test_eave_detail_must_match_geometry_law():
    geometry, detail = _fixtures()
    bad = copy.deepcopy(detail)
    bad["eaves"]["overhangM"] += 0.05
    result = validate_house_a_detail(geometry, bad)
    assert result.status == "REFUSE"
    assert "eave_mismatch" in result.reasons


def test_porch_cannot_exceed_attachment_allowance():
    geometry, detail = _fixtures()
    bad = copy.deepcopy(detail)
    bad["porch"]["boundsM"][1] += 1.0
    result = validate_house_a_detail(geometry, bad)
    assert result.status == "REFUSE"
    assert "porch_outside_allowance" in result.reasons


def test_gutter_cannot_exceed_derived_front_eave_span():
    geometry, detail = _fixtures()
    bad = copy.deepcopy(detail)
    bad["gutter"]["lengthM"] += 0.25
    result = validate_house_a_detail(geometry, bad)
    assert result.status == "REFUSE"
    assert "gutter_length_mismatch" in result.reasons


def test_downpipe_is_bounded_to_front_facade_and_legal_size():
    geometry, detail = _fixtures()

    bad = copy.deepcopy(detail)
    bad["downpipe"]["facade"] = "BACK"
    result = validate_house_a_detail(geometry, bad)
    assert result.status == "REFUSE"
    assert "downpipe_facade_mismatch" in result.reasons

    bad = copy.deepcopy(detail)
    bad["downpipe"]["diameterM"] = 0.4
    result = validate_house_a_detail(geometry, bad)
    assert result.status == "REFUSE"
    assert "downpipe_diameter_out_of_range" in result.reasons


def test_unknown_detail_schema_or_template_refuses():
    geometry, detail = _fixtures()

    bad = copy.deepcopy(detail)
    bad["schemaVersion"] = "bogus"
    result = validate_house_a_detail(geometry, bad)
    assert result.status == "REFUSE"
    assert "detail_schema_mismatch" in result.reasons

    bad = copy.deepcopy(detail)
    bad["templateId"] = "shop.corner.master.a"
    result = validate_house_a_detail(geometry, bad)
    assert result.status == "REFUSE"
    assert "detail_template_mismatch" in result.reasons
