from __future__ import annotations


def _passfail(ok: bool) -> str:
    return "PASS" if ok else "REFUSE"


def build_geometry_proof(manifest: dict) -> dict:
    reasons: list[str] = []
    checks: dict[str, str] = {}

    if manifest.get("templateId") != "house.master.a":
        return {
            "status": "REFUSE",
            "reasons": ["unknown_template"],
            "checks": {
                "footprint": "REFUSE",
                "height": "REFUSE",
                "anchor": "REFUSE",
                "doorScale": "REFUSE",
            },
        }

    if "variantId" in manifest:
        from ..variants import compile_variant
        from ..compile_geometry import manifest_dict
        try:
            expected = manifest_dict(compile_variant(manifest["variantId"])[0])
        except ValueError:
            expected = None
        if manifest != expected:
            return {"status": "REFUSE", "reasons": ["variant_contract_mismatch"], "checks": {}}
    h = manifest["house"]

    footprint_ok = float(h["widthM"]) == (6.0 if "variantId" in manifest else 7.5) and float(h["depthM"]) == 6.0
    checks["footprint"] = _passfail(footprint_ok)
    if not footprint_ok:
        reasons.append("footprint_mismatch")

    structural_top = float(h["wallHeightM"]) + float(h["roofRiseM"])
    height_ok = float(h["maxHeightM"]) == 4.8 and structural_top <= 4.8 + 1e-9
    checks["height"] = _passfail(height_ok)
    if not height_ok:
        reasons.append("height_contract_mismatch")

    anchor = [float(v) for v in h["anchor"]]
    anchor_ok = anchor == [0.5, 1.0]
    checks["anchor"] = _passfail(anchor_ok)
    if not anchor_ok:
        reasons.append("anchor_contract_mismatch")

    door = h["door"]
    door_ok = float(door["widthM"]) == 0.9 and float(door["heightM"]) == 2.0
    checks["doorScale"] = _passfail(door_ok)
    if not door_ok:
        reasons.append("door_scale_mismatch")

    return {
        "status": "PASS" if not reasons else "REFUSE",
        "reasons": reasons,
        "checks": checks,
        "observed": {
            "footprintM": [float(h["widthM"]), float(h["depthM"])],
            "structuralTopM": structural_top,
            "maxHeightM": float(h["maxHeightM"]),
            "anchor": anchor,
            "doorM": [float(door["widthM"]), float(door["heightM"])],
        },
    }
