from tools.hd_iso.geometry.projection import anchor_world_position, project_ground


def test_project_ground_uses_frozen_64x32_per_2m_basis():
    assert project_ground(2.0, 0.0) == (32.0, 16.0)
    assert project_ground(0.0, 2.0) == (-32.0, 16.0)
    assert project_ground(2.0, 2.0) == (0.0, 32.0)


def test_house_a_anchor_maps_bottom_center_of_7_5_by_6_0_footprint():
    assert anchor_world_position(7.5, 6.0, (0.5, 1.0)) == (3.75, 6.0)
