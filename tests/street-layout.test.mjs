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


test('road cells expose deterministic cardinal connectivity and topology variants', () => {
  const layout=compileStreetLayout({streets:[
    {id:'ew',axis:'x',from:{x:-3,y:0},to:{x:3,y:0},halfWidth:0},
    {id:'ns',axis:'y',from:{x:0,y:-3},to:{x:0,y:3},halfWidth:0},
  ]});
  const byKey=new Map(cellsByRole(layout,'road').map(c=>[`${c.x},${c.y}`,c]));
  assert.equal(byKey.get('0,0').variant,'road-cross');
  assert.deepEqual(byKey.get('0,0').connections,['n','e','s','w']);
  assert.equal(byKey.get('2,0').variant,'road-ew');
  assert.deepEqual(byKey.get('2,0').connections,['e','w']);
  assert.equal(byKey.get('0,2').variant,'road-ns');
  assert.deepEqual(byKey.get('0,2').connections,['n','s']);
});


test('marking authority comes from street ownership centerlines, not thick-road neighbors', () => {
  const layout=compileStreetLayout({streets:[
    {id:'ew',axis:'x',from:{x:-4,y:0},to:{x:4,y:0},halfWidth:1},
    {id:'ns',axis:'y',from:{x:0,y:-4},to:{x:0,y:4},halfWidth:1},
  ]});
  const byKey=new Map(cellsByRole(layout,'road').map(c=>[`${c.x},${c.y}`,c]));
  assert.equal(byKey.get('3,0').marking,'centerline-ew');
  assert.equal(byKey.get('3,1').marking,'none');
  assert.equal(byKey.get('0,3').marking,'centerline-ns');
  assert.equal(byKey.get('1,3').marking,'none');
  assert.equal(byKey.get('0,0').marking,'junction');
  assert.equal(byKey.get('1,0').marking,'junction');
  assert.equal(byKey.get('0,1').marking,'junction');
});
