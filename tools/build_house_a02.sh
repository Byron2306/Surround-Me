#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
python -m tools.hd_iso.cli build house.master.a --variant house.a.02 --detail-seed 18428 --appearance-seed 18428 --decay-seed 18428 --fidelity-seed 18428 --render-scale 4 --out build/hd-iso/house.a.02
python -m tools.hd_iso.variant_export build/hd-iso/house.a.02 --runtime world-art/hd-iso-v1/runtime
