from pathlib import Path
s=Path('game.js').read_text(encoding='utf-8')
line=1; col=0; state='normal'; quote=None
depth=0
# compute depth per line
depth_by_line={}
for i,ch in enumerate(s):
    if ch=='\n':
        depth_by_line[line]=depth
        line+=1; col=0
        if state=='line_comment': state='normal'
        continue
    col+=1
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

# find depth before target line
target_line=10921
depth_before = depth_by_line.get(target_line-1)
print('depth before target line', target_line, 'is', depth_before)
# find first line after target where depth==depth_before
for L in range(target_line, max(depth_by_line.keys())+1):
    d = depth_by_line.get(L)
    if d==depth_before:
        print('first line where depth returns to before-target at',L)
        break
else:
    print('no line found where depth returns to before-target')
