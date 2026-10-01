const test = require('node:test');
const assert = require('node:assert/strict');

global.SurroundWorldArtCalibration = require('../world-art/hd-iso-v1/calibration.js');
const renderer = require('../world-art/hd-iso-v1/world-object-renderer.js');

test('display size derives from world footprint, not runtime texture resolution', () => {
  const calls = [];
  const ctx = { drawImage(...args) { calls.push(args); } };
  const record = {
    id: 'building.house.suburban.01',
    status: 'approved',
    anchor: [0.5, 1],
    footprintTiles: [3, 3],
    runtimePixels: [1024, 683]
  };
  const registry = {
    require() { return record; },
    imageFor() { return { width: 1024, height: 683 }; }
  };
  const result = renderer.drawWorldArtObject(
    ctx,
    { assetId: record.id, worldX: 0, worldY: 0 },
    { x: 0, y: 0, zoom: 2.0625 },
    registry
  );
  assert.equal(result.width, 192);
  assert.ok(Math.abs(result.height - (192 * 683 / 1024)) < 1e-9);
  assert.equal(calls[0][3], 192);
});

test('car footprint preserves physical 4.5m x 1.8m size at frozen 2m-per-tile scale', () => {
  const ctx = { drawImage() {} };
  const record = {
    id: 'vehicle.sedan.01',
    status: 'approved',
    anchor: [0.5, 1],
    footprintTiles: [2.25, 0.9],
    runtimePixels: [768, 768]
  };
  const registry = {
    require() { return record; },
    imageFor() { return { width: 768, height: 768 }; }
  };
  const result = renderer.drawWorldArtObject(
    ctx,
    { assetId: record.id, worldX: 0, worldY: 0 },
    { x: 0, y: 0, zoom: 2.0625 },
    registry
  );
  assert.ok(Math.abs(result.width - 100.8) < 1e-9);
});
