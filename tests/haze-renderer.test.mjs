import assert from 'node:assert/strict';
import test from 'node:test';

import * as haze from '../world-art/haze-renderer.mjs';

const project = (x, y) => ({ x: (x-y)*32, y: (x+y)*16 });
const view = { x: -256, y: -150, width: 512, height: 300 };
const image = (width, height) => ({ width, height, data: new Uint8ClampedArray(width*height*4) });
const alpha = surface => surface.data.filter((_, index) => index % 4 === 3);

test('ambient haze remains measurable at both extremes and in flux without local pools', () => {
    for (const g of [-1, 0, 1]) {
        const profile = haze.hazeProfile(g, g === 0 ? 0 : 3, false);
        const patches = haze.collectHazePatches({ view, pools: [], drifts: [], project, time: 0, profile });
        const field = image(128, 75);
        haze.rasterizeHaze(field, view, patches, profile.tint);
        assert.ok(Math.max(...alpha(field)) >= 22, `visible at Greyline ${g}`);
    }
});

test('stacking identical sources has exactly the density of one source', () => {
    const field = image(80, 50);
    const patch = { x: 0, y: 0, rx: 100, ry: 80, opacity: 0.9 };
    haze.rasterizeHaze(field, view, [patch], [160,150,170]);
    const one = field.data.slice();
    haze.rasterizeHaze(field, view, Array(72).fill(patch), [160,150,170]);
    assert.deepEqual(field.data, one);
    assert.ok(Math.max(...alpha(field)) <= Math.round(haze.HAZE_MAX_OPACITY*255));
});

test('visible sources are culled and prioritized before the patch budget is applied', () => {
    const offscreen = { x: 90, y: 0, radius: 2, density: 0.16, pulse: 0 };
    const touching = { x: 11, y: 1, radius: 5, density: 0.14, pulse: 0 };
    const pools = [...Array(120).fill(offscreen), touching, ...Array.from({length: 80}, (_, index) => ({
        x: 0.01 * index, y: 0, radius: 2.5, density: 0.10, pulse: 0,
    }))];
    const profile = haze.hazeProfile(0, 0, false);
    const edgeOnly = haze.collectHazePatches({ view, pools: [...Array(120).fill(offscreen), touching], drifts: [], project, time: 0, profile });
    const projected = edgeOnly.find(patch => patch.x === 320);
    assert.ok(projected, 'an offscreen centre whose haze intersects the viewport is visible');
    assert.equal(projected.rx, Math.hypot(32, 32)*5);
    assert.equal(projected.ry, Math.hypot(16, 16)*5);
    const patches = haze.collectHazePatches({ view, pools, drifts: [], project, time: 0, profile });
    assert.ok(patches.some(patch => patch.x === 0 && patch.rx === Math.hypot(32, 32)*2.5), 'later, on-camera sources survive culling');
    assert.ok(patches.every(patch => patch.x < 500));
    assert.ok(patches.length <= haze.HAZE_MAX_PATCHES);
});

test('the low-resolution field is reused between updates while the camera pans', () => {
    let allocations = 0, uploads = 0;
    const draws = [];
    const makeCanvas = () => {
        allocations++;
        return { width: 0, height: 0, getContext: () => ({
            createImageData: image,
            putImageData() { uploads++; },
        }) };
    };
    const paint = haze.createHazeRenderer(makeCanvas);
    const ctx = { drawImage: (...args) => draws.push(args) };
    const input = { view, pools: [], drifts: [], project, time: 0, g: 0, tier: 0, inHub: false };
    paint(ctx, input);
    paint(ctx, { ...input, time: 0.016, view: { ...view, x: view.x+5 } });
    assert.equal(allocations, 1);
    assert.equal(uploads, 1);
    assert.equal(draws.length, 2);
    assert.equal(draws[1][1], draws[0][1]-5);
    paint(ctx, { ...input, time: 0.06 });
    assert.equal(uploads, 2);
    assert.ok(draws[0][0].width <= 224);
    assert.ok(draws[0][0].height <= 144);
});
