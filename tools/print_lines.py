from pathlib import Path
lines=Path('game.js').read_text(encoding='utf-8').splitlines()
for idx in range(10990,11010):
    print(f"{idx+1:6d}: {lines[idx]}")
