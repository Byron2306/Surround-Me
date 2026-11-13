import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {buildAccessReview} from '../world-art/validation/residential-access-v9.mjs';

const source=JSON.parse(readFileSync(new URL('../evidence/residential-v8/a01-source-binding.json',import.meta.url)));
function input() {
  const cells=[];
  for (let x=42;x<=47;x++) cells.push({x,y:49,role:'road'},{x,y:48,role:'curb',module:x===45?'curb-driveway':'curb-straight-s'},{x,y:47,role:'sidewalk'});
  return {layout:{cells},lot:{side:'north',bounds:{minX:42,maxX:47,minY:41,maxY:48},driveway:{curbX:45,curbY:48}},placement:{x:44.5,y:46},source};
}
test('ramp, sidewalk and porch connect, but review cannot admit production',()=>{
  const r=buildAccessReview(input());
  assert.equal(r.status,'PASS');
  assert.equal(r.productionAdmission,'REFUSE');
  assert.equal(r.blocked(45,48),false);
  assert.equal(r.blocked(44,48),false);
  // Cross the curb and walk along the asphalt, then return via the ramp.
  for (let i=0;i<=20;i++) {
    assert.equal(r.blocked(44,47+i*.1),false);
    assert.equal(r.blocked(44+i*.05,49),false);
    assert.equal(r.blocked(45,49-i*.05),false);
  }
  assert.equal(r.blocked(r.doorX,45.9),true);
  assert.equal(r.atDoor(r.doorX,46.25),true);
  assert.equal(r.atDoor(45,48),false);
});
test('ordinary curb cannot be substituted for driveway',()=>{
  const i=input();i.layout.cells.find(c=>c.module==='curb-driveway').module='curb-straight-s';
  assert.equal(buildAccessReview(i).reason,'DRIVEWAY_NOT_CONNECTED');
});
test('road across middle of the route refuses despite clear endpoints',()=>{
  const i=input();i.layout.cells.find(c=>c.x===44 && c.y===47).role='road';
  assert.equal(buildAccessReview(i).reason,'ROUTE_BLOCKED');
});

test('Debian street layout admits the actual relocated A-01 route',async t=>{
  const {existsSync}=await import('node:fs');
  const moduleUrl=new URL('../world-art/street-layout-review.mjs',import.meta.url);
  if (!existsSync(moduleUrl)) return t.skip('street layout module was not included in snapshot');
  const {streetReviewLayout,reviewHousePlacements}=await import(moduleUrl);
  const layout=streetReviewLayout(29,71);
  const a=reviewHousePlacements(layout).find(p=>p.houseKind==='A01');
  const lot=layout.lots.find(l=>l.id===a.lotId);
  const result=buildAccessReview({layout,lot,placement:{...a,x:a.x-.5},source});
  assert.equal(result.status,'PASS',result.reason);
});
