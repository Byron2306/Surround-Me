import json
from dataclasses import replace
from pathlib import Path

from tools.hd_iso.compile_geometry import compile_template
from tools.hd_iso.geometry.model import AttachmentSocket, OpeningSocket
from tools.hd_iso.geometry.validation import validate_house_a

ROOT = Path(__file__).resolve().parents[2]
TEMPLATE = json.loads((ROOT / "world-art/hd-iso-v1/templates/house-master-a.json").read_text())


def _valid(seed=18427):
    return compile_template("house.master.a", seed, ROOT)


def test_compiled_legal_seeds_pass_world_space_validation():
    for seed in (1, 2, 3, 18427):
        result = validate_house_a(_valid(seed), TEMPLATE)
        assert result.status == "PASS", (seed, result.reasons)
        assert result.reasons == ()


def test_dimension_and_height_drift_refuse():
    m = _valid()
    assert validate_house_a(replace(m, house=replace(m.house, width_m=7.51)), TEMPLATE).status == "REFUSE"
    assert validate_house_a(replace(m, house=replace(m.house, depth_m=6.01)), TEMPLATE).status == "REFUSE"
    too_tall = replace(m.house, roof_rise_m=4.8)
    assert "height_envelope_exceeded" in validate_house_a(replace(m, house=too_tall), TEMPLATE).reasons


def test_door_roof_corner_and_collision_drift_refuse():
    m = _valid()
    bad_door = replace(m.house, door=replace(m.house.door, height_m=1.99))
    assert "door_height_mismatch" in validate_house_a(replace(m, house=bad_door), TEMPLATE).reasons

    bad_pitch = replace(m.house, roof_pitch_degrees=38.1)
    assert "roof_pitch_out_of_range" in validate_house_a(replace(m, house=bad_pitch), TEMPLATE).reasons

    corner_window = OpeningSocket("bad", "FRONT", 1.0, 1.2, 0.9, 0.03)
    bad_corner = replace(m.house, windows=(corner_window,))
    assert "opening_corner_clearance" in validate_house_a(replace(m, house=bad_corner), TEMPLATE).reasons

    colliding_window = OpeningSocket("bad", "FRONT", 1.2, 1.2, 0.9, m.house.door.lateral_position)
    bad_collision = replace(m.house, windows=(colliding_window,))
    assert "opening_collision" in validate_house_a(replace(m, house=bad_collision), TEMPLATE).reasons


def test_porch_and_unknown_template_fail_closed():
    m = _valid()
    huge = AttachmentSocket("porch", "FRONT", (2.41, 1.2, 1.2))
    bad_porch = replace(m.house, attachments=(huge,))
    assert "porch_outside_allowance" in validate_house_a(replace(m, house=bad_porch), TEMPLATE).reasons

    unknown = replace(m, template_id="house.unknown")
    assert validate_house_a(unknown, TEMPLATE).status == "REFUSE"
    assert "unknown_template" in validate_house_a(unknown, TEMPLATE).reasons
