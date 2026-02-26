from pathlib import Path
lines=Path('game.js').read_text(encoding='utf-8').splitlines()
for i in range(8735,8745):
    print(i+1, lines[i])
