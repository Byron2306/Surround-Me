import test from 'node:test';
import assert from 'node:assert/strict';
import {basicHitDamage,dashDuration,dashFrame} from '../world-art/combat-motion.mjs';

test('basic weapon hits preserve smaller damage but cannot erase full health',()=>{
  assert.equal(basicHitDamage(6,40,'gun'),6);
  assert.ok(Math.abs(basicHitDamage(64,25,'stab')-13.75)<1e-9);
  assert.equal(basicHitDamage(200,40,'gun'),22);
  assert.equal(basicHitDamage(64,25,undefined),64);
});

test('dash stops before a thin blocker even when the endpoint is clear',()=>{
  const result=dashFrame({x:0,y:0,dirX:1,dirY:0,remaining:.23,dt:.23,side:'compulsion',agency:1,
    isBlocked:(x)=>x>=.72 && x<=.84});
  assert.equal(result.remaining,0);
  assert.ok(result.x>=.65 && result.x<.72);
  assert.equal(result.y,0);
});

test('final dash tick spends only remaining time; overcommit range stays bounded',()=>{
  const origin={x:0,y:0,dirX:1,dirY:0,isBlocked:()=>false,agency:1};
  const end=dashFrame({...origin,remaining:.01,dt:.05,side:'neutral'});
  assert.ok(end.x>0 && end.x<.10);
  assert.equal(end.remaining,0);
  const full=dashFrame({...origin,remaining:dashDuration('compulsion',2),dt:1,side:'compulsion'});
  assert.ok(full.x<=2.1);
  assert.ok(dashDuration('restraint',1)<dashDuration('neutral',1));
});
