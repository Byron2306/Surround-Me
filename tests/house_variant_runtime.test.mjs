import test from 'node:test';
import assert from 'node:assert/strict';
import { variantStructure } from '../world-art/house-variant-runtime.mjs';
test('metadata supplies anchor and collision',()=>{
 const m={schema:'house-variant-runtime-v1',variantId:'house.a.02',familyId:'house.master.a',physicalWidth:2048,physicalHeight:2048,logicalWidth:512,logicalHeight:512,anchorPixelX:208,anchorPixelY:328,collisionBounds:{minX:-1.5,maxX:1.5,minY:-3,maxY:0},doorApproach:{x:-.54,y:.5},pngSha256:'sha256:'+'a'.repeat(64),asset:'house.a.02-'+ 'a'.repeat(64)+'.png'};
 const s=variantStructure(m,10,8); assert.equal(s.governedSprite.anchorPixelX,208); assert.equal(s.collisionBounds.minX,-1.5);
 assert.throws(()=>variantStructure({...m,anchorPixelX:NaN},0,0));
});
import { reviewLayout } from '../world-art/house-variant-runtime.mjs';
test('review plots stay inside perimeter and share projected ground height',()=>{
 const r=reviewLayout(100,100);
 for (const p of [r.master,r.variant]) assert.ok(Math.hypot(p.x-100,p.y-100)<13);
 assert.equal(r.master.x+r.master.y,r.variant.x+r.variant.y);
 assert.ok(Math.hypot(r.master.x-r.variant.x,r.master.y-r.variant.y)>7);
});
