"""Compile a deterministic bottom-contact 2:1 diamond from asphalt material."""
import argparse
from pathlib import Path
from PIL import Image, ImageDraw

def compile_intersection(material, size=2048):
    if size < 8 or size % 4: raise ValueError('size must be a multiple of four >= 8')
    with Image.open(material) as source:
        texture = source.convert('RGB').resize((size, size//2), Image.Resampling.LANCZOS)
    image = Image.new('RGBA', (size,size))
    image.paste(texture, (0,size//2))
    draw = ImageDraw.Draw(image)
    def point(u,v):
        return (round(size/2+(u-v)*size/4), round(size*.75+(u+v)*size/8))
    for axis in (0,1):
        for side in (-1,1):
            a, b = ((side,0),(side*.28,0)) if axis == 0 else ((0,side),(0,side*.28))
            draw.line((point(*a),point(*b)), fill=(188,177,102,255), width=max(1,size//256))
    mask = Image.new('L', image.size)
    ImageDraw.Draw(mask).polygon([(size//2,size//2),(size-1,3*size//4),(size//2,size-1),(0,3*size//4)], fill=255)
    image.putalpha(mask)
    return image

if __name__ == '__main__':
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument('--material', required=True, type=Path)
    p.add_argument('--output', required=True, type=Path)
    a = p.parse_args()
    if a.output.exists(): p.exit(1, 'REFUSE: output already exists\n')
    a.output.parent.mkdir(parents=True, exist_ok=True)
    compile_intersection(a.material).save(a.output, 'PNG')
