const test = require('node:test');
const assert = require('node:assert/strict');

const player = require('../world-art/phase-a/player.js');

test('player moves deterministically at dt-scaled speed', () => {
  const start = { x: 0, y: 0 };
  const next = player.stepPlayer(start, { east: true }, 0.5, [], { speedTilesPerSecond: 4 });
  assert.equal(next.x, 2);
  assert.equal(next.y, 0);
});

test('diagonal movement is normalized', () => {
  const next = player.stepPlayer({ x: 0, y: 0 }, { east: true, south: true }, 1, [], { speedTilesPerSecond: 1 });
  assert.ok(Math.abs(Math.hypot(next.x, next.y) - 1) < 1e-9);
});

test('blocking collision refuses penetration independently on each axis', () => {
  const wall = [{ minX: 0.8, minY: -1, maxX: 1.8, maxY: 1 }];
  const next = player.stepPlayer({ x: 0, y: 0 }, { east: true }, 1, wall, {
    speedTilesPerSecond: 1,
    radiusTiles: 0.25,
  });
  assert.equal(next.x, 0);
  assert.equal(next.y, 0);
});

test('movement is clamped to scene bounds', () => {
  const next = player.stepPlayer({ x: 11.9, y: 0 }, { east: true }, 1, [], {
    speedTilesPerSecond: 3,
    radiusTiles: 0.25,
    bounds: { minX: -12, minY: -12, maxX: 12, maxY: 12 },
  });
  assert.equal(next.x, 11.75);
});

test('screen height contract remains 80 logical pixels before camera zoom', () => {
  assert.equal(player.PLAYER_LOGICAL_HEIGHT, 80);
  assert.equal(player.PLAYER_SCREEN_HEIGHT_AT_NORMAL_ZOOM, 165);
});
