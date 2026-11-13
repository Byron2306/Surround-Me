import assert from 'node:assert/strict';
import test from 'node:test';
import { buildCivicGround, civicStreetCells } from '../world-art/civic-town.mjs';

test('Civic Loop builds its road ground without a residential area', () => {
  assert.ok(civicStreetCells.some(cell => cell.role === 'road'));
  const chunks = buildCivicGround();
  assert.ok(chunks.some(chunk => chunk.slabs.length > 0));
});
