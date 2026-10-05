import json
import os
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]


def _run(*args, env=None):
    merged_env = os.environ.copy()
    if env:
        merged_env.update(env)
    return subprocess.run(
        [sys.executable, "-m", "tools.hd_iso.cli", *args],
        cwd=ROOT,
        text=True,
        capture_output=True,
        env=merged_env,
    )


def test_compile_cli_writes_deterministic_geometry_json(tmp_path):
    out = tmp_path / "geometry.json"
    first = _run("compile", "house.master.a", "--seed", "18427", "--out", str(out))
    assert first.returncode == 0, first.stderr
    payload = json.loads(out.read_text())
    assert payload["schemaVersion"] == "hd-iso-geometry-v1"
    assert payload["templateId"] == "house.master.a"
    assert payload["structuralSeed"] == 18427
    before = out.read_bytes()
    second = _run("compile", "house.master.a", "--seed", "18427", "--out", str(out))
    assert second.returncode == 0
    assert out.read_bytes() == before


def test_validate_cli_passes_valid_house_and_fails_unknown_template(tmp_path):
    out = tmp_path / "geometry.json"
    good = _run("validate", "house.master.a", "--seed", "18427", "--out", str(out))
    assert good.returncode == 0, good.stderr
    assert json.loads(good.stdout)["status"] == "PASS"

    bad = _run("validate", "house.unknown", "--seed", "1", "--out", str(out))
    assert bad.returncode != 0
    refused = json.loads(bad.stdout)
    assert refused["status"] == "REFUSE"
    assert "unknown_template" in refused["reasons"]


def test_build_cli_runs_compile_validate_render_and_prove(tmp_path):
    out = tmp_path / "house-a-build"
    result = _run("build", "house.master.a", "--seed", "18427", "--out", str(out))
    assert result.returncode == 0, result.stderr

    payload = json.loads(result.stdout.strip().splitlines()[-1])
    assert payload["status"] == "PASS", payload
    assert payload["templateId"] == "house.master.a"
    assert payload["structuralSeed"] == 18427

    assert (out / "geometry.json").exists()
    assert (out / "render" / "beauty.png").exists()
    assert (out / "render" / "scene-manifest.json").exists()
    assert (out / "proof" / "proof.json").exists()
    assert (out / "proof" / "calibration.png").exists()

    proof = json.loads((out / "proof" / "proof.json").read_text())
    assert proof["status"] == "PASS", proof


def test_build_cli_refuses_when_blender_render_fails(tmp_path):
    out = tmp_path / "house-a-build-refuse"
    result = _run(
        "build",
        "house.master.a",
        "--seed",
        "18427",
        "--out",
        str(out),
        env={"BLENDER_BIN": str(tmp_path / "missing-blender")},
    )
    assert result.returncode != 0
    payload = json.loads(result.stdout.strip().splitlines()[-1])
    assert payload["status"] == "REFUSE"
    assert payload["reasons"]


def test_build_cli_compiles_validates_and_renders_detail_manifest(tmp_path):
    out = tmp_path / "house-a-detail-build"
    result = _run(
        "build",
        "house.master.a",
        "--seed",
        "18427",
        "--detail-seed",
        "4104",
        "--out",
        str(out),
    )
    assert result.returncode == 0, result.stderr

    payload = json.loads(result.stdout.strip().splitlines()[-1])
    assert payload["status"] == "PASS", payload
    assert payload["structuralSeed"] == 18427
    assert payload["detailSeed"] == 4104
    assert payload["detail"] == str(out / "detail.json")

    geometry = json.loads((out / "geometry.json").read_text())
    detail = json.loads((out / "detail.json").read_text())

    assert geometry["templateId"] == "house.master.a"
    assert detail["schemaVersion"] == "hd-iso-detail-v1"
    assert detail["templateId"] == "house.master.a"
    assert detail["structuralSeed"] == 18427
    assert detail["detailSeed"] == 4104
    assert detail["sourceGeometrySha256"] == (
        "sha256:820ca6b7bcd774eb93c2ad3bcb93567a8a42bde484d7d1e4a71e9cc6bd9104a1"
    )

    scene = json.loads((out / "render" / "scene-manifest.json").read_text())
    assert scene["detail"]["schemaVersion"] == "hd-iso-detail-v1"
    assert scene["detail"]["detailSeed"] == 4104
    assert scene["detail"]["sourceGeometrySha256"] == detail["sourceGeometrySha256"]
    assert scene["detail"]["objectCounts"]["windows"] == len(detail["windows"])
    assert scene["detail"]["objectCounts"]["fascia"] == 2
    assert scene["detail"]["objectCounts"]["gutter"] == 1
    assert scene["detail"]["objectCounts"]["downpipe"] == 1
    assert scene["detail"]["objectCounts"]["porch"] == 1


def test_build_cli_compiles_validates_and_renders_surface_manifest(tmp_path):
    out = tmp_path / "house-a-surface-build"
    result = _run(
        "build",
        "house.master.a",
        "--seed",
        "18427",
        "--detail-seed",
        "4104",
        "--appearance-seed",
        "7001",
        "--decay-seed",
        "9907",
        "--out",
        str(out),
    )
    assert result.returncode == 0, result.stderr

    payload = json.loads(result.stdout.strip().splitlines()[-1])
    assert payload["status"] == "PASS", payload
    assert payload["structuralSeed"] == 18427
    assert payload["detailSeed"] == 4104
    assert payload["appearanceSeed"] == 7001
    assert payload["decaySeed"] == 9907
    assert payload["surface"] == str(out / "surface.json")

    geometry = json.loads((out / "geometry.json").read_text())
    detail = json.loads((out / "detail.json").read_text())
    surface = json.loads((out / "surface.json").read_text())

    assert geometry["templateId"] == "house.master.a"
    assert detail["schemaVersion"] == "hd-iso-detail-v1"
    assert surface["schemaVersion"] == "hd-iso-surface-v1"
    assert surface["templateId"] == "house.master.a"
    assert surface["structuralSeed"] == 18427
    assert surface["detailSeed"] == 4104
    assert surface["appearanceSeed"] == 7001
    assert surface["decaySeed"] == 9907
    assert surface["sourceGeometrySha256"] == (
        "sha256:820ca6b7bcd774eb93c2ad3bcb93567a8a42bde484d7d1e4a71e9cc6bd9104a1"
    )
    assert surface["sourceDetailSha256"] == (
        "sha256:e2f1d4ac85cef2b32db76c424fd11988cf8912afb452b593aeaae81c416308e4"
    )

    scene = json.loads((out / "render" / "scene-manifest.json").read_text())
    assert scene["surface"]["schemaVersion"] == "hd-iso-surface-v1"
    assert scene["surface"]["appearanceSeed"] == 7001
    assert scene["surface"]["decaySeed"] == 9907
    assert scene["surface"]["sourceGeometrySha256"] == surface["sourceGeometrySha256"]
    assert scene["surface"]["sourceDetailSha256"] == surface["sourceDetailSha256"]
    assert scene["surface"]["assignments"]["walls"]["family"] == surface["materials"]["walls"]["family"]
    assert scene["surface"]["assignments"]["roof"]["family"] == surface["materials"]["roof"]["family"]
    assert scene["surface"]["assignments"]["glass"]["state"] == surface["materials"]["glass"]["state"]


def test_build_cli_compiles_validates_and_renders_surface_fidelity_manifest(tmp_path):
    out = tmp_path / "house-a-fidelity-build"
    result = _run(
        "build",
        "house.master.a",
        "--seed",
        "18427",
        "--detail-seed",
        "4104",
        "--appearance-seed",
        "7001",
        "--decay-seed",
        "9907",
        "--fidelity-seed",
        "27182",
        "--out",
        str(out),
    )
    assert result.returncode == 0, result.stderr

    payload = json.loads(result.stdout.strip().splitlines()[-1])
    assert payload["status"] == "PASS", payload
    assert payload["fidelitySeed"] == 27182
    assert payload["surfaceFidelity"] == str(out / "surface-fidelity.json")

    fidelity = json.loads((out / "surface-fidelity.json").read_text())
    assert fidelity["schemaVersion"] == "hd-iso-surface-fidelity-v1"
    assert fidelity["templateId"] == "house.master.a"
    assert fidelity["fidelitySeed"] == 27182
    assert fidelity["sourceGeometrySha256"] == (
        "sha256:820ca6b7bcd774eb93c2ad3bcb93567a8a42bde484d7d1e4a71e9cc6bd9104a1"
    )
    assert fidelity["sourceDetailSha256"] == (
        "sha256:e2f1d4ac85cef2b32db76c424fd11988cf8912afb452b593aeaae81c416308e4"
    )
    assert fidelity["sourceSurfaceSha256"] == (
        "sha256:c32c73d9d82d624f07186089e03e5c029f33aa338e68f7f90bc243434f84aa1b"
    )

    scene = json.loads((out / "render" / "scene-manifest.json").read_text())
    assert scene["surfaceFidelity"]["schemaVersion"] == "hd-iso-surface-fidelity-v1"
    assert scene["surfaceFidelity"]["fidelitySeed"] == 27182
    assert scene["surfaceFidelity"]["sourceSurfaceSha256"] == fidelity["sourceSurfaceSha256"]
    assert scene["surfaceFidelity"]["roles"]["walls"]["directionalWeathering"] is True
    assert scene["surfaceFidelity"]["roles"]["roof"]["directionalWeathering"] is True
    assert scene["surfaceFidelity"]["roles"]["metal"]["rustClustering"] is True
    assert scene["surfaceFidelity"]["roles"]["glass"]["layeredHaze"] is True
    assert scene["surfaceFidelity"]["roles"]["trim"]["grainWear"] is True
