from pathlib import Path
lines=Path('game.js').read_text(encoding='utf-8').splitlines()
for idx in range(250,315):
    print(idx+1, lines[idx])
