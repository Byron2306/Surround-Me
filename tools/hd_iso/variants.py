"""Strict structural contracts; legacy master sampling is deliberately separate."""
from pathlib import Path
import copy
import json
import math
from .geometry.model import GeometryManifest, HouseGeometry, OpeningSocket
from .geometry.validation import validate_house_a

FIELDS = {'familyId','structuralSeed','footprintM','maxHeightM','storeys','anchor','wallHeightM','roofPitchDegrees','eaveOverhangM','ridgeAxis','doorPosition','windowPosition','windowWidthM','windowHeightM','windowSillM','attachments'}

def compile_variant(variant_id: str, root: Path | None = None):
    root = Path(root) if root is not None else Path(__file__).resolve().parents[2]
    catalog = json.loads((root/'world-art/hd-iso-v1/templates/house-a-variants-v1.json').read_text())
    if set(catalog) != {'schema','variants'} or catalog['schema'] != 'house-a-variants-v1':
        raise ValueError('invalid variant catalog')
    if variant_id != 'house.a.02' or variant_id not in catalog['variants']:
        raise ValueError('unknown variant')
    c = copy.deepcopy(catalog['variants'][variant_id])
    if set(c) != FIELDS:
        raise ValueError('unexpected contract fields')
    if c['familyId'] != 'house.master.a' or type(c['structuralSeed']) is not int or not 0 <= c['structuralSeed'] <= 2**32-1:
        raise ValueError('invalid family or seed')
    def finite(v):
        return type(v) in (int,float) and math.isfinite(v)
    numbers = ['maxHeightM','wallHeightM','roofPitchDegrees','eaveOverhangM','doorPosition','windowPosition','windowWidthM','windowHeightM','windowSillM']
    if any(not finite(c[k]) or c[k] <= 0 for k in numbers):
        raise ValueError('invalid dimension')
    if any(not isinstance(c[k], list) or len(c[k]) != 2 or any(not finite(v) for v in c[k]) for k in ('footprintM','anchor')):
        raise ValueError('invalid footprint or anchor')
    if type(c['storeys']) is not int:
        raise ValueError('invalid storeys')
    if not (.8 <= c['windowWidthM'] <= 1.5 and 1.1 <= c['windowHeightM'] <= 1.4 and .85 <= c['windowSillM'] <= 1.05):
        raise ValueError('invalid window dimensions')
    if c['footprintM'] != [6.,6.] or c['anchor'] != [.5,1.] or c['storeys'] != 1 or c['ridgeAxis'] != 'X' or c['attachments'] != []:
        raise ValueError('invalid pilot structure')
    template=json.loads((root/'world-art/hd-iso-v1/templates/house-master-a.json').read_text())
    template.update(footprintM=c['footprintM'],footprintTiles=[3.,3.],attachments={})
    door=OpeningSocket('front-door','FRONT',.9,2.,0.,c['doorPosition'])
    window=OpeningSocket('front-window-1','FRONT',c['windowWidthM'],c['windowHeightM'],c['windowSillM'],c['windowPosition'])
    h=HouseGeometry('house.master.a',6.,6.,c['maxHeightM'],(.5,1.),'FRONT',c['wallHeightM'],c['roofPitchDegrees'],'X',c['eaveOverhangM'],door,(window,),(),3.*math.tan(math.radians(c['roofPitchDegrees'])))
    m=GeometryManifest('hd-iso-geometry-v1','house.master.a',c['structuralSeed'],h,variant_id)
    result=validate_house_a(m,template)
    if result.status != 'PASS' or window.sill_height_m+window.height_m > h.wall_height_m:
        raise ValueError('invalid variant geometry: '+','.join(result.reasons))
    return m,template,{'schema':'house-a-variants-v1','variantId':variant_id,**c}
