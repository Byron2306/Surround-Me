from tools.hd_iso.generative.candidate_proof import _clear_border_connected_black_matte


def test_opaque_black_border_is_made_transparent_but_interior_black_survives():
    image = [
        [(0,0,0,255),(0,0,0,255),(0,0,0,255),(0,0,0,255),(0,0,0,255)],
        [(0,0,0,255),(90,70,50,255),(90,70,50,255),(90,70,50,255),(0,0,0,255)],
        [(0,0,0,255),(90,70,50,255),(0,0,0,255),(90,70,50,255),(0,0,0,255)],
        [(0,0,0,255),(90,70,50,255),(90,70,50,255),(90,70,50,255),(0,0,0,255)],
        [(0,0,0,255),(0,0,0,255),(0,0,0,255),(0,0,0,255),(0,0,0,255)],
    ]
    out = _clear_border_connected_black_matte(image)
    assert out[0][0][3] == 0
    assert out[2][2] == (0,0,0,255)
    assert out[2][1][3] == 255


def test_transparent_candidate_is_left_semantically_unchanged():
    image = [
        [(0,0,0,0),(0,0,0,0)],
        [(10,10,10,255),(0,0,0,0)],
    ]
    assert _clear_border_connected_black_matte(image) == image


def test_transparent_margin_can_reach_and_clear_inner_black_matte():
    image = [
        [(0,0,0,0),(0,0,0,0),(0,0,0,0),(0,0,0,0),(0,0,0,0)],
        [(0,0,0,0),(0,0,0,255),(0,0,0,255),(0,0,0,255),(0,0,0,0)],
        [(0,0,0,0),(0,0,0,255),(90,70,50,255),(0,0,0,255),(0,0,0,0)],
        [(0,0,0,0),(0,0,0,255),(0,0,0,255),(0,0,0,255),(0,0,0,0)],
        [(0,0,0,0),(0,0,0,0),(0,0,0,0),(0,0,0,0),(0,0,0,0)],
    ]
    out = _clear_border_connected_black_matte(image)
    assert out[1][1][3] == 0
    assert out[1][2][3] == 0
    assert out[2][1][3] == 0
    assert out[2][2] == (90,70,50,255)
