from dataclasses import asdict
from pathlib import Path

from tools.hd_iso.compile_geometry import compile_template, geometry_sha256


ROOT = Path(__file__).resolve().parents[2]


def test_same_seed_produces_identical_manifest_and_hash():
    first = compile_template("house.master.a", structural_seed=18427, root=ROOT)
    second = compile_template("house.master.a", structural_seed=18427, root=ROOT)
    assert asdict(first) == asdict(second)
    assert geometry_sha256(first) == geometry_sha256(second)


def test_legal_seeds_cannot_mutate_world_law():
    manifests = [compile_template("house.master.a", structural_seed=s, root=ROOT) for s in (1, 2, 3, 18427)]
    for manifest in manifests:
        house = manifest.house
        assert (house.width_m, house.depth_m) == (7.5, 6.0)
        assert house.anchor == (0.5, 1.0)
        assert house.facade_orientation == "FRONT"
        assert house.max_height_m == 4.8
        assert house.door.height_m == 2.0
        assert house.door.width_m == 0.9
        assert 26.0 <= house.roof_pitch_degrees <= 38.0
        assert house.wall_height_m + house.roof_rise_m <= 4.8 + 1e-9


def test_different_seeds_can_change_only_bounded_structural_parameters():
    a = compile_template("house.master.a", structural_seed=1, root=ROOT).house
    b = compile_template("house.master.a", structural_seed=2, root=ROOT).house
    assert (a.wall_height_m, a.roof_pitch_degrees, a.door.lateral_position) != (
        b.wall_height_m,
        b.roof_pitch_degrees,
        b.door.lateral_position,
    )
