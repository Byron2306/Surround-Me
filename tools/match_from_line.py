from pathlib import Path
s=Path('game.js').read_text(encoding='utf-8')
target_line=10921
line=1; col=0; state='normal'; quote=None
start_index=None
for i,ch in enumerate(s):
    if ch=='\n':
        line+=1; col=0
        if state=='line_comment': state='normal'
        continue
    col+=1
    if line==target_line and start_index is None and ch=='{':
        start_index=i
        break
if start_index is None:
    print('did not find opening brace on target line'); sys.exit(1)
# now scan from start_index inclusive
depth=0
line=target_line;col=0
for i in range(start_index, len(s)):
    ch=s[i]
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
        elif ch=='}':
            depth-=1
            if depth==0:
                print('matching closing brace at line',line,'col',col)
                break
    elif state=='block_comment':
        if ch=='*' and i+1<len(s) and s[i+1]=='/': state='normal'
    elif state=='string':
        if ch=='\\':
            i+=1; continue
        if ch==quote: state='normal'
