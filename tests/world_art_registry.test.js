const test = require('node:test');
const assert = require('node:assert/strict');
const { WorldArtRegistry } = require('../world-art/hd-iso-v1/runtime-registry.js');

function manifest(assets) {
  return { assets };
}

function asset(id, status='approved', phaseA=true) {
  return {
    id,
    status,
    phaseA,
    category: 'building',
    runtimeSource: `world-art/hd-iso-v1/runtime/${id}.webp`,
    source: `world-art/hd-iso-v1/masters/${id}.png`,
    anchor: [0.5, 1],
    footprintTiles: [1, 1],
    runtimePixels: [512, 512]
  };
}

test('known ID lookup returns the exact record', () => {
  const record = asset('building.house.01');
  const registry = new WorldArtRegistry(manifest([record]));
  assert.equal(registry.get(record.id), record);
});

test('missing ID require throws diagnostic error', () => {
  const registry = new WorldArtRegistry(manifest([]));
  assert.throws(() => registry.require('missing.asset'), /missing\.asset/);
});

test('duplicate IDs are rejected at construction', () => {
  assert.throws(() => new WorldArtRegistry(manifest([asset('dup'), asset('dup')])), /duplicate/i);
});

test('require rejects assets not approved for production placement', () => {
  const registry = new WorldArtRegistry(manifest([asset('planned.asset', 'planned')]));
  assert.throws(() => registry.require('planned.asset'), /not approved/i);
});

test('phaseAAssets returns approved phase A assets in stable id order', () => {
  const registry = new WorldArtRegistry(manifest([
    asset('z.asset'),
    asset('a.asset'),
    asset('m.asset', 'candidate'),
    asset('b.nonphase', 'approved', false)
  ]));
  assert.deepEqual(registry.phaseAAssets().map(a => a.id), ['a.asset', 'z.asset']);
});
