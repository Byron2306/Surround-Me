import assert from 'node:assert/strict';
import test from 'node:test';
import {buildTownPlan,townBounds,prepareTownExpansion,buildTownGround,inTownArea} from '../world-art/town-expansion.mjs';
import {structureBounds} from '../world-art/live-world-spatial.mjs';
const inside=(p,b)=>p.x>b.minX&&p.x<b.maxX&&p.y>b.minY&&p.y<b.maxY;
test('18 addressed homes and four commercial premises occupy separate parcels',()=>{
 const p=buildTownPlan();assert.equal(p.homes.length,18);assert.equal(p.shops.length,4);
 assert.equal(new Set(p.buildings.map(s=>s.label)).size,22);
 for(const s of p.buildings){ const b=townBounds(s);assert.ok(b.minX>2&&b.maxX<98&&b.minY>2&&b.maxY<98);
  assert.ok(inTownArea(s.x,s.y));
  for(const t of p.buildings.filter(t=>t!==s)){const c=townBounds(t);assert.ok(b.maxX<=c.minX||b.minX>=c.maxX||b.maxY<=c.minY||b.minY>=c.maxY);}
 }
});
test('roads are connected from existing Fringe Junction to every street and approach',()=>{
 const p=buildTownPlan(),roads=new Set(p.layout.cells.filter(c=>c.role==='road').map(c=>`${c.x},${c.y}`));
 const seen=new Set(['29,71']),queue=[[29,71]];
 for(let i=0;i<queue.length;i++){const [x,y]=queue[i];for(const [a,b] of [[x+1,y],[x-1,y],[x,y+1],[x,y-1]]){const k=`${a},${b}`;if(roads.has(k)&&!seen.has(k)){seen.add(k);queue.push([a,b]);}}}
 assert.equal(seen.size,roads.size);
 for(const s of p.buildings){assert.ok(seen.has(`${s.path[0].x},${s.path[0].y}`)||p.layout.cells.some(c=>c.role==='road'&&Math.abs(c.x-s.path[0].x)<.51&&Math.abs(c.y-s.path[0].y)<.51));
  for(let i=1;i<s.path.length;i++){const a=s.path[i-1],b=s.path[i];for(let n=0;n<=100;n++){const pos={x:a.x+(b.x-a.x)*n/100,y:a.y+(b.y-a.y)*n/100};assert.ok(!p.buildings.some(t=>inside(pos,townBounds(t))),s.id+' door route blocked');}}
 }
 for(const c of p.layout.cells.filter(c=>c.role==='road')) assert.ok(!p.buildings.some(s=>inside(c,townBounds(s))));
});
test('installation removes authored blockers while retaining unrelated structures and hub walls',()=>{
 const old={x:90,y:20,w:2,h:2},intruder={x:17,y:20,w:2,h:2};
 const wall={x:50,y:50};
 const world={structures:[old,intruder],props:[{x:17,y:20},{x:90,y:20}],trees:[],fencePosts:[],wallSegments:[wall]};
 prepareTownExpansion(world,structureBounds);
 assert.ok(world.structures.includes(old));assert.ok(!world.structures.includes(intruder));assert.equal(world.props.length,1);assert.equal(world.wallSegments[0],wall);
 assert.equal(world.structures.filter(s=>s.type==='townBuilding').length,22);
});
test('ground chunks contain yard and driveway surfaces and both altered forms',()=>{
 const chunks=buildTownGround();assert.ok(chunks.length>10);
 for(const c of chunks){assert.ok(c.slabs.length);assert.ok(c.altered.restraint);assert.ok(c.altered.compulsion);}
});
test('the existing four Fringe Street home footprints survive expansion clearing',()=>{
 const homes=[{x:19,y:67,w:2.6,h:2.75},{x:23.5,y:67,w:3,h:3.5},{x:34,y:67,w:3,h:3},{x:39,y:67,w:3.5,h:2.6}]
  .map(s=>({...s,type:'governedHouseA',collisionBounds:{minX:-s.w/2,maxX:s.w/2,minY:-s.h,maxY:0}}));
 const world={structures:[...homes],props:[],trees:[],fencePosts:[]};prepareTownExpansion(world,structureBounds);
 for(const s of homes) assert.ok(world.structures.includes(s));
});
