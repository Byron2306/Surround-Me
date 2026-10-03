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
