const test = require('node:test');
const assert = require('node:assert/strict');
const { loadPhaseABlock } = require('../world-art/phase-a/scene.js');

function approved(id, footprint=[1,1]) {
  return { id, status:'approved', anchor:[0.5,1], footprintTiles:footprint };
}

function registry(records) {
  const map = new Map(records.map(r => [r.id, r]));
  return {
    require(id) {
      const record = map.get(id);
      if (!record) throw new Error(`missing ${id}`);
      if (record.status !== 'approved') throw new Error(`not approved ${id}`);
      return record;
    }
  };
}

const assets = [
  approved('road.intersection.4way.01', [4,4]),
  approved('building.house.suburban.01', [3,3]),
  approved('building.shop.corner.01', [3,2]),
  approved('vehicle.sedan.01', [2,1])
];

const scene = {
  spawn: { x: 0, y: 6 },
  bounds: { minX: -12, minY: -12, maxX: 12, maxY: 12 },
  ground: { assetId: 'road.intersection.4way.01', worldX: 0, worldY: 0, layer:'ground', blocking:false },
  objects: [
    { assetId:'building.house.suburban.01', worldX:-7, worldY:-5, blocking:true },
    { assetId:'building.shop.corner.01', worldX:6, worldY:-5, blocking:true },
    { assetId:'vehicle.sedan.01', worldX:4, worldY:4, blocking:true, zBias:0 }
  ],
  atmosphere: []
};

test('load is deterministic for identical scene data', () => {
  const a = loadPhaseABlock(scene, registry(assets));
  const b = loadPhaseABlock(JSON.parse(JSON.stringify(scene)), registry(assets));
  assert.deepEqual(a, b);
});

test('spawn does not overlap any blocking collision footprint', () => {
  const result = loadPhaseABlock(scene, registry(assets));
  for (const rect of result.collisionRects) {
    const inside = result.spawn.x >= rect.minX && result.spawn.x <= rect.maxX && result.spawn.y >= rect.minY && result.spawn.y <= rect.maxY;
    assert.equal(inside, false, JSON.stringify(rect));
  }
});

test('every referenced asset must resolve through registry', () => {
  const broken = JSON.parse(JSON.stringify(scene));
  broken.objects.push({ assetId:'missing.asset', worldX:0, worldY:0, blocking:false });
  assert.throws(() => loadPhaseABlock(broken, registry(assets)), /missing\.asset/);
});

test('objects outside scene bounds are rejected', () => {
  const broken = JSON.parse(JSON.stringify(scene));
  broken.objects[0].worldX = 99;
  assert.throws(() => loadPhaseABlock(broken, registry(assets)), /bounds/i);
});

test('equal-depth objects sort stably by asset id', () => {
  const tied = JSON.parse(JSON.stringify(scene));
  tied.objects = [
    { assetId:'vehicle.sedan.01', worldX:1, worldY:1, blocking:false },
    { assetId:'building.shop.corner.01', worldX:0, worldY:2, blocking:false }
  ];
  const result = loadPhaseABlock(tied, registry(assets));
  assert.deepEqual(result.objects.map(o => o.assetId), ['building.shop.corner.01', 'vehicle.sedan.01']);
});
