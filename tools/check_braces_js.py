import sys
from pathlib import Path
s=Path('game.js').read_text(encoding='utf-8')
pairs={'{':'}','(':')','[':']'}
openers=set(pairs.keys())
closers=set(pairs.values())
stack=[]
line=1
col=0
i=0
n=len(s)
state='normal'
quote_char=None
while i<n:
    ch=s[i]
    if ch=='\n':
        line+=1; col=0
        if state=='line_comment': state='normal'
        i+=1; continue
    col+=1
    # handle entering/exiting comments and strings
    if state=='normal':
        if ch=='/' and i+1<n and s[i+1]=='/':
            state='line_comment'; i+=2; col+=1; continue
        if ch=='/' and i+1<n and s[i+1]=='*':
            state='block_comment'; i+=2; col+=1; continue
        if ch in ('"', "'", '`'):
            state='string'; quote_char=ch; i+=1; continue
        if ch in openers:
            stack.append((ch,line,col))
        elif ch in closers:
            if not stack:
                print(f"Extra closing {ch} at {line}:{col}"); sys.exit(0)
            o,ol,oc=stack.pop()
            if pairs[o]!=ch:
                print(f"Mismatch: opened {o} at {ol}:{oc} but closed by {ch} at {line}:{col}")
                sys.exit(0)
    elif state=='block_comment':
        if ch=='*' and i+1<n and s[i+1]=='/':
            state='normal'; i+=2; col+=1; continue
    elif state=='string':
        if ch=='\\':
            i+=2; col+=1; continue
        if ch==quote_char:
            state='normal'; quote_char=None
    i+=1

if stack:
    o,ol,oc=stack[-1]
    print(f"Unclosed {o} opened at {ol}:{oc}")
else:
    print('All balanced')
