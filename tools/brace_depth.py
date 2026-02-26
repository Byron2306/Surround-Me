from pathlib import Path
s=Path('game.js').read_text(encoding='utf-8')
line=1; col=0; state='normal'; quote=None
depth=0
start_line=10921
outputs=[]
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
            if line>=start_line:
                outputs.append((line, col, '{', depth))
        elif ch=='}':
            if line>=start_line:
                outputs.append((line, col, '}', depth))
            depth-=1
    elif state=='block_comment':
        if ch=='*' and i+1<len(s) and s[i+1]=='/': state='normal'
    elif state=='string':
        if ch=='\\': i+=1; continue
        if ch==quote: state='normal'

# print summary: maximum depth and final depth
print('Final depth:', depth)
print('Last 40 depth-changing events after line', start_line)
for e in outputs[-40:]:
    print(e)
