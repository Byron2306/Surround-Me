from __future__ import annotations

import json
from pathlib import Path

from tools.hd_iso.generative.candidate_proof import prove_candidate


def test_real_candidate_proof_normalizes_and_emits_governed_sprite(tmp_path: Path):
    fixture = Path(__file__).resolve().parent / "fixtures" / "generative"
    candidate = fixture / "candidate.png"
    mask_dir = fixture / "masks"

    out = tmp_path / "proof"

    result = prove_candidate(
        candidate_path=candidate,
        mask_manifest_path=mask_dir / "manifest.json",
        out_dir=out,
    )

    assert result["status"] == "PASS", result
    assert result["rawCandidate"]["status"] == "REFUSE"
    assert "canvas_size_mismatch" in result["rawCandidate"]["reasons"]

    assert result["normalizedCandidate"]["width"] == 512
    assert result["normalizedCandidate"]["height"] == 512

    governed = out / "governed-candidate.png"
    proof = out / "proof.json"

    assert governed.exists()
    assert proof.exists()

    payload = json.loads(proof.read_text())
    assert payload["status"] == "PASS"
    assert payload["canonicalAuthority"]["alpha"] == "silhouette"
    assert payload["canonicalAuthority"]["regions"] is True
    assert payload["governedCandidate"]["width"] == 512
    assert payload["governedCandidate"]["height"] == 512


def test_candidate_proof_refuses_missing_mask_bundle(tmp_path: Path):
    fixture = Path(__file__).resolve().parent / "fixtures" / "generative"
    candidate = fixture / "candidate.png"

    result = prove_candidate(
        candidate_path=candidate,
        mask_manifest_path=tmp_path / "missing.json",
        out_dir=tmp_path / "proof",
    )

    assert result["status"] == "REFUSE"
    assert "mask_manifest_missing" in result["reasons"]


def test_candidate_proof_refuses_mask_contract_drift(tmp_path: Path):
    fixture = Path(__file__).resolve().parent / "fixtures" / "generative"
    candidate = fixture / "candidate.png"
    source_manifest = json.loads((fixture / "masks" / "manifest.json").read_text())

    source_manifest["cameraHash"] = "sha256:" + ("0" * 64)
    bad_manifest = tmp_path / "manifest.json"
    bad_manifest.write_text(json.dumps(source_manifest))

    result = prove_candidate(
        candidate_path=candidate,
        mask_manifest_path=bad_manifest,
        out_dir=tmp_path / "proof",
    )

    assert result["status"] == "REFUSE"
    assert "mask_camera_hash_mismatch" in result["reasons"]
