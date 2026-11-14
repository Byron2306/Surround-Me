// Offline overview of the authored town, including the existing Civic Loop.
const {createCanvas,loadImage}=require('@napi-rs/canvas');
const fs=require('node:fs');
const path=require('node:path');
(async()=>{
 const root=path.resolve(__dirname,'..');
 const {structureBounds}=await import(root+'/world-art/live-world-spatial.mjs');
 const town=await import(root+'/world-art/town-expansion.mjs');
 const civic=await import(root+'/world-art/civic-town.mjs');
 const {compileStreetLayout}=await import(root+'/world-art/street-layout.mjs');
 const {residentialCrossroadSpec}=await import(root+'/world-art/street-layout-review.mjs');
 const {fringeStreetGround}=await import(root+'/world-art/validation/fringe-street.mjs');
 const {variantStructure}=await import(root+'/world-art/house-variant-runtime.mjs');
 const canvas=createCanvas(2400,1900),ctx=canvas.getContext('2d');
 ctx.fillStyle='#101514';ctx.fillRect(0,0,2400,1900);
 const scale=18,project=(x,y)=>({x:(x-y)*scale+1260,y:(x+y)*scale/2+30});
 const plan=town.buildTownPlan();
 const spec=residentialCrossroadSpec(29,71);spec.streets[0].from.x=16;spec.streets[0].to.x=46;
 const fringe=compileStreetLayout(spec);
 const chunks=[...town.buildTownGround(plan),{slabs:fringeStreetGround(fringe,null,null,[])},...civic.buildCivicGround()].sort((a,b)=>(a.stage??0)-(b.stage??0));
 for(const {slabs}of chunks)for(const s of slabs){ctx.beginPath();for(const [i,[x,y]]of [[s.x0,s.y0],[s.x1,s.y0],[s.x1,s.y1],[s.x0,s.y1]].entries()){const p=project(x,y);i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y);}ctx.closePath();ctx.fillStyle=s.fill;ctx.fill();}
 const images={};for(const [id,p]of Object.entries(town.townAssetPaths))images[id]=await loadImage(path.join(root,p));
 const world={structures:[],props:[],trees:[],fencePosts:[]};
 const game=fs.readFileSync(root+'/game.js','utf8');
 const hubBlock=game.slice(game.indexOf('// Central chapel'),game.indexOf('// G1.8 in-game acceptance scene.'));
 new Function('world','const hubX=50,hubY=50;'+hubBlock.replaceAll('this.structures','world.structures'))(world);
 civic.prepareCivicTown(world,structureBounds);town.prepareHoldfastArt(world,structureBounds);
 for(const s of world.structures.filter(s=>s.type==='civicLandmark'))images[s.id]=await loadImage(`${root}/world-art/civic/${s.id}.webp`);
 const oldHomes=[];
 for(const [id,x]of [['house.a.03',19],['house.a.02',34],['house.a.04',39]]){const m=JSON.parse(fs.readFileSync(`${root}/world-art/hd-iso-v1/runtime/${id}.json`));const s=variantStructure(m,x,67);images[s.asset]=await loadImage(`${root}/world-art/hd-iso-v1/runtime/${m.asset}`);oldHomes.push(s);}
 images.houseA01Suburb=await loadImage(`${root}/world-art/hd-iso-v1/calibration/house-a01-provisional-2048.png`);
 oldHomes.push({x:23.5,y:67,type:'governedHouseA',asset:'houseA01Suburb',governedSprite:{logicalWidth:512,logicalHeight:512,anchorPixelX:220,anchorPixelY:334}});
 const all=[...plan.buildings,...world.structures,...oldHomes].sort((a,b)=>a.x+a.y-b.x-b.y);
 ctx.save();ctx.scale(scale/32,scale/32);
 for(const s of all){const p=project(s.x,s.y),x=p.x*32/scale,y=p.y*32/scale;
  if(s.type==='townBuilding')town.drawTownBuilding(ctx,x,y,s,images[s.asset],{polarity:'ordinary',intensity:0});
  else if(s.type==='civicLandmark')civic.drawCivicLandmark(ctx,x,y,s,images[s.id],{polarity:'ordinary',intensity:0});
  else{const g=s.governedSprite;ctx.drawImage(images[s.asset],x-g.anchorPixelX,y-g.anchorPixelY,g.logicalWidth,g.logicalHeight);}
 }
 ctx.restore();
 ctx.fillStyle='#d8d1bd';ctx.font='32px sans-serif';ctx.fillText('SURROUND ME — SUBURB / MARKET STREET / CIVIC LOOP',65,65);
 ctx.font='20px sans-serif';ctx.fillText('22 homes · 4 shop premises · Roxy Cinema · Town Hall · Rail Yards · Waterworks',65,103);
 ctx.fillStyle='#999f92';ctx.font='17px sans-serif';ctx.fillText('Offline authored-world overview · candidate expansion art · interactive verification pending',65,137);
 const labels=[...plan.signs,{x:50,y:53,text:'THE HOLDFAST · REALISTIC CHAPEL + COURTYARD'},{x:24,y:72,text:'FRINGE STREET · ORIGINAL FOUR HOMES'},
  ...world.structures.filter(s=>s.type==='civicLandmark').map(s=>({x:s.x,y:s.y+1,text:({roxy:'ROXY CINEMA',hall:'TOWN HALL',rail:'RAIL LOADING GANTRY',pump:'WATERWORKS · PUMP HOUSE'})[s.id]})),
  ...civic.civicSigns.filter(s=>['HOSPITAL RD','SCHOOL RD','MEMORIAL RD','BRIDGE RD'].includes(s.text)).map(s=>({...s,text:s.text+' · CLOSED TURNOFF'}))];
 for(const s of labels){const p=project(s.x,s.y);ctx.font='bold 13px sans-serif';ctx.textAlign='center';const w=ctx.measureText(s.text).width;ctx.fillStyle='rgba(10,15,14,.82)';ctx.fillRect(p.x-w/2-5,p.y-15,w+10,21);ctx.fillStyle='#e9dfbc';ctx.fillText(s.text,p.x,p.y);}
 const out=path.join(root,'evidence/town/overview.png');fs.writeFileSync(out,canvas.toBuffer('image/png'));console.log(out);
})();
