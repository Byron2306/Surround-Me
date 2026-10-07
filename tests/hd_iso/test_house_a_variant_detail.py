from tools.hd_iso.variants import compile_variant
from tools.hd_iso.compile_geometry import manifest_dict
from tools.hd_iso.detail.house_a import compile_house_a_detail
from tools.hd_iso.detail.validation import validate_house_a_detail

def test_no_porch():
    g=manifest_dict(compile_variant('house.a.02')[0])
    d=compile_house_a_detail(g,17)
    assert d['porch'] is None
    assert validate_house_a_detail(g,d).status == 'PASS'
    d['porch']={'facade':'FRONT','style':'OPEN_FRAME','boundsM':[1,1,1]}
    assert validate_house_a_detail(g,d).status == 'REFUSE'

def test_appearance_seed_domains_preserve_geometry():
    from tools.hd_iso.surface.house_a import compile_house_a_surface
    from tools.hd_iso.surface_fidelity.house_a import compile_house_a_surface_fidelity
    from tools.hd_iso.compile_geometry import canonical_geometry_json
    import json
    m=compile_variant('house.a.02')[0];g=manifest_dict(m);before=canonical_geometry_json(m)
    for seed in (1,18428):
        d=compile_house_a_detail(g,seed)
        s=compile_house_a_surface(g,d,seed,seed+1)
        f=compile_house_a_surface_fidelity(g,d,s,seed+2)
        assert d['variantId']==s['variantId']==f['variantId']=='house.a.02'
        assert d['porch'] is None
    assert canonical_geometry_json(m)==before
