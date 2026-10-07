"""Run with Blender's Python; ordinary pytest skips an unavailable host."""
import pytest
bpy=pytest.importorskip('bpy')
from tools.hd_iso.variants import compile_variant
from tools.hd_iso.compile_geometry import manifest_dict
from tools.hd_iso.detail.house_a import compile_house_a_detail
from tools.hd_iso.blender.build_scene import build_house_scene

def test_a02_objects():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    geometry=manifest_dict(compile_variant('house.a.02')[0])
    detail=compile_house_a_detail(geometry,18428)
    built=build_house_scene(bpy,geometry,detail)
    assert built['detailObjects']['porch'] is None
    assert bpy.data.objects.get('HouseA.Detail.PorchFrame') is None
    assert len(built['detailObjects']['windows'])==1
    assert built['cameraProof'].status=='PASS'

def test_a02_finish_has_single_visible_roof_and_material_courses():
    from tools.hd_iso.surface.house_a import compile_house_a_surface
    from tools.hd_iso.surface_fidelity.house_a import compile_house_a_surface_fidelity
    from tools.hd_iso.blender.render_passes import _mesh_objects
    bpy.ops.wm.read_factory_settings(use_empty=True)
    geometry=manifest_dict(compile_variant('house.a.02')[0]);detail=compile_house_a_detail(geometry,18428)
    surface=compile_house_a_surface(geometry,detail,18428,18428)
    fidelity=compile_house_a_surface_fidelity(geometry,detail,surface,18428)
    built=build_house_scene(bpy,geometry,detail,surface,fidelity)
    core=built['objects'];roof=built['detailObjects']['roofDetail']
    assert core['roof'].hide_render is True
    assert core['roof'] not in _mesh_objects(bpy.context.scene)
    assert roof in _mesh_objects(bpy.context.scene)
    assert any(n.bl_idname=='ShaderNodeTexBrick' for n in roof.data.materials[0].node_tree.nodes)
    assert roof.data.polygons[2].material_index==1
    assert geometry['house']['attachments']==[]
