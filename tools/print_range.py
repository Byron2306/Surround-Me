from pathlib import Path
p=Path('game.js')
lines=p.read_text(encoding='utf-8').splitlines()
start=14740
end=14904
for i in range(start-1, end):
    print(f"{i+1:6d}: {lines[i]}")
