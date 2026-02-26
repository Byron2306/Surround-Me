import sys
from pathlib import Path
p=Path('game.js')
s=p.read_text(encoding='utf-8')
pairs={'{':'}','(':')','[':']'}
openers=set(pairs.keys())
closers=set(pairs.values())
stack=[]
line=1
col=0
for i,ch in enumerate(s):
    if ch=='\n':
        line+=1; col=0; continue
    col+=1
    if ch in openers:
        stack.append((ch,line,col))
    elif ch in closers:
        if not stack:
            print(f"Extra closing {ch} at line {line} col {col}")
            sys.exit(0)
        o,ol,oc = stack.pop()
        if pairs[o]!=ch:
            print(f"Mismatch: opened {o} at {ol}:{oc} but closed by {ch} at {line}:{col}")
            sys.exit(0)
if stack:
    o,ol,oc=stack[-1]
    print(f"Unclosed {o} opened at {ol}:{oc}")
else:
    print('All balanced')
