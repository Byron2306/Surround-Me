#!/usr/bin/env bash
set -euo pipefail

SRC="${1:-/data/data/com.termux/files/home/storage/downloads/house-a-g1-8-governed-2048.png}"
DST="world-art/hd-iso-v1/runtime/house-master-a-g1-8-governed-2048.png"
EXPECTED="0e2fe1df0e1aa1b02fe4854a2276b7b6d324b4d40653f89e794c53cf4a168615"

if [[ ! -f "$SRC" ]]; then
  echo "REFUSE: governed House A source not found: $SRC" >&2
  exit 2
fi

ACTUAL="$(sha256sum "$SRC" | awk '{print $1}')"
if [[ "$ACTUAL" != "$EXPECTED" ]]; then
  echo "REFUSE: governed House A SHA mismatch" >&2
  echo "expected: $EXPECTED" >&2
  echo "actual:   $ACTUAL" >&2
  exit 2
fi

mkdir -p "$(dirname "$DST")"
cp "$SRC" "$DST"

echo "PASS: installed governed House A runtime asset"
echo "$DST"
