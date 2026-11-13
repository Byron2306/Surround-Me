import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import {walkVelocity} from '../world-art/combat-motion.mjs';

test('compulsion cannot turn movement response into extra world speed',()=>{
  const walk=walkVelocity(1,1,3,'compulsion',.3);
  assert.ok(Math.abs(Math.hypot(walk.x,walk.y)-3)<1e-9);
  assert.deepEqual(walkVelocity(0,0,3,'compulsion',.3),{x:0,y:0});
  assert.ok(walkVelocity(1,0,3,'restraint',.3).x<3);
});

test('all eight families dispatch their own AI at close range under extreme restraint',()=>{
  const game=readFileSync(new URL('../game.js',import.meta.url),'utf8');
  const classStart=game.indexOf('class Enemy {');
  const classEnd=game.indexOf('\nfunction spawnEnemies()',classStart);
  const knobs={ai:{aggro:1,delay:.4}};
  const player={x:10,y:10,vx:0,vy:0,snarePlaced:[],takeDamage(){assert.fail('generic proximity attack preempted the family');}};
  const Enemy=runInNewContext(game.slice(classStart,classEnd)+'\nEnemy',{player,greyline:{knobs,getSide:()=> 'restraint',getExtremity:()=>.95,value:.05},psychStats:{awareness:{value:1},agency:{value:1}},isOccludedBetween:()=>false,angleToDir8:()=>2,WORLD_SIZE:100});
  for (const family of ['lingering','watchful','huddled','rehearsed','burdened','drifting','deferred','remembered']){
    const enemy=new Enemy(family,10.5,10);
    const initial=enemy.state;
    let calls=0;
    enemy['ai'+family[0].toUpperCase()+family.slice(1)]=function(){
      calls++;
      assert.equal(this.state,initial);
      this._ai.aggro=.2;
    };
    enemy.update(.016);
    assert.equal(calls,1,family);
    assert.equal(knobs.ai.aggro,1);
  }
});
