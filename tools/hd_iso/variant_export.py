"""Bind a governed variant export to exact source and PNG bytes.

Receipts are verification records, not human visual acceptance.
"""
import argparse
import hashlib
import json
import os
import tempfile
from pathlib import Path
from PIL import Image, ImageChops, ImageOps, ImageFilter
from .variants import compile_variant
from .compile_geometry import manifest_dict
from .detail.house_a import source_geometry_sha256
from .detail.validation import validate_house_a_detail
from .surface.validation import validate_house_a_surface
from .surface_fidelity.validation import validate_house_a_surface_fidelity
from .surface.house_a import source_detail_sha256
from .surface_fidelity.house_a import source_surface_sha256
from .proof.verify_projection import build_projection_proof

def digest(path):
    return 'sha256:'+hashlib.sha256(Path(path).read_bytes()).hexdigest()

def verify_variant_export(contract_path, geometry_path, scene_path, masks_path, png_path):
    paths=dict(zip(('contract','geometry','scene','masks','png'),map(Path,(contract_path,geometry_path,scene_path,masks_path,png_path))))
    try:
        contract,geometry,scene,masks=(json.loads(paths[k].read_text()) for k in ('contract','geometry','scene','masks'))
        m,_,expected=compile_variant(contract['variantId'])
        if contract != expected or geometry != manifest_dict(m) or scene.get('variantId') != m.variant_id:
            raise ValueError('variant_contract_mismatch')
        if build_projection_proof(geometry,scene)['status'] != 'PASS':
            raise ValueError('projection_refused')
        from .blender.variant_finish import PROFILE,profile_hash,implementation_hash
        finish=scene.get('variantFinish',{})
        if finish.get('profile') != PROFILE or finish.get('profileSha256') != profile_hash() or finish.get('implementationSha256') != implementation_hash() or finish.get('structuralRoofVisible') is not False:
            raise ValueError('variant_finish_contract_mismatch')
        build_root=paths['geometry'].parent
        downstream={k:build_root/f for k,f in [('detail','detail.json'),('surface','surface.json'),('fidelity','surface-fidelity.json')]}
        detail,surface,fidelity=(json.loads(downstream[k].read_text()) for k in ('detail','surface','fidelity'))
        validations=(validate_house_a_detail(geometry,detail),validate_house_a_surface(geometry,detail,surface),validate_house_a_surface_fidelity(geometry,detail,surface,fidelity))
        if any(v.status != 'PASS' for v in validations):
            raise ValueError('downstream_manifest_refused')
        geometry_hash=source_geometry_sha256(geometry)
        for key in ('detail','surface','surfaceFidelity'):
            if scene[key]['sourceGeometrySha256'] != geometry_hash:
                raise ValueError('stale_scene_geometry')
        if scene['detail']['objectCounts']['porch'] != 0 or scene['detail']['objectCounts']['windows'] != 1:
            raise ValueError('scene_object_counts_mismatch')
        if scene['detail']['detailSeed'] != detail['detailSeed'] or scene['surface']['appearanceSeed'] != surface['appearanceSeed'] or scene['surface']['decaySeed'] != surface['decaySeed'] or scene['surfaceFidelity']['fidelitySeed'] != fidelity['fidelitySeed']:
            raise ValueError('scene_seed_mismatch')
        for key in ('surface','surfaceFidelity'):
            if scene[key]['sourceDetailSha256'] != source_detail_sha256(detail):
                raise ValueError('stale_scene_detail')
        if scene['surfaceFidelity']['sourceSurfaceSha256'] != source_surface_sha256(surface):
            raise ValueError('stale_scene_surface')
        required={'silhouette','walls','roof','door','windows','porch','fascia','gutter','downpipe'}
        if set(masks['regions']) != required or masks.get('variantId') != m.variant_id:
            raise ValueError('required_mask_regions_missing')
        if any(masks['regions'][k]['pixelCount'] <= 0 for k in required-{'porch'}):
            raise ValueError('required_mask_empty')
        if scene['renderContract']['status'] != 'PASS' or scene['renderContract']['cameraHash'] != scene['cameraHash']:
            raise ValueError('render_contract_refused')
        render=scene['render']
        if [render[k] for k in ('width','height','logicalWidth','logicalHeight','renderScale')] != [2048,2048,512,512,4] or render.get('transparent') is not True:
            raise ValueError('render_contract_mismatch')
        if masks.get('cameraHash') != scene.get('cameraHash') or masks.get('projectionAdapter') != 'mirror_x' or [masks.get(k) for k in ('width','height','logicalWidth','logicalHeight','renderScale')] != [2048,2048,512,512,4]:
            raise ValueError('mask_contract_mismatch')
        if masks['regions']['porch']['pixelCount'] != 0 or masks['regions']['porch']['objects'] != []:
            raise ValueError('unexpected_porch_mask')
        mask_paths={}
        for region,entry in masks['regions'].items():
            filename=entry['file']
            if Path(filename).name != filename:
                raise ValueError('invalid_mask_path')
            p=paths['masks'].parent/filename
            mask_paths[region]=p
            with Image.open(p) as img:
                if img.size != (2048,2048) or img.mode != 'RGBA':
                    raise ValueError('mask_format_mismatch')
                count=sum(img.getchannel('A').histogram()[128:])
                if count != entry['pixelCount']:
                    raise ValueError('mask_count_mismatch')
        with Image.open(paths['png']) as img, Image.open(mask_paths['silhouette']) as mask:
            if img.mode != 'RGBA' or img.size != (2048,2048):
                raise ValueError('png_format_mismatch')
            alpha=img.getchannel('A')
            silhouette=ImageOps.mirror(mask.getchannel('A'))
            # Beauty uses canonical multisampling; diagnostic masks use one
            # sample. Edge coverage is therefore not byte-identical. Permit
            # differences only within two physical pixels of the mask boundary.
            # Never recolour or rewrite the final appearance alpha.
            support=silhouette.point(lambda value: 255 if value else 0)
            boundary=ImageChops.subtract(support.filter(ImageFilter.MaxFilter(5)),support.filter(ImageFilter.MinFilter(5)))
            difference=ImageChops.difference(alpha,silhouette)
            forbidden=ImageChops.multiply(difference,ImageChops.invert(boundary))
            if alpha.getbbox() is None or forbidden.getbbox() is not None:
                raise ValueError('silhouette_alpha_mismatch')
            if alpha.getextrema() != (0,255):
                raise ValueError('opaque_or_empty_exterior')
        h=m.house
        metadata={'schema':'house-variant-runtime-v1','variantId':m.variant_id,'familyId':m.template_id,'physicalWidth':2048,'physicalHeight':2048,'logicalWidth':512,'logicalHeight':512,'anchorPixelX':scene['anchor']['pixel'][0],'anchorPixelY':scene['anchor']['pixel'][1],'collisionBounds':{'minX':-h.width_m/4,'maxX':h.width_m/4,'minY':-h.depth_m/2,'maxY':0},'doorApproach':{'x':(h.door.lateral_position-.5)*h.width_m/2,'y':.5},'pngSha256':digest(paths['png'])}
        sources={k:str(p.resolve()) for k,p in paths.items()}
        hashes={k:digest(p) for k,p in {**paths,**downstream}.items()}
        mask_hashes={k:digest(p) for k,p in mask_paths.items()}
        return {'schema':'house-variant-export-v1','status':'PASS','reasons':[],'variantId':m.variant_id,'sources':sources,'hashes':hashes,'maskHashes':mask_hashes,'metadata':metadata,'humanReview':'PENDING'}
    except (OSError,ValueError,KeyError,TypeError) as exc:
        return {'status':'REFUSE','reasons':[str(exc)]}

def install_variant(receipt_path, png_path, runtime_dir):
    try:
        receipt=json.loads(Path(receipt_path).read_text())
        if receipt.get('status') != 'PASS':
            raise ValueError('receipt_refused')
        sources=receipt['sources']
        fresh=verify_variant_export(*(sources[k] for k in ('contract','geometry','scene','masks')),png_path)
        if fresh['status'] != 'PASS' or any(fresh.get(k) != receipt.get(k) for k in ('schema','variantId','hashes','maskHashes','metadata')):
            raise ValueError('stale_receipt')
        runtime=Path(runtime_dir);runtime.mkdir(parents=True,exist_ok=True)
        # Content-addressed PNG prevents a metadata switch from exposing old bytes.
        name='house.a.02-'+receipt['hashes']['png'].split(':')[1]+'.png'
        receipt_name='house.a.02-'+hashlib.sha256(json.dumps(receipt,sort_keys=True).encode()).hexdigest()+'.receipt.json'
        payloads={name:Path(png_path).read_bytes(),receipt_name:(json.dumps(receipt,sort_keys=True)+'\n').encode(),'house.a.02.json':(json.dumps({**receipt['metadata'],'asset':name,'receipt':receipt_name},sort_keys=True)+'\n').encode()}
        for filename,data in payloads.items():
            fd,tmp=tempfile.mkstemp(dir=runtime)
            try:
                with os.fdopen(fd,'wb') as f: f.write(data)
                os.replace(tmp,runtime/filename)
            finally:
                if os.path.exists(tmp): os.unlink(tmp)
        return {'status':'PASS','metadata':str(runtime/'house.a.02.json'),'humanReview':'PENDING'}
    except (OSError,ValueError,KeyError,TypeError) as exc:
        return {'status':'REFUSE','reasons':[str(exc)]}

def main():
    p=argparse.ArgumentParser();p.add_argument('build_dir',type=Path);p.add_argument('--runtime',type=Path,required=True);a=p.parse_args()
    out=a.build_dir; png=out/'final.png'
    with Image.open(out/'render/beauty.png') as image:
        ImageOps.mirror(image).save(png)
    result=verify_variant_export(out/'variant-contract.json',out/'geometry.json',out/'render/scene-manifest.json',out/'render/masks/manifest.json',png)
    receipt=out/'export-receipt.json';receipt.write_text(json.dumps(result,indent=2)+'\n')
    if result['status']=='PASS': result=install_variant(receipt,png,a.runtime)
    print(json.dumps(result));return 0 if result['status']=='PASS' else 2

if __name__=='__main__': raise SystemExit(main())
