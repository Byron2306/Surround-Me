import test from 'node:test';
import assert from 'node:assert/strict';
import { residentialCrossroadSpec, streetReviewCells } from '../world-art/street-layout-review.mjs';

test('review spec is a stable two-street crossroad', () => {
  const spec=residentialCrossroadSpec(50,50);
  assert.deepEqual(spec,{
    tileMeters:2,
    streets:[
      {id:'residential-ew',axis:'x',from:{x:42,y:50},to:{x:58,y:50},halfWidth:1},
      {id:'residential-ns',axis:'y',from:{x:50,y:42},to:{x:50,y:58},halfWidth:1},
    ],
  });
});

test('review cells preserve deterministic road curb sidewalk priority', () => {
  const cells=streetReviewCells(50,50);
  const byKey=new Map(cells.map(c=>[`${c.x},${c.y}`,c]));
  assert.equal(byKey.get('50,50').role,'road');
  assert.equal(byKey.get('50,50').streetIds.length,2);
  assert.equal(new Set(cells.map(c=>`${c.x},${c.y}`)).size,cells.length);
  assert.ok(cells.some(c=>c.role==='curb'));
  assert.ok(cells.some(c=>c.role==='sidewalk'));
});
