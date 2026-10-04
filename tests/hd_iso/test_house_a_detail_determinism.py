from __future__ import annotations

from pathlib import Path

from tools.hd_iso.compile_geometry import (
    canonical_geometry_json,
    compile_template,
    geometry_sha256,
    manifest_dict,
)
from tools.hd_iso.compile_detail import (
    canonical_detail_json,
    compile_house_a_detail,
    detail_sha256,
)

ROOT = Path(__file__).resolve().parents[2]
ACCEPTED_CANONICAL_GEOMETRY_SHA = "sha256:820ca6b7bcd774eb93c2ad3bcb93567a8a42bde484d7d1e4a71e9cc6bd9104a1"


def _geometry():
    manifest = compile_template("house.master.a", structural_seed=18427, root=ROOT)
    return manifest, manifest_dict(manifest)


def test_detail_compiler_preserves_accepted_geometry_bytes_and_hash():
    manifest, geometry = _geometry()
    before_json = canonical_geometry_json(manifest)
    before_sha = geometry_sha256(manifest)

    detail = compile_house_a_detail(geometry, detail_seed=4104)

    assert canonical_geometry_json(manifest) == before_json
    assert geometry_sha256(manifest) == before_sha == ACCEPTED_CANONICAL_GEOMETRY_SHA
    assert detail["sourceGeometrySha256"] == ACCEPTED_CANONICAL_GEOMETRY_SHA
    assert detail["templateId"] == "house.master.a"
    assert detail["structuralSeed"] == 18427
    assert detail["detailSeed"] == 4104


def test_same_detail_seed_is_byte_deterministic():
    _, geometry = _geometry()
    first = compile_house_a_detail(geometry, detail_seed=4104)
    second = compile_house_a_detail(geometry, detail_seed=4104)

    assert canonical_detail_json(first) == canonical_detail_json(second)
    assert detail_sha256(first) == detail_sha256(second)


def test_window_detail_exactly_mirrors_existing_geometry_sockets():
    _, geometry = _geometry()
    detail = compile_house_a_detail(geometry, detail_seed=4104)

    expected = [
        {
            "name": w["name"],
            "facade": w["facade"],
            "widthM": w["widthM"],
            "heightM": w["heightM"],
            "sillHeightM": w["sillHeightM"],
            "lateralPosition": w["lateralPosition"],
        }
        for w in geometry["house"]["windows"]
    ]
    assert detail["windows"] == expected


def test_detail_objects_stay_derived_and_bounded():
    _, geometry = _geometry()
    detail = compile_house_a_detail(geometry, detail_seed=4104)
    house = geometry["house"]

    assert detail["eaves"]["overhangM"] == house["eaveOverhangM"]
    assert detail["eaves"]["ridgeAxis"] == house["ridgeAxis"]
    assert detail["fascia"]["thicknessM"] > 0.0

    gutter = detail["gutter"]
    assert gutter["facade"] == "FRONT"
    assert gutter["lengthM"] <= house["widthM"] + (2.0 * house["eaveOverhangM"]) + 1e-9

    downpipe = detail["downpipe"]
    assert downpipe["facade"] == "FRONT"
    assert downpipe["side"] in {"LEFT", "RIGHT"}
    assert 0.0 < downpipe["diameterM"] <= 0.15

    porch = detail["porch"]
    allowed = next(a["boundsM"] for a in house["attachments"] if a["name"] == "porch")
    assert all(actual <= limit + 1e-9 for actual, limit in zip(porch["boundsM"], allowed))
    assert porch["facade"] == "FRONT"


def test_different_detail_seeds_cannot_change_structural_source():
    _, geometry = _geometry()
    a = compile_house_a_detail(geometry, detail_seed=1)
    b = compile_house_a_detail(geometry, detail_seed=2)

    immutable_keys = ("templateId", "structuralSeed", "sourceGeometrySha256", "windows", "eaves", "fascia", "gutter")
    for key in immutable_keys:
        assert a[key] == b[key]

    # Legal variety is intentionally tiny in A1.
    assert (a["downpipe"]["side"], a["porch"]["style"]) != (
        b["downpipe"]["side"],
        b["porch"]["style"],
    )
