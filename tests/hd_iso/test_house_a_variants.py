import pytest
from tools.hd_iso.variants import compile_variant
from tools.hd_iso.compile_geometry import canonical_geometry_json

def test_pilot():
    m, template, contract = compile_variant('house.a.02')
    assert m.variant_id == 'house.a.02'
    assert (m.house.width_m, m.house.depth_m) == (6., 6.)
    assert m.house.attachments == ()
    assert canonical_geometry_json(m) == canonical_geometry_json(compile_variant('house.a.02')[0])

def test_unknown():
    with pytest.raises(ValueError):
        compile_variant('missing')

import json
import shutil
from pathlib import Path
from tools.hd_iso.cli import main
from tools.hd_iso.compile_geometry import compile_template, geometry_sha256

def test_exact_contract_and_master():
    m,t,c=compile_variant('house.a.02')
    assert m.structural_seed==18428
    assert m.house.wall_height_m==2.6856203614167002
    assert m.house.roof_pitch_degrees==33.59802181853683
    assert m.house.eave_overhang_m==0.3547842106675055
    assert m.house.door.lateral_position==.32
    assert m.house.windows[0].lateral_position==.72
    assert geometry_sha256(m)!=geometry_sha256(compile_template('house.master.a',18427))

@pytest.mark.parametrize('field,value',[('structuralSeed',True),('wallHeightM',float('nan')),('windowPosition',.32),('extra',1),('roofPitchDegrees',90)])
def test_bad_contract(tmp_path,field,value):
    root=Path(__file__).resolve().parents[2]
    directory=tmp_path/'world-art/hd-iso-v1/templates';directory.mkdir(parents=True)
    for name in ('house-master-a.json','house-a-variants-v1.json'):
        shutil.copy(root/'world-art/hd-iso-v1/templates'/name,directory/name)
    path=directory/'house-a-variants-v1.json';catalog=json.loads(path.read_text())
    catalog['variants']['house.a.02'][field]=value;path.write_text(json.dumps(catalog))
    with pytest.raises(ValueError): compile_variant('house.a.02',tmp_path)

def test_conflicting_seed(tmp_path):
    assert main(['compile','house.master.a','--variant','house.a.02','--seed','18427','--out',str(tmp_path/'g.json')])==2
    assert not (tmp_path/'g.json').exists()
