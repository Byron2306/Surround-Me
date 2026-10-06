from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]


def test_game_wires_governed_house_a_acceptance_scene():
    game = (ROOT / "game.js").read_text()

    assert "houseAG18Governed" in game
    assert "house-master-a-g1-8-governed-2048.png" in game
    assert "HOUSE_G1_8_TEST" in game
    assert "governedHouseA" in game
    assert "anchorPixelX: 220" in game
    assert "anchorPixelY: 334" in game
    assert "logicalWidth: 512" in game
    assert "logicalHeight: 512" in game

    assert "minX: -1.875" in game
    assert "maxX: 1.875" in game
    assert "minY: -3.0" in game
    assert "maxY: 0.0" in game

    assert "[G1.8 HOUSE TEST]" in game
