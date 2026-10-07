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
    residential:{
      streetId:'residential-ew',
      side:'south',
      lotDepth:4,
      lotWidth:5,
      setback:2,
    },
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


test('review layout exposes house sockets tied to driveway frontage', () => {
  const cells=streetReviewCells(50,50);
  assert.ok(Array.isArray(cells.lots));
  assert.ok(cells.lots.length>=2);
  assert.ok(cells.lots.every(l=>l.houseSocket && l.driveway));
});
