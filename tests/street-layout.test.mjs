import test from 'node:test';
import assert from 'node:assert/strict';
import { compileStreetLayout, cellsByRole } from '../world-art/street-layout.mjs';

test('straight street compiles deterministic road curb sidewalk rings', () => {
  const spec={tileMeters:2,streets:[{id:'main',axis:'x',from:{x:0,y:0},to:{x:4,y:0},halfWidth:1}]};
  const a=compileStreetLayout(spec);
  const b=compileStreetLayout(spec);
  assert.deepEqual(a,b);
  assert.equal(a.schema,'surround-me-street-layout-v1');
  assert.equal(a.counts.road,15);
  assert.ok(a.counts.curb>0);
  assert.ok(a.counts.sidewalk>0);
  assert.ok(cellsByRole(a,'curb').every(c=>c.variant.startsWith('curb-')));
});

test('crossing streets union into one deterministic intersection', () => {
  const layout=compileStreetLayout({streets:[
    {id:'east-west',axis:'x',from:{x:-3,y:0},to:{x:3,y:0},halfWidth:1},
    {id:'north-south',axis:'y',from:{x:0,y:-3},to:{x:0,y:3},halfWidth:1},
  ]});
  const center=cellsByRole(layout,'road').find(c=>c.x===0&&c.y===0);
  assert.deepEqual(center.streetIds,['east-west','north-south']);
  const keys=new Set(layout.cells.map(c=>`${c.x},${c.y}`));
  assert.equal(keys.size,layout.cells.length);
});

test('road cells have priority over curb and sidewalk', () => {
  const layout=compileStreetLayout({streets:[
    {id:'a',axis:'x',from:{x:0,y:0},to:{x:6,y:0},halfWidth:1},
    {id:'b',axis:'y',from:{x:3,y:-3},to:{x:3,y:3},halfWidth:1},
  ]});
  const roles=new Map(layout.cells.map(c=>[`${c.x},${c.y}`,c.role]));
  assert.equal(roles.get('3,0'),'road');
  // The north-south segment spans y=-3..3 with halfWidth=1, so (3,-2)
  // is correctly still carriageway. Probe the first cell beyond its end.
  assert.notEqual(roles.get('3,-4'),'road');
});

test('rejects diagonal segment masquerading as horizontal street', () => {
  assert.throws(()=>compileStreetLayout({streets:[
    {id:'bad',axis:'x',from:{x:0,y:0},to:{x:4,y:1},halfWidth:1},
  ]}),/x_street_must_be_horizontal/);
});
