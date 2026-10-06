from tools.hd_iso.generative.candidate_proof import _region_allows_empty_mask


def test_region_allows_intentionally_empty_variant_region():
    assert _region_allows_empty_mask({"pixelCount": 0, "objects": []}) is True


def test_region_does_not_allow_missing_pixels_when_objects_exist():
    assert _region_allows_empty_mask({"pixelCount": 0, "objects": ["HouseA.Detail.PorchFrame"]}) is False


def test_region_does_not_allow_empty_when_manifest_expects_pixels():
    assert _region_allows_empty_mask({"pixelCount": 12, "objects": []}) is False
