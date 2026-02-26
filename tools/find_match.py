from pathlib import Path
s=Path('game.js').read_text(encoding='utf-8')
# target position
target_line=10921
target_col=36
# find index in string
line=1; col=0; idx=None
for i,ch in enumerate(s):
    if ch=='\n':
        line+=1; col=0; continue
    col+=1
    if line==target_line and col==target_col:
        idx=i; break
if idx is None:
    print('Target not found'); raise SystemExit(1)
# verify char
print('char at target:', repr(s[idx]))
# now scan forward ignoring comments/strings to find matching brace
pairs={'{':'}','(':')','[':']'}
openers=set(pairs.keys()); closers=set(pairs.values())
stack=[]
state='normal'; quote=None
line=1; col=0
for i,ch in enumerate(s):
    if ch=='\n':
        line+=1; col=0
        if state=='line_comment': state='normal'
        continue
    col+=1
    if state=='normal':
        if ch=='/' and i+1<len(s) and s[i+1]=='/': state='line_comment'; continue
        if ch=='/' and i+1<len(s) and s[i+1]=='*': state='block_comment'; continue
        if ch in ('"',"'","`"): state='string'; quote=ch; continue
        if ch in openers:
            stack.append((ch,i,line,col))
            if i==idx:
                print('found target opener on stack at stack depth', len(stack))
        elif ch in closers:
            if not stack:
                print('extra closing',ch,'at',line,col); break
            o,oi,ol,oc=stack.pop()
            if pairs[o]!=ch:
                print('mismatch',o,'opened at',ol,oc,'closed by',ch,'at',line,col); break
            if oi==idx:
                print('matching closer is',ch,'at',line,col)
                break
    elif state=='block_comment':
        if ch=='*' and i+1<len(s) and s[i+1]=='/': state='normal';
    elif state=='string':
        if ch=='\\':
            # skip escaped char
            continue
        if ch==quote: state='normal'

print('done')
