import test from 'node:test';
import assert from 'node:assert/strict';
import * as town from '../world-art/town-expansion.mjs';
import {structureBounds} from '../world-art/live-world-spatial.mjs';

test('grass never paints over the final road surface at chunk boundaries',()=>{
 const p=town.buildTownPlan(),chunks=town.buildTownGround(p);
 for(const c of p.layout.cells.filter(c=>c.role==='road'))for(const [dx,dy] of [[.2,.2],[-.2,-.2]]){
  const x=c.x+dx,y=c.y+dy;let last;
  for(const chunk of chunks)for(const s of chunk.slabs)if(x>=s.x0&&x<=s.x1&&y>=s.y0&&y<=s.y1)last=s;
  assert.ok(last,'unpainted road');assert.ok(!['dirt','dead_grass'].includes(last.material),`turf crosses road at ${x},${y}`);
 }
});
test('calibrated facade base edges follow exact 2:1 world axes without leaning vertical walls',()=>{
 assert.equal(typeof town.buildingFaceTransforms,'function');
 for(const asset of ['townHousePlaster','townHouseBrick','townCornerShop']){
  const {left,right,contact}=town.buildingFaceTransforms(asset,3.75,3);
  for(const [m,target]of [[left,{x:-120,y:-60}],[right,{x:96,y:-48}]]){
   const p=m.source;
   assert.ok(Math.abs(m.a*(p.x-contact.x)-target.x)<1e-8);
   assert.ok(Math.abs(m.b*(p.x-contact.x)+m.d*(p.y-contact.y)-target.y)<1e-8);
   assert.equal(m.c,0,'vertical wall must stay vertical');
  }
 }
});
test('Holdfast replacements preserve collisions, structure identity and NPCs',()=>{
 assert.equal(typeof town.prepareHoldfastArt,'function');
 const structures=[{x:49,y:47,w:5,h:4,type:'chapel',label:'The Holdfast'},
 {x:43,y:52,w:3,h:2,type:'shack',label:'Dwelling'},
 {x:55,y:46,w:3,h:3,type:'barn',label:'Storehouse'},
 {x:18,y:16,w:3,h:2,type:'shack',label:'Outside'}];
 const before=structures.map(structureBounds),npcs=[{name:'Harron',x:48,y:50}];
 const world={structures,npcs};town.prepareHoldfastArt(world,structureBounds);
 for(const [i,s]of structures.entries())assert.deepEqual(structureBounds(s),before[i]);
 for(const s of structures.slice(0,3)){assert.equal(s.type,'townBuilding');assert.ok(s.asset.startsWith('town'));}
 assert.equal(structures[3].type,'shack');assert.equal(world.npcs,npcs);
});
test('commercial premises do not displace the nine original Holdfast structures',()=>{
 const originals=[{x:49,y:47,w:5,h:4,type:'chapel',label:'The Holdfast'},
 {x:43,y:52,w:3,h:2,type:'shack',label:'Dwelling'},{x:55,y:46,w:3,h:3,type:'barn',label:'Storehouse'},
 {x:45,y:44,w:3,h:3,type:'storehouse',label:'Archive'},{x:56,y:53,w:2,h:2,type:'shack',label:'Workshop'},
 {x:42,y:47,w:2,h:2,type:'shack',label:'Hut'},{x:53,y:56,w:3,h:2,type:'barn',label:'Quarters'},
 {x:47,y:56,w:2,h:2,type:'shack',label:'Dwelling'},{x:58,y:49,w:2,h:3,type:'storehouse',label:'Armory'}];
 const world={structures:[...originals],props:[],trees:[],fencePosts:[]};
 town.prepareTownExpansion(world,structureBounds);
 for(const s of originals)assert.ok(world.structures.includes(s),s.label+' displaced by expansion');
});
test('combining Civic Loop and town layers keeps verges below roads',async()=>{
 const {buildCivicGround}=await import('../world-art/civic-town.mjs');
 const chunks=[...town.buildTownGround(),...buildCivicGround()].sort((a,b)=>(a.stage??0)-(b.stage??0));
 for(const [x,y]of [[16.2,19.2],[24.2,35.2],[32.2,51.2],[72.2,61.2],[80.2,61.2]]){
  let last;for(const c of chunks)for(const s of c.slabs)if(x>=s.x0&&x<=s.x1&&y>=s.y0&&y<=s.y1)last=s;
  assert.ok(last);assert.ok(!['dead_grass','dirt'].includes(last.material),`grass over combined road ${x},${y}`);
 }
});
