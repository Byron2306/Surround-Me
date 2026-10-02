import json
from dataclasses import FrozenInstanceError
from pathlib import Path

import pytest

from tools.hd_iso.geometry.model import AttachmentSocket, GeometryManifest, HouseGeometry, OpeningSocket


ROOT = Path(__file__).resolve().parents[2]
TEMPLATE = ROOT / "world-art/hd-iso-v1/templates/house-master-a.json"


def test_house_a_template_locks_world_geometry_and_human_scale():
    data = json.loads(TEMPLATE.read_text())
    assert data["templateId"] == "house.master.a"
    assert data["footprintM"] == [7.5, 6.0]
    assert data["footprintTiles"] == [3.75, 3.0]
    assert data["maxHeightM"] == 4.8
    assert data["anchor"] == [0.5, 1.0]
    assert data["door"]["heightM"] == 2.0
    assert data["door"]["widthM"] == 0.90
    assert data["roof"]["pitchDegrees"] == {"min": 26.0, "max": 38.0}
    assert data["roof"]["type"] == "gable"
    assert data["roof"]["ridgeAxis"] == "X"


def test_geometry_contract_types_are_immutable():
    door = OpeningSocket("front-door", "FRONT", 0.90, 2.0, 0.0, 0.5)
    house = HouseGeometry(
        template_id="house.master.a",
        width_m=7.5,
        depth_m=6.0,
        max_height_m=4.8,
        anchor=(0.5, 1.0),
        facade_orientation="FRONT",
        wall_height_m=2.7,
        roof_pitch_degrees=32.0,
        ridge_axis="X",
        eave_overhang_m=0.35,
        door=door,
        windows=(),
        attachments=(AttachmentSocket("porch", "FRONT", (2.4, 1.2, 1.2)),),
    )
    manifest = GeometryManifest("hd-iso-geometry-v1", "house.master.a", 0, house)
    with pytest.raises(FrozenInstanceError):
        manifest.structural_seed = 9
