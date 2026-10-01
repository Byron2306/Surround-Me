const test = require('node:test');
const assert = require('node:assert/strict');

const roads = require('../world-art/hd-iso-v1/road-topology.js');

const EXPECTED = new Map([
  [0b0000, 'none'],
  [0b0001, 'dead_end_n'],
  [0b0010, 'dead_end_e'],
  [0b0011, 'corner_ne'],
  [0b0100, 'dead_end_s'],
  [0b0101, 'straight_ns'],
  [0b0110, 'corner_se'],
  [0b0111, 't_missing_w'],
  [0b1000, 'dead_end_w'],
  [0b1001, 'corner_nw'],
  [0b1010, 'straight_ew'],
  [0b1011, 't_missing_s'],
  [0b1100, 'corner_sw'],
  [0b1101, 't_missing_e'],
  [0b1110, 't_missing_n'],
  [0b1111, 'cross'],
]);

test('all 16 cardinal connectivity masks map to one stable topology key', () => {
  assert.equal(EXPECTED.size, 16);
  for (let mask = 0; mask < 16; mask++) {
    assert.equal(roads.topologyForMask(mask), EXPECTED.get(mask), `mask=${mask.toString(2).padStart(4, '0')}`);
  }
});

test('mask bits are N=1 E=2 S=4 W=8', () => {
  assert.equal(roads.DIRECTION_BITS.N, 1);
  assert.equal(roads.DIRECTION_BITS.E, 2);
  assert.equal(roads.DIRECTION_BITS.S, 4);
  assert.equal(roads.DIRECTION_BITS.W, 8);
  assert.equal(roads.maskFromConnections({ north: true, east: true, south: false, west: false }), 3);
});

test('mask builder accepts compact cardinal keys without changing meaning', () => {
  assert.equal(roads.maskFromConnections({ N: true, E: false, S: true, W: false }), 5);
  assert.equal(roads.topologyForConnections({ N: true, S: true }), 'straight_ns');
  assert.equal(roads.topologyForConnections({ east: true, west: true }), 'straight_ew');
});

test('invalid masks refuse instead of wrapping or guessing', () => {
  for (const value of [-1, 16, 1.5, NaN, Infinity, '15', null, undefined]) {
    assert.throws(() => roads.topologyForMask(value), /mask/i);
  }
});

test('connection values must be booleans when supplied', () => {
  assert.throws(() => roads.maskFromConnections({ north: 1 }), /boolean/i);
  assert.throws(() => roads.maskFromConnections({ E: 'yes' }), /boolean/i);
});

test('topology metadata preserves connected cardinal directions', () => {
  assert.deepEqual(roads.describeMask(0b1011), {
    mask: 0b1011,
    topology: 't_missing_s',
    connections: ['N', 'E', 'W'],
    degree: 3,
  });
  assert.deepEqual(roads.describeMask(0), {
    mask: 0,
    topology: 'none',
    connections: [],
    degree: 0,
  });
});

test('legacy asset names are not part of the topology contract', () => {
  for (let mask = 0; mask < 16; mask++) {
    const key = roads.topologyForMask(mask);
    assert.equal(key.includes('.png'), false);
    assert.equal(key.includes('street '), false);
  }
});
