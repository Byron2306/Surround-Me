import test from 'node:test';
import assert from 'node:assert/strict';

import {
  HOUSE_A_TRUTH,
  buildHouseATruthGeometry,
} from '../world-art/hd-iso-v1/house-a-truth-overlay.mjs';

const project = (wx, wy) => ({
  x: (wx - wy) * 32,
  y: (wx + wy) * 16,
});

test('House A truth overlay preserves the approved physical and game-space law', () => {
  assert.equal(HOUSE_A_TRUTH.widthM, 7.5);
  assert.equal(HOUSE_A_TRUTH.depthM, 6.0);
  assert.equal(HOUSE_A_TRUTH.widthWorld, 3.75);
  assert.equal(HOUSE_A_TRUTH.depthWorld, 3.0);
  assert.equal(HOUSE_A_TRUTH.maxHeightM, 4.8);
  assert.equal(HOUSE_A_TRUTH.doorHeightM, 2.0);
  assert.deepEqual(HOUSE_A_TRUTH.anchor, [0.5, 1.0]);
});

test('House A truth overlay uses the live 64x32 projection and immutable vertical scale', () => {
  const geometry = buildHouseATruthGeometry(10, 20, project);

  assert.deepEqual(geometry.ground[0], project(10, 20));
  assert.deepEqual(geometry.ground[1], project(13.75, 20));
  assert.deepEqual(geometry.ground[2], project(13.75, 23));
  assert.deepEqual(geometry.ground[3], project(10, 23));

  const expectedRise = 4.8 * 8 * Math.sqrt(6);
  assert.ok(Math.abs(geometry.verticalRisePx - expectedRise) < 1e-9);

  const expectedDoorRise = 2.0 * 8 * Math.sqrt(6);
  assert.ok(Math.abs(geometry.doorRisePx - expectedDoorRise) < 1e-9);

  assert.deepEqual(geometry.anchorWorld, { x: 11.875, y: 23 });
});
