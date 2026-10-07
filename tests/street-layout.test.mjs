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


test('curb cells expose deterministic module type, gutter edge and drain sockets', () => {
  const layout=compileStreetLayout({streets:[
    {id:'ew',axis:'x',from:{x:0,y:0},to:{x:12,y:0},halfWidth:1},
  ]});
  const curb=cellsByRole(layout,'curb');
  const north=curb.filter(c=>c.roadSides?.includes('s') && c.module==='curb-straight-s');
  const south=curb.filter(c=>c.roadSides?.includes('n') && c.module==='curb-straight-n');
  assert.ok(north.length>0);
  assert.ok(south.length>0);
  assert.ok(north.every(c=>c.gutterEdge==='s'));
  assert.ok(south.every(c=>c.gutterEdge==='n'));
  assert.ok(curb.some(c=>c.stormDrain===true));
  assert.ok(curb.filter(c=>c.stormDrain).every(c=>c.module.startsWith('curb-straight-')));
});

test('curb corners never receive storm drains', () => {
  const layout=compileStreetLayout({streets:[
    {id:'ew',axis:'x',from:{x:-4,y:0},to:{x:4,y:0},halfWidth:1},
    {id:'ns',axis:'y',from:{x:0,y:-4},to:{x:0,y:4},halfWidth:1},
  ]});
  const corners=cellsByRole(layout,'curb').filter(c=>c.module.startsWith('curb-corner-'));
  assert.ok(corners.length>0);
  assert.ok(corners.every(c=>c.stormDrain===false));
});


test('residential frontage compiler emits deterministic lots and driveway cuts', () => {
  const layout=compileStreetLayout({
    streets:[{id:'ew',axis:'x',from:{x:0,y:10},to:{x:20,y:10},halfWidth:1}],
    residential:{
      streetId:'ew',
      side:'south',
      lotDepth:4,
      lotWidth:5,
      setback:2,
    },
  });
  assert.ok(Array.isArray(layout.lots));
  assert.ok(layout.lots.length>=3);
  assert.ok(layout.lots.every(l=>l.streetId==='ew'));
  assert.ok(layout.lots.every(l=>l.driveway && Number.isInteger(l.driveway.curbX) && Number.isInteger(l.driveway.curbY)));
  assert.ok(layout.lots.every(l=>l.houseSocket && Number.isFinite(l.houseSocket.x) && Number.isFinite(l.houseSocket.y)));
  const drivewayKeys=new Set(layout.lots.map(l=>`${l.driveway.curbX},${l.driveway.curbY}`));
  assert.equal(drivewayKeys.size,layout.lots.length);
});

test('driveway cuts mutate only matching straight curb modules', () => {
  const layout=compileStreetLayout({
    streets:[{id:'ew',axis:'x',from:{x:0,y:10},to:{x:20,y:10},halfWidth:1}],
    residential:{streetId:'ew',side:'south',lotDepth:4,lotWidth:5,setback:2},
  });
  const drivewayKeys=new Set(layout.lots.map(l=>`${l.driveway.curbX},${l.driveway.curbY}`));
  const curb=cellsByRole(layout,'curb');
  for(const cell of curb){
    const k=`${cell.x},${cell.y}`;
    if(drivewayKeys.has(k)){
      assert.equal(cell.module,'curb-driveway');
      assert.equal(cell.stormDrain,false);
    }
  }
});


test('residential lots refuse frontage that crosses another street or junction', () => {
  const layout=compileStreetLayout({
    streets:[
      {id:'ew',axis:'x',from:{x:0,y:10},to:{x:20,y:10},halfWidth:1},
      {id:'ns',axis:'y',from:{x:10,y:4},to:{x:10,y:16},halfWidth:1},
    ],
    residential:{streetId:'ew',side:'south',lotDepth:4,lotWidth:5,setback:2},
  });
  assert.ok(layout.lots.length>=1);
  for(const lot of layout.lots){
    assert.ok(!(lot.bounds.minX<=11 && lot.bounds.maxX>=9),'lot crosses north-south carriageway');
    const curb=layout.cells.find(c=>c.role==='curb' && c.x===lot.driveway.curbX && c.y===lot.driveway.curbY);
    assert.ok(curb);
    assert.equal(curb.module,'curb-driveway');
  }
});


test('house socket stays inside its lot at deterministic curb setback', () => {
  const layout=compileStreetLayout({
    streets:[{id:'ew',axis:'x',from:{x:0,y:10},to:{x:20,y:10},halfWidth:1}],
    residential:{streetId:'ew',side:'north',lotDepth:6,lotWidth:5,setback:2},
  });
  assert.ok(layout.lots.length>0);
  for(const lot of layout.lots){
    assert.ok(lot.houseSocket.x>=lot.bounds.minX && lot.houseSocket.x<=lot.bounds.maxX);
    assert.ok(lot.houseSocket.y>=lot.bounds.minY && lot.houseSocket.y<=lot.bounds.maxY);
    assert.equal(lot.houseSocket.y,lot.driveway.curbY-2);
    assert.equal(lot.houseSocket.facing,'south');
  }
});
