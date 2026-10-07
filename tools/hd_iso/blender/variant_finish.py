"""A-02 procedural finish. Changes shading only; no silhouettes or sockets."""
import hashlib
import json
from pathlib import Path

PROFILE = {'id':'house-a02-weathered-v1','roofTileWidthM':0.35,'roofRowHeightM':0.18,'roofMortarM':0.014,'plasterChipScale':9.0,'plasterChipThreshold':0.63,'baseGrimeHeight':0.38,'woodGrainScale':18.0}

def profile_hash():
    return 'sha256:'+hashlib.sha256(json.dumps(PROFILE,sort_keys=True,separators=(',',':')).encode()).hexdigest()

def implementation_hash():
    return 'sha256:'+hashlib.sha256(Path(__file__).read_bytes()).hexdigest()

def _node(mat,kind,label):
    n=mat.node_tree.nodes.new(kind);n.name='HDISO_A02_'+label;n.label=label;return n

def _bsdf(mat):
    return next(n for n in mat.node_tree.nodes if n.bl_idname=='ShaderNodeBsdfPrincipled')

def _ramp(mat,label,low,high,threshold=.5):
    n=_node(mat,'ShaderNodeValToRGB',label)
    n.color_ramp.elements[0].position=max(0.,threshold-.06);n.color_ramp.elements[0].color=(*low,1.)
    n.color_ramp.elements[1].position=min(1.,threshold+.06);n.color_ramp.elements[1].color=(*high,1.)
    return n

def _bump(mat,height,strength,distance,invert=False):
    bsdf=_bsdf(mat);b=_node(mat,'ShaderNodeBump','RELIEF')
    b.invert=invert
    b.inputs['Strength'].default_value=strength;b.inputs['Distance'].default_value=distance
    if bsdf.inputs['Normal'].is_linked:
        mat.node_tree.links.new(bsdf.inputs['Normal'].links[0].from_socket,b.inputs['Normal'])
    mat.node_tree.links.new(height,b.inputs['Height']);mat.node_tree.links.new(b.outputs['Normal'],bsdf.inputs['Normal'])

def _noise(mat,label,scale):
    tex=_node(mat,'ShaderNodeTexCoord',label+'_COORD');n=_node(mat,'ShaderNodeTexNoise',label)
    n.inputs['Scale'].default_value=scale;n.inputs['Detail'].default_value=5.;n.inputs['Roughness'].default_value=.72
    mat.node_tree.links.new(tex.outputs['Generated'],n.inputs['Vector']);return tex,n

def _roof(mat):
    tex=_node(mat,'ShaderNodeTexCoord','TILE_COORD');mapping=_node(mat,'ShaderNodeMapping','TILE_MAPPING')
    mapping.inputs['Scale'].default_value=(6.,6.,1.)
    brick=_node(mat,'ShaderNodeTexBrick','CLAY_TILE_COURSES')
    brick.inputs['Scale'].default_value=1.;brick.inputs['Brick Width'].default_value=PROFILE['roofTileWidthM'];brick.inputs['Row Height'].default_value=PROFILE['roofRowHeightM'];brick.inputs['Mortar Size'].default_value=PROFILE['roofMortarM']
    brick.inputs['Color1'].default_value=(.16,.085,.055,1.);brick.inputs['Color2'].default_value=(.075,.065,.055,1.);brick.inputs['Mortar'].default_value=(.022,.018,.014,1.)
    l=mat.node_tree.links;l.new(tex.outputs['Generated'],mapping.inputs['Vector']);l.new(mapping.outputs['Vector'],brick.inputs['Vector'])
    _,noise=_noise(mat,'MOSS_PATCHES',7.)
    moss=_ramp(mat,'MOSS_TINT',(.12,.095,.055),(.04,.06,.022),.66)
    l.new(noise.outputs['Fac'],moss.inputs['Fac'])
    mix=_node(mat,'ShaderNodeMixRGB','TILE_WEATHERING');mix.blend_type='MULTIPLY';mix.inputs[0].default_value=.28
    l.new(brick.outputs['Color'],mix.inputs[1]);l.new(moss.outputs['Color'],mix.inputs[2]);l.new(mix.outputs['Color'],_bsdf(mat).inputs['Base Color'])
    _bump(mat,brick.outputs['Fac'],.65,.012,invert=True)

def _walls(mat):
    tex,noise=_noise(mat,'PLASTER_CHIPS',PROFILE['plasterChipScale'])
    ramp=_ramp(mat,'EXPOSED_PLASTER',(.29,.255,.20),(.11,.065,.035),PROFILE['plasterChipThreshold'])
    l=mat.node_tree.links;l.new(noise.outputs['Fac'],ramp.inputs['Fac'])
    xyz=_node(mat,'ShaderNodeSeparateXYZ','WALL_HEIGHT');l.new(tex.outputs['Generated'],xyz.inputs[0])
    lower=_node(mat,'ShaderNodeMapRange','BASE_DAMP');lower.clamp=True
    lower.inputs['From Min'].default_value=0.;lower.inputs['From Max'].default_value=PROFILE['baseGrimeHeight'];lower.inputs['To Min'].default_value=.82;lower.inputs['To Max'].default_value=0.
    l.new(xyz.outputs['Z'],lower.inputs['Value'])
    mix=_node(mat,'ShaderNodeMixRGB','PLASTER_BASE_GRIME');mix.blend_type='MULTIPLY';mix.inputs[2].default_value=(.12,.16,.075,1.)
    l.new(lower.outputs['Result'],mix.inputs[0]);l.new(ramp.outputs['Color'],mix.inputs[1]);l.new(mix.outputs['Color'],_bsdf(mat).inputs['Base Color'])
    _bump(mat,noise.outputs['Fac'],.25,.006)

def _wood(mat):
    tex,n=_noise(mat,'WORN_WOOD',PROFILE['woodGrainScale']);mapping=_node(mat,'ShaderNodeMapping','WOOD_GRAIN_DIRECTION')
    mapping.inputs['Scale'].default_value=(3.,3.,.08)
    l=mat.node_tree.links;l.new(tex.outputs['Generated'],mapping.inputs['Vector']);l.new(mapping.outputs['Vector'],n.inputs['Vector'])
    ramp=_ramp(mat,'AGED_WOOD_TINT',(.055,.035,.022),(.22,.19,.14),.5)
    l.new(n.outputs['Fac'],ramp.inputs['Fac']);l.new(ramp.outputs['Color'],_bsdf(mat).inputs['Base Color']);_bump(mat,n.outputs['Fac'],.18,.004)

def _glass_frame(mat):
    tex=_node(mat,'ShaderNodeTexCoord','WINDOW_COORD');xyz=_node(mat,'ShaderNodeSeparateXYZ','WINDOW_XZ');l=mat.node_tree.links;l.new(tex.outputs['Generated'],xyz.inputs[0])
    values=[]
    for axis,operation,threshold in [('X','LESS_THAN',.075),('X','GREATER_THAN',.925),('Z','LESS_THAN',.06),('Z','GREATER_THAN',.94)]:
        n=_node(mat,'ShaderNodeMath','WINDOW_BORDER');n.operation=operation;n.inputs[1].default_value=threshold;l.new(xyz.outputs[axis],n.inputs[0]);values.append(n.outputs[0])
    mid=_node(mat,'ShaderNodeMath','WINDOW_MULLION');mid.operation='SUBTRACT';mid.inputs[1].default_value=.5;l.new(xyz.outputs['X'],mid.inputs[0])
    absolute=_node(mat,'ShaderNodeMath','WINDOW_MULLION_ABS');absolute.operation='ABSOLUTE';l.new(mid.outputs[0],absolute.inputs[0]);bar=_node(mat,'ShaderNodeMath','WINDOW_MULLION_WIDTH');bar.operation='LESS_THAN';bar.inputs[1].default_value=.024;l.new(absolute.outputs[0],bar.inputs[0]);values.append(bar.outputs[0])
    result=values[0]
    for v in values[1:]:
        n=_node(mat,'ShaderNodeMath','WINDOW_FRAME_UNION');n.operation='MAXIMUM';l.new(result,n.inputs[0]);l.new(v,n.inputs[1]);result=n.outputs[0]
    mix=_node(mat,'ShaderNodeMixRGB','WINDOW_GLASS_AND_FRAME');mix.inputs[1].default_value=(.022,.04,.042,1.);mix.inputs[2].default_value=(.25,.225,.18,1.);l.new(result,mix.inputs[0]);l.new(mix.outputs[0],_bsdf(mat).inputs['Base Color'])

def apply_variant_finish(geometry,core,detail):
    if geometry.get('variantId')!='house.a.02': raise ValueError('unsupported variant finish')
    # The detail roof lies on the same planes as the structural prism. Keep
    # that prism for geometric evidence, exclude it from all rendered passes.
    core['roof'].hide_render=True
    roof=detail['roofDetail'];roof_mat=roof.data.materials[0];wall_mat=core['walls'].data.materials[0]
    _roof(roof_mat);_walls(wall_mat);_wood(core['door'].data.materials[0])
    for obj in detail['windows']: _glass_frame(obj.data.materials[0])
    # The extended roof's triangular gables are plaster, not sloping tiles.
    roof.data.materials.append(wall_mat)
    for polygon in roof.data.polygons:
        if polygon.index>=2: polygon.material_index=1
    return {'profile':PROFILE,'profileSha256':profile_hash(),'implementationSha256':implementation_hash(),'structuralRoofVisible':False}
