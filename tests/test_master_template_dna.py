from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DNA = ROOT / "world-art" / "hd-iso-v1" / "templates" / "master-template-dna-v1.json"
MANIFEST = ROOT / "world-art" / "hd-iso-v1" / "manifest.json"


def _load(path: Path) -> dict:
    return json.loads(path.read_text(encoding="utf-8"))


def test_master_template_dna_contract() -> None:
    data = _load(DNA)
    assert data["schema"] == "surround-me-hd-iso-template-dna-v1"
    assert data["global"]["projection"] == {
        "type": "orthographic_isometric",
        "yawDegrees": 45,
        "pitchDegrees": 30,
        "perspectiveDriftAllowed": False,
    }
    assert data["global"]["world"]["tileSizeM"] == 2.0
    assert data["global"]["world"]["tileWidthPx"] == 64
    assert data["global"]["world"]["tileHeightPx"] == 32

    templates = data["templates"]
    ids = [row["id"] for row in templates]
    assert ids == ["house.master.a", "shop.corner.master.a", "sedan.master.a"]
    assert len(ids) == len(set(ids))

    for row in templates:
        assert row["anchor"] == [0.5, 1.0]
        assert row["nominalHeightM"] > 0
        assert row["footprintTolerancePct"] > 0
        assert set(row["allowedVariation"]).isdisjoint(row["forbiddenVariation"])
        assert "projection" in row["forbiddenVariation"]
        assert "human_scale" in row["forbiddenVariation"]
        for tile_extent, metre_extent in zip(row["footprintTiles"], row["physicalSizeM"]):
            assert tile_extent * 2.0 == metre_extent


def test_master_templates_match_phase_a_manifest_geometry() -> None:
    dna = {row["id"]: row for row in _load(DNA)["templates"]}
    manifest = {row["id"]: row for row in _load(MANIFEST)["assets"]}

    mapping = {
        "house.master.a": "building.house.suburban.01",
        "shop.corner.master.a": "building.shop.corner.01",
        "sedan.master.a": "vehicle.sedan.01",
    }

    for template_id, asset_id in mapping.items():
        template = dna[template_id]
        asset = manifest[asset_id]
        assert template["footprintTiles"] == asset["footprintTiles"]
        assert template["physicalSizeM"] == asset["physicalSizeM"]
        assert template["nominalHeightM"] == asset["nominalHeightM"]
        assert template["anchor"] == asset["anchor"]
