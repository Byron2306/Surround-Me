import assert from 'node:assert/strict';
import test from 'node:test';

const animation = await import('../world-art/aliza-animation.mjs').catch(error => {
    if (error.code !== 'ERR_MODULE_NOT_FOUND') throw error;
    return {};
});

test('projects eight accepted movement vectors to screen compass directions', () => {
    assert.equal(typeof animation.alizaDirection, 'function');
    const vectors = [[-1,-1], [0,-1], [1,-1], [1,0], [1,1], [0,1], [-1,1], [-1,0]];
    assert.deepEqual(vectors.map(([dx, dy]) => animation.alizaDirection(dx, dy)), [0,1,2,3,4,5,6,7]);
});

test('travel drives foot phase and a wall holds the last facing without walking in place', () => {
    assert.equal(typeof animation.createAlizaMotion, 'function');
    const motion = animation.createAlizaMotion();
    animation.advanceAlizaMotion(motion, 0.15, -0.15, 0.05, false, false);
    assert.equal(motion.action, 'run');
    assert.equal(motion.direction, 2);
    assert.ok(motion.phase > 0);
    const phase = motion.phase;
    animation.advanceAlizaMotion(motion, 0, 0, 0.05, false, false);
    assert.equal(motion.action, 'stand');
    assert.equal(motion.direction, 2);
    assert.equal(motion.phase, phase);
});

test('crouch entry, crouch walking and rise use separate motion states', () => {
    assert.equal(typeof animation.createAlizaMotion, 'function');
    const motion = animation.createAlizaMotion();
    animation.advanceAlizaMotion(motion, 0, 0, 0.05, true, false);
    assert.equal(motion.action, 'crouch');
    assert.ok(motion.stance > 0 && motion.stance < 1);
    animation.advanceAlizaMotion(motion, 0.3, 0.3, 0.20, true, false);
    assert.equal(motion.action, 'crouchWalk');
    assert.equal(motion.direction, 4);
    animation.advanceAlizaMotion(motion, 0, 0, 0.05, false, false);
    assert.equal(motion.action, 'crouch');
    assert.ok(motion.stance > 0 && motion.stance < 1);
    animation.advanceAlizaMotion(motion, 0, 0, 0.20, false, false);
    assert.equal(motion.action, 'stand');
});

test('shot retains its aim while moving and dash uses its own heading and timer', () => {
    assert.equal(typeof animation.alizaPose, 'function');
    const player = {
        _alizaMotion: { action: 'run', direction: 2, phase: 0.5, stance: 0 },
        _alizaGunDirection: 7,
        _gunSpriteTimer: 0.18,
        state: 'moving',
    };
    assert.deepEqual(animation.alizaPose(player), { action: 'gunfire', direction: 7, progress: 0 });
    Object.assign(player, { state: 'dashing', dashDirX: 1, dashDirY: 1, dashTimer: 0.1, _alizaDashDuration: 0.2 });
    assert.deepEqual(animation.alizaPose(player), { action: 'dash', direction: 4, progress: 0.5 });
    Object.assign(player, { state: 'attacking', dashTimer: 0, _gunSpriteTimer: 0, _alizaKnifeDirection: 1, _alizaKnifeDuration: 0.4, attackTimer: 0.4 });
    assert.deepEqual(animation.alizaPose(player), { action: 'knife', direction: 1, progress: 0 });
});

test('each requested clip samples every facing and each strike starts on contact', () => {
    assert.equal(typeof animation.alizaFrame, 'function');
    for (let direction = 0; direction < 8; direction++) {
        for (const action of ['stand', 'run', 'dash', 'crouch', 'crouchWalk', 'knife', 'gunfire']) {
            const first = animation.alizaFrame({ action, direction, progress: 0 });
            const later = animation.alizaFrame({ action, direction, progress: 0.58 });
            assert.ok(first && later, `${action}/${direction}`);
            if (!['stand', 'crouch'].includes(action)) assert.notDeepEqual(first, later, `${action}/${direction}`);
        }
    }
    assert.equal(animation.alizaFrame({ action: 'gunfire', direction: 3, progress: 0 }).cell, 'se-5');
    assert.equal(animation.alizaFrame({ action: 'knife', direction: 3, progress: 0 }).cell, 'se-10');
});
