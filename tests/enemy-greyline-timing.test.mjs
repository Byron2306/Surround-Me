import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';

const game=readFileSync(new URL('../game.js',import.meta.url),'utf8');
const start=game.indexOf('class Enemy {');
const end=game.indexOf('\nfunction spawnEnemies()',start);
const {enemyTellScale}=await import('../world-art/enemy-greyline.mjs');

function encounter(type,side) {
  const player={x:10,y:10,vx:0,vy:0,snarePlaced:[],takeDamage(){}};
  const greyline={knobs:{ai:{}},getSide:()=>side,getExtremity:()=>1,push(){}};
  const Enemy=runInNewContext(game.slice(start,end)+'\nEnemy',{
    player,greyline,enemyTellScale,angleToDir8:()=>2,WORLD_SIZE:100,
    camera:{addShake(){}},psychStats:{integrity:{value:1}},particles:[],TILE_W:64,TIME:{elapsed:0},
  });
  return new Enemy(type,11,10);
}
test('Deferred actually erupts; restraint prolongs its warning and compulsion shortens it',()=>{
  const count=side=>{
    const e=encounter('deferred',side);
    for(let i=1;i<=100;i++) {
      e.update(.01);
      if(e.isErupting) return i;
    }
    assert.fail('warning never completed');
  };
  assert.ok(count('compulsion')<count('greyline'));
  assert.ok(count('restraint')>count('greyline'));
});

test('Rehearsed changes time to lunge in the opposite direction without stat inflation',()=>{
  const count=side=>{
    const e=encounter('rehearsed',side);
    e.performAttack=()=>{};
    const stats=[e.maxHealth,e.damage,e.speed];
    for(let i=1;i<=450;i++) {
      e.update(.01);
      if(e.state==='pattern_lunge'){
        assert.deepEqual([e.maxHealth,e.damage,e.speed],stats);
        return i;
      }
    }
    assert.fail('lunge never started');
  };
  assert.ok(count('compulsion')>count('greyline'));
  assert.ok(count('restraint')<count('greyline'));
});
