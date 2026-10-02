import json
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]


def _run(*args):
    return subprocess.run(
        [sys.executable, "-m", "tools.hd_iso.cli", *args],
        cwd=ROOT,
        text=True,
        capture_output=True,
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
