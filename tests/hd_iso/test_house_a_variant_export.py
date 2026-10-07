from tools.hd_iso.variant_export import verify_variant_export, install_variant

def test_missing_refuses(tmp_path):
    assert verify_variant_export(*([tmp_path/'missing']*5))['status']=='REFUSE'
    runtime=tmp_path/'runtime'; runtime.mkdir()
    old=runtime/'house.a.02.png'; old.write_bytes(b'accepted')
    assert install_variant(tmp_path/'receipt',tmp_path/'png',runtime)['status']=='REFUSE'
    assert old.read_bytes()==b'accepted'

import json
import pytest
from PIL import Image, ImageDraw
from tools.hd_iso.variants import compile_variant
from tools.hd_iso.compile_geometry import manifest_dict
from tools.hd_iso.proof.verify_projection import canonical_camera_matrix
from tools.hd_iso.geometry.projection import project_ground

def fixture(tmp_path):
    m,_,contract=compile_variant('house.a.02')
    def pixel(x,y):
        a,b=project_ground(x,y);return [256+a,256+b]
    scene={'variantId':'house.a.02','cameraHash':'sha256:'+'a'*64,'cameraMatrix':canonical_camera_matrix(),'projectionAdapter':'mirror_x','render':{'width':2048,'height':2048,'logicalWidth':512,'logicalHeight':512,'renderScale':4,'transparent':True},'anchor':{'worldM':[3,6,0],'pixel':pixel(3,6)},'footprintPixel':[pixel(x,y) for x,y in ((0,0),(6,0),(6,6),(0,6))]}
    mask=Image.new('RGBA',(2048,2048));ImageDraw.Draw(mask).rectangle((500,500,1000,1000),fill='white')
    mask.save(tmp_path/'silhouette.png')
    Image.new('RGBA',(2048,2048)).save(tmp_path/'porch.png')
    from PIL import ImageOps
    ImageOps.mirror(mask).save(tmp_path/'final.png')
    masks={'cameraHash':scene['cameraHash'],'projectionAdapter':'mirror_x','width':2048,'height':2048,'logicalWidth':512,'logicalHeight':512,'renderScale':4,'regions':{'silhouette':{'file':'silhouette.png','pixelCount':501**2,'objects':['walls']},'porch':{'file':'porch.png','pixelCount':0,'objects':[]}}}
    from tools.hd_iso.detail.house_a import compile_house_a_detail
    from tools.hd_iso.surface.house_a import compile_house_a_surface,source_detail_sha256,source_geometry_sha256
    from tools.hd_iso.surface_fidelity.house_a import compile_house_a_surface_fidelity,source_surface_sha256
    geometry=manifest_dict(m)
    detail=compile_house_a_detail(geometry,17)
    surface=compile_house_a_surface(geometry,detail,18,19)
    fidelity=compile_house_a_surface_fidelity(geometry,detail,surface,20)
    for filename,payload in [('detail.json',detail),('surface.json',surface),('surface-fidelity.json',fidelity)]:
        (tmp_path/filename).write_text(json.dumps(payload))
    scene['detail']={'sourceGeometrySha256':source_geometry_sha256(geometry),'detailSeed':17,'objectCounts':{'porch':0,'windows':1}}
    scene['surface']={'sourceGeometrySha256':source_geometry_sha256(geometry),'sourceDetailSha256':source_detail_sha256(detail),'appearanceSeed':18,'decaySeed':19}
    scene['surfaceFidelity']={'sourceGeometrySha256':source_geometry_sha256(geometry),'sourceDetailSha256':source_detail_sha256(detail),'sourceSurfaceSha256':source_surface_sha256(surface),'fidelitySeed':20}
    from tools.hd_iso.blender.variant_finish import PROFILE,profile_hash,implementation_hash
    scene['variantFinish']={'profile':PROFILE,'profileSha256':profile_hash(),'implementationSha256':implementation_hash(),'structuralRoofVisible':False}
    scene['renderContract']={'status':'PASS','cameraHash':scene['cameraHash']}
    masks['variantId']='house.a.02'
    for region in ('walls','roof','door','windows','fascia','gutter','downpipe'):
        masks['regions'][region]={'file':'silhouette.png','pixelCount':501**2,'objects':[region]}
    paths=[]
    for name,payload in [('contract',contract),('geometry',manifest_dict(m)),('scene',scene),('masks',masks)]:
        p=tmp_path/(name+'.json');p.write_text(json.dumps(payload));paths.append(p)
    return [*paths,tmp_path/'final.png']

def test_good_export_and_tamper(tmp_path):
    paths=fixture(tmp_path);result=verify_variant_export(*paths)
    assert result['status']=='PASS',result
    receipt=tmp_path/'receipt.json';receipt.write_text(json.dumps(result))
    assert install_variant(receipt,paths[-1],tmp_path/'runtime')['status']=='PASS'
    paths[1].write_text('{}')
    assert install_variant(receipt,paths[-1],tmp_path/'runtime')['status']=='REFUSE'

@pytest.mark.parametrize('mode,size,fill',[('RGB',(2048,2048),'black'),('RGBA',(512,512),'white'),('RGBA',(2048,2048),(0,0,0,255)),('RGBA',(2048,2048),(0,0,0,0))])
def test_invalid_png(tmp_path,mode,size,fill):
    paths=fixture(tmp_path);Image.new(mode,size,fill).save(paths[-1])
    assert verify_variant_export(*paths)['status']=='REFUSE'

def test_stale_scene_and_missing_region(tmp_path):
    paths=fixture(tmp_path)
    scene=json.loads(paths[2].read_text());scene['detail']['sourceGeometrySha256']='stale';paths[2].write_text(json.dumps(scene))
    assert verify_variant_export(*paths)['status']=='REFUSE'
    paths=fixture(tmp_path);masks=json.loads(paths[3].read_text());del masks['regions']['door'];paths[3].write_text(json.dumps(masks))
    assert verify_variant_export(*paths)['status']=='REFUSE'

def test_failed_pointer_switch_preserves_old(tmp_path,monkeypatch):
    paths=fixture(tmp_path);result=verify_variant_export(*paths)
    receipt=tmp_path/'receipt.json';receipt.write_text(json.dumps(result))
    runtime=tmp_path/'runtime';assert install_variant(receipt,paths[-1],runtime)['status']=='PASS'
    old=(runtime/'house.a.02.json').read_bytes()
    import os
    replace=os.replace
    def fail_metadata(src,dst):
        if str(dst).endswith('house.a.02.json'): raise OSError('injected switch failure')
        replace(src,dst)
    monkeypatch.setattr(os,'replace',fail_metadata)
    assert install_variant(receipt,paths[-1],runtime)['status']=='REFUSE'
    assert (runtime/'house.a.02.json').read_bytes()==old
    previous=json.loads(old);assert (runtime/previous['receipt']).exists()

def test_antialias_edge_difference_allowed(tmp_path):
    paths=fixture(tmp_path)
    with Image.open(paths[-1]) as im:
        im.putpixel((1047,500),(255,255,255,64))
        im.save(paths[-1])
    assert verify_variant_export(*paths)['status']=='PASS'

@pytest.mark.parametrize('point',[(10,10),(1200,700)])
def test_outside_pixel_or_interior_hole_refused(tmp_path,point):
    paths=fixture(tmp_path)
    with Image.open(paths[-1]) as im:
        im.putpixel(point,(0,0,0,255 if point==(10,10) else 0));im.save(paths[-1])
    assert verify_variant_export(*paths)['status']=='REFUSE'

@pytest.mark.parametrize('x,expected',[(1045,'PASS'),(1044,'REFUSE')])
def test_measured_two_pixel_filter_boundary(tmp_path,x,expected):
    paths=fixture(tmp_path)
    with Image.open(paths[-1]) as im:
        im.putpixel((x,700),(255,255,255,8));im.save(paths[-1])
    assert verify_variant_export(*paths)['status']==expected

def test_tampered_finish_refused(tmp_path):
    paths=fixture(tmp_path)
    scene=json.loads(paths[2].read_text());scene['variantFinish']={'profileSha256':'stale','structuralRoofVisible':True};paths[2].write_text(json.dumps(scene))
    assert verify_variant_export(*paths)['status']=='REFUSE'

def test_stale_finish_implementation_refused(tmp_path):
    paths=fixture(tmp_path)
    scene=json.loads(paths[2].read_text());scene['variantFinish']['implementationSha256']='sha256:'+'0'*64;paths[2].write_text(json.dumps(scene))
    assert verify_variant_export(*paths)['status']=='REFUSE'
