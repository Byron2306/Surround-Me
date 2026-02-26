from pathlib import Path
text = Path('game.js').read_text(encoding='utf-8')
# replace the two occurrences of alpha formula within renderAtmosphericFog
import re
pattern = re.compile(r"(const screenR = fog\.size[\s\S]*?pulse\s*=\s*[\s\S]*?\n\s*// stronger alpha[\s\S]*?const alpha = )Math\.max\(0\.06,[\s\S]*?\);", re.MULTILINE)
# we replace both with new simpler formula
new_text, count = pattern.subn(r"\1Math.max(0.03, ((fog.opacity * 1.5) + pulse) * vis * 0.7);", text)
if count>0:
    Path('game.js').write_text(new_text, encoding='utf-8')
    print('Replaced',count,'alpha occurrences')
else:
    print('No replacements made')
