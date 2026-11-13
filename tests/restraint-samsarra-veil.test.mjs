import test from 'node:test';
import assert from 'node:assert/strict';
import { restraintSamsarraVisualProfile, drawRestraintSamsarraVeil,
    RESTRAINT_SAMSARRA_VEIL } from '../world-art/restraint-samsarra-veil.mjs';

const event=(polarity,intensity=1,phase='samsarra') => ({ polarity, intensity, phase });

test('full Restraint is dark, desaturated and vision-limited',()=>{
    const p=restraintSamsarraVisualProfile(event('restraint'));
    assert.equal(p.strength,1);
    assert.ok(p.edgeDim>=.85);
    assert.ok(p.saturationRemoval>=.8);
    assert.ok(p.charcoalOpacity>=.2);
    assert.ok(p.edgeDim>p.centreDim);
});

test('Compulsion, ordinary and pressure never gain the blindfold',()=>{
    for (const e of [event('compulsion'),event(null),event('restraint',1,'pressure'),event('restraint',1,'ordinary')]) {
        assert.equal(restraintSamsarraVisualProfile(e).strength,0);
    }
});

test('restraint entry and release use smooth intensity rather than snapping',()=>{
    const a=restraintSamsarraVisualProfile(event('restraint',.21)).strength;
    const b=restraintSamsarraVisualProfile(event('restraint',.6)).strength;
    const c=restraintSamsarraVisualProfile(event('restraint',.9)).strength;
    assert.ok(0<a&&a<b&&b<c&&c<1);
    assert.equal(restraintSamsarraVisualProfile(event('restraint',.1,'release')).strength,0);
    assert.ok(restraintSamsarraVisualProfile(event('restraint',.6,'release')).strength>0);
});

test('one bounded screen-space composite; no per-pixel noise or offscreen buffers',()=>{
    const stats={fills:0,gradients:0,saves:0,restores:0,transforms:0};
    const ctx={
        save(){stats.saves++},restore(){stats.restores++},
        setTransform(){stats.transforms++},
        fillRect(){stats.fills++},
        createRadialGradient(){stats.gradients++;return {addColorStop(){}}},
        globalAlpha:1,globalCompositeOperation:'source-over',fillStyle:'#000',
    };
    assert.equal(drawRestraintSamsarraVeil(ctx,event('restraint'),1280,720),true);
    assert.deepEqual(stats,{fills:3,gradients:1,saves:1,restores:1,transforms:1});
    assert.equal(drawRestraintSamsarraVeil(ctx,event('compulsion'),1280,720),false);
    assert.equal(stats.fills,3);
    assert.equal(RESTRAINT_SAMSARRA_VEIL.edgeDim<1,true);
});
