import test from 'node:test';
import assert from 'node:assert/strict';
import * as town from '../world-art/town-expansion.mjs';
test('house roof is one continuous planar slope with a straight ridge parallel to depth',()=>{
 assert.equal(typeof town.houseRoofGeometry,'function');
 for(const [w,d]of [[3.75,3],[4,3],[3,3]]){
  const g=town.houseRoofGeometry({w,d});const [a,b,c,e]=g.slope;
  assert.ok(Math.abs((b.x-a.x)-d*32)<1e-8);assert.ok(Math.abs((b.y-a.y)+d*16)<1e-8);
  assert.ok(Math.abs((c.x-e.x)-d*32)<1e-8);assert.ok(Math.abs((c.y-e.y)+d*16)<1e-8);
  assert.ok(Math.abs(a.x+c.x-b.x-e.x)<1e-8);assert.ok(Math.abs(a.y+c.y-b.y-e.y)<1e-8);
  assert.deepEqual(g.gable[2],e);assert.ok(g.rise>0);assert.ok(g.wallHeight>0);
 }
});
test('four commercial premises use four distinct registered asset files',()=>{
 const p=town.buildTownPlan();assert.equal(new Set(p.shops.map(s=>s.asset)).size,4);
 for(const s of p.shops){assert.ok(town.townAssetPaths[s.asset]);assert.doesNotThrow(()=>town.buildingFaceTransforms(s.asset,s.w,s.d));}
});
