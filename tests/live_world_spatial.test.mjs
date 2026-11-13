import test from 'node:test';
import assert from 'node:assert/strict';
import { structureAnchor, structureBounds, actorHeight, viewportSize, placementClear } from '../world-art/live-world-spatial.mjs';
test('governed anchor matches collision coordinates without half footprint shift', () => {
 const s={x:60,y:58,w:3.75,h:3,collisionBounds:{minX:-1.875,maxX:1.875,minY:-3,maxY:0}};
 assert.deepEqual(structureAnchor(s),{x:60,y:58});
 assert.deepEqual(structureBounds(s),{minX:58.125,maxX:61.875,minY:55,maxY:58});
 assert.equal(placementClear(60,56,[s]),false);
 assert.equal(placementClear(60,58.5,[s],0.2),false);
 assert.equal(placementClear(64,60,[s],0.2),true);
});
test('legacy footprint origin retains centred sprite anchor',()=>{
 assert.deepEqual(structureAnchor({x:10,y:20,w:4,h:2}),{x:12,y:21});
});
test('human actors share player metre scale while burdened stays larger',()=>{
 assert.equal(actorHeight('lingering'),actorHeight('player'));
 assert.ok(actorHeight('burdened')>actorHeight('player'));
 assert.ok(actorHeight('huddled')<actorHeight('player'));
});
test('portrait and landscape preserve viewport aspect without cropping',()=>{
 for(const [w,h] of [[390,844],[1920,1080],[844,390]]) {
  const v=viewportSize(w,h);
  assert.ok(Math.abs(v.w/v.h-w/h)<0.003);
  assert.ok(v.w*v.h<3000000);
 }
});
test('wall face follows world endpoints instead of a screen vertical rectangle',async()=>{
 const {wallFace}=await import('../world-art/live-world-spatial.mjs');
 const project=(x,y)=>({x:(x-y)*32,y:(x+y)*16});
 const face=wallFace({x:10,y:10,height:2,end:{x:11,y:10,height:2}},project);
 assert.deepEqual(face,[{x:0,y:0},{x:32,y:16},{x:32,y:-40},{x:0,y:-56}]);
});
