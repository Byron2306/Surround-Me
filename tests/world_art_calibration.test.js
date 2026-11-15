const test = require('node:test');
const assert = require('node:assert/strict');

const calibration = require('../world-art/hd-iso-v1/calibration.js');

test('worldToIso and isoToWorld round-trip canonical coordinates', () => {
  const p = calibration.worldToIso(7.25, -3.5, 64, 32);
  const round = calibration.isoToWorld(p.x, p.y, 64, 32);
  assert.ok(Math.abs(round.x - 7.25) < 1e-9);
  assert.ok(Math.abs(round.y + 3.5) < 1e-9);
});

test('one world-axis step matches half-diamond dimensions', () => {
  const origin = calibration.worldToIso(0, 0, 64, 32);
  const east = calibration.worldToIso(1, 0, 64, 32);
  assert.equal(east.x - origin.x, 32);
  assert.equal(east.y - origin.y, 16);
});

test('bottom-center anchor places ground contact on projected world point', () => {
  const camera = { x: 100, y: 50, zoom: 2 };
  const p = calibration.anchorScreenPosition(2, 3, [0.5, 1], camera, 64, 32);
  const ground = calibration.worldToIso(2, 3, 64, 32);
  assert.deepEqual(p, { x: (ground.x + 100) * 2, y: (ground.y + 50) * 2, anchorX: 0.5, anchorY: 1 });
});

test('negative world coordinates remain finite', () => {
  const p = calibration.worldToIso(-1000.5, -2000.25, 64, 32);
  assert.ok(Number.isFinite(p.x));
  assert.ok(Number.isFinite(p.y));
});

test('calibration mode id is stable', () => {
  assert.equal(calibration.CALIBRATION_MODE_ID, 'hd-iso-v1');
});
