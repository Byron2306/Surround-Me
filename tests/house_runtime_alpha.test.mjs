import test from 'node:test';
import assert from 'node:assert/strict';
import { clearConnectedBackground } from '../world-art/house-runtime-alpha.mjs';
test('removes opaque border background while preserving enclosed dark details',()=>{
 const pixels=new Uint8ClampedArray(5*5*4);
 for(let i=0;i<25;i++)pixels.set([0,0,0,255],i*4);
 for(let y=1;y<4;y++)for(let x=1;x<4;x++)pixels.set([120,100,80,255],(y*5+x)*4);
 pixels.set([0,0,0,255],(2*5+2)*4);
 clearConnectedBackground(pixels,5,5);
 assert.equal(pixels[3],0);
 assert.equal(pixels[(2*5+2)*4+3],255);
 assert.equal(pixels[(1*5+1)*4+3],255);
});
test('keeps valid alpha and rejects mismatched dimensions',()=>{
 const pixels=new Uint8ClampedArray([0,0,0,0,100,50,30,150]);
 clearConnectedBackground(pixels,2,1);
 assert.equal(pixels[7],150);
 assert.throws(()=>clearConnectedBackground(pixels,3,1));
});
test('transparent canvas does not exempt attached black silhouette from repair',()=>{
 const pixels=new Uint8ClampedArray(5*5*4);
 for(let y=1;y<4;y++)for(let x=1;x<4;x++)pixels.set([120,100,80,255],(y*5+x)*4);
 pixels.set([0,0,0,255],(1*5+1)*4);
 pixels.set([0,0,0,255],(2*5+2)*4);
 clearConnectedBackground(pixels,5,5);
 assert.equal(pixels[(1*5+1)*4+3],0);
 assert.equal(pixels[(2*5+2)*4+3],255);
});
