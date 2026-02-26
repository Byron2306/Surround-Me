from pathlib import Path
s=Path('game.js').read_text(encoding='utf-8')
target_line=10921
line=1; col=0; state='normal'; quote=None
depth=0
for i,ch in enumerate(s):
    if ch=='\n':
        line+=1; col=0
        if state=='line_comment': state='normal'
        continue
    col+=1
    if state=='normal':
        if ch=='/' and i+1<len(s) and s[i+1]=='/': state='line_comment'; continue
        if ch=='/' and i+1<len(s) and s[i+1]=='*': state='block_comment'; continue
        if ch in ('"','\'','`'): state='string'; quote=ch; continue
        if ch=='{':
            depth+=1
            if line>=target_line:
                print(f"{line}:{col} {{ depth={depth}")
        elif ch=='}':
            if line>=target_line:
                print(f"{line}:{col} }} depth(before)={depth}")
            depth-=1
            if depth==0 and line>target_line:
                print(f"function closing brace should be at closing }} on line {line}")
                break
    elif state=='block_comment':
        if ch=='*' and i+1<len(s) and s[i+1]=='/': state='normal';
    elif state=='string':
        if ch=='\\': i+=1; continue
        if ch==quote: state='normal'
