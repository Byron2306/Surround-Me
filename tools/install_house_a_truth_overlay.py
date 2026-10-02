#!/usr/bin/env python3
from pathlib import Path

GAME = Path(__file__).resolve().parents[1] / 'game.js'

IMPORT_LINE = "import { HOUSE_A_TRUTH, drawHouseATruthOverlay } from './world-art/hd-iso-v1/house-a-truth-overlay.mjs';\n"

RENDER_MARKER = "    const renderables = [];\n"
RENDER_INSERT = """    const renderables = [];

    // House Master A geometry-truth cage. Diagnostic only: no collision or gameplay authority.
    if (!window.__houseATruthOrigin) {
        window.__houseATruthOrigin = { x: player.x + 3, y: player.y - 3 };
    }
    const houseATruthOrigin = window.__houseATruthOrigin;
    const houseATruthOriginScreen = worldToScreen(houseATruthOrigin.x, houseATruthOrigin.y);
    const houseATruthSort = worldToScreen(
        houseATruthOrigin.x + HOUSE_A_TRUTH.widthWorld * HOUSE_A_TRUTH.anchor[0],
        houseATruthOrigin.y + HOUSE_A_TRUTH.depthWorld * HOUSE_A_TRUTH.anchor[1]
    );
    renderables.push({
        type: 'house_a_truth',
        data: houseATruthOrigin,
        y: houseATruthSort.y,
        pos: houseATruthOriginScreen
    });
"""

SWITCH_MARKER = "            case 'structure': drawStructure(ctx, sx, sy, r.data); break;\n"
SWITCH_INSERT = SWITCH_MARKER + "            case 'house_a_truth': drawHouseATruthOverlay(ctx, sx, sy, worldToScreen); break;\n"


def install(text: str) -> str:
    if IMPORT_LINE not in text:
        text = IMPORT_LINE + text

    if "type: 'house_a_truth'" not in text:
        if RENDER_MARKER not in text:
            raise SystemExit('REFUSE: renderables marker not found; game.js shape changed')
        text = text.replace(RENDER_MARKER, RENDER_INSERT, 1)

    if "case 'house_a_truth'" not in text:
        if SWITCH_MARKER not in text:
            raise SystemExit('REFUSE: render switch marker not found; game.js shape changed')
        text = text.replace(SWITCH_MARKER, SWITCH_INSERT, 1)

    return text


def main() -> None:
    original = GAME.read_text(encoding='utf-8')
    patched = install(original)
    if patched == original:
        print('PASS: House A truth overlay already installed')
        return
    GAME.write_text(patched, encoding='utf-8')
    print(f'PASS: installed House A truth overlay into {GAME}')


if __name__ == '__main__':
    main()
