import test from 'node:test';
import assert from 'node:assert/strict';
import { residentialCrossroadSpec, streetReviewCells, streetReviewLayout, reviewHousePlacements, computeReviewFit, reviewPresentation, curbRenderProfile, depthKey, buildElevatedRenderables, houseProjectionConformance } from '../world-art/street-layout-review.mjs';

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
      side:'north',
      lotDepth:6,
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
  const layout=streetReviewLayout(50,50);
  assert.ok(Array.isArray(layout.lots));
  assert.ok(layout.lots.length>=2);
  assert.ok(layout.lots.every(l=>l.houseSocket && l.driveway));
});


test('review house sockets face the street using governed House A orientation', () => {
  const layout=streetReviewLayout(50,50);
  assert.ok(layout.lots.length>=2);
  assert.ok(layout.lots.every(l=>l.side==='north'));
  assert.ok(layout.lots.every(l=>l.houseSocket.facing==='south'));
});


test('review deterministically alternates governed A-01 and A-02 across legal lots', () => {
  const layout=streetReviewLayout(50,50);
  const placements=reviewHousePlacements(layout);
  assert.equal(placements.length,layout.lots.length);
  assert.deepEqual(placements.map(p=>p.houseKind),placements.map((_,i)=>i%2===0?'A01':'A02'));
  assert.ok(placements.every((p,i)=>p.x===layout.lots[i].houseSocket.x && p.y===layout.lots[i].houseSocket.y));
  assert.ok(placements.every(p=>p.facing==='south'));
});


test('review fit keeps road and governed house visible bounds inside viewport', () => {
  const layout=streetReviewLayout(50,50);
  const placements=reviewHousePlacements(layout);
  const houses={
    A01:{visibleBounds:{minX:-95.5,maxX:144,minY:-148.5,maxY:33.25}},
    A02:{visibleBounds:{minX:-59.5,maxX:156,minY:-142.5,maxY:27.25}},
  };
  const fit=computeReviewFit(layout,placements,houses,1200,700,50,50,28);
  assert.ok(fit.zoom>0);
  assert.ok(fit.zoom<1.55);
  assert.ok(fit.bounds.minX*fit.zoom+fit.originX>=27);
  assert.ok(fit.bounds.maxX*fit.zoom+fit.originX<=1173);
  assert.ok(fit.bounds.minY*fit.zoom+fit.originY>=27);
  assert.ok(fit.bounds.maxY*fit.zoom+fit.originY<=673);
});


test('polished review hides construction overlays unless debug is explicit', () => {
  assert.deepEqual(reviewPresentation(''),{debug:false});
  assert.deepEqual(reviewPresentation('?debug=1'),{debug:true});
  assert.deepEqual(reviewPresentation('?debug=true'),{debug:true});
});

test('driveway curb renders as lowered ramp while normal curb stays raised', () => {
  assert.deepEqual(
    curbRenderProfile({module:'curb-driveway',gutterEdge:'s'}),
    {raised:false,gutter:false,ramp:true}
  );
  assert.deepEqual(
    curbRenderProfile({module:'curb-straight-s',gutterEdge:'s'}),
    {raised:true,gutter:true,ramp:false}
  );
});


test('polished driveway is grid-aligned from curb toward house socket', () => {
  const layout=streetReviewLayout(50,50);
  for(const lot of layout.lots){
    assert.equal(lot.driveway.curbX,lot.houseSocket.x);
    assert.notEqual(lot.driveway.curbY,lot.houseSocket.y);
  }
});


test('elevated renderables sort by deterministic ground depth instead of asset type', () => {
  const layout=streetReviewLayout(50,50);
  const placements=reviewHousePlacements(layout);
  const items=buildElevatedRenderables(layout,placements);
  const sorted=[...items].sort((a,b)=>depthKey(a)-depthKey(b) || a.kind.localeCompare(b.kind));
  for(let i=1;i<sorted.length;i++) assert.ok(depthKey(sorted[i-1])<=depthKey(sorted[i]));
  assert.ok(sorted.some(i=>i.kind==='house'));
  assert.ok(sorted.some(i=>i.kind==='curb-face'));
});

test('house projection conformance compares visible base axes to 2:1 dimetric street axes', () => {
  const good=houseProjectionConformance({
    left:{x:0,y:0},
    right:{x:64,y:32},
    rear:{x:64,y:-32},
  });
  assert.equal(good.status,'PASS');
  const bad=houseProjectionConformance({
    left:{x:0,y:0},
    right:{x:64,y:10},
    rear:{x:64,y:-32},
  });
  assert.equal(bad.status,'REFUSE');
});
