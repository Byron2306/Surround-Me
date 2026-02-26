from pathlib import Path
s=Path('game.js').read_text(encoding='utf-8')
line=1; state='normal'; depth=0; quote=None
closure_line=None
for i,ch in enumerate(s):
    if ch=='\n':
        if depth==0 and line>10921:
            closure_line=line
            break
        line+=1; state='normal' if state=='line_comment' else state; continue
    if state=='normal':
        if ch=='/' and i+1<len(s) and s[i+1]=='/': state='line_comment'; continue
        if ch=='/' and i+1<len(s) and s[i+1]=='*': state='block_comment'; continue
        if ch in ('"','\'','`'): state='string'; quote=ch; continue
        if ch=='{': depth+=1
        elif ch=='}': depth-=1
    elif state=='block_comment':
        if ch=='*' and i+1<len(s) and s[i+1]=='/': state='normal'
    elif state=='string':
        if ch=='\\': i+=1; continue
        if ch==quote: state='normal'

print('closure_line=', closure_line)
