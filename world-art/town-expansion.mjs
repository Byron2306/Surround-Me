import {compileStreetLayout} from './street-layout.mjs';
import {fringeStreetGround, alteredFringeGround} from './validation/fringe-street.mjs';

export const townAssetPaths = {
    townHousePlaster:'./assets/town/house-plaster-v1.webp',
    townHouseBrick:'./assets/town/house-brick-v1.webp',
    townCornerShop:'./assets/town/corner-shop-v1.webp',
    townChapel:'./assets/town/holdfast-chapel-v1.webp',
    townGrass:'./world-art/fringe-art-kit-v1/art/ground/dead_grass.png',
    townDirt:'./world-art/fringe-art-kit-v1/art/ground/dirt.png',
};
export const townAreas = [
    {minX:7,maxX:43,minY:8,maxY:61},
    {minX:26,maxX:32,minY:59,maxY:71},
    {minX:29,maxX:91,minY:59,maxY:64},
    {minX:62,maxX:89,minY:53,maxY:59},
    {minX:69,maxX:75,minY:61,maxY:67},
];
export const inTownArea=(x,y)=>townAreas.some(a=>x>=a.minX&&x<=a.maxX&&y>=a.minY&&y<=a.maxY);
const overlap=(a,b)=>a.minX<b.maxX&&a.maxX>b.minX&&a.minY<b.maxY&&a.maxY>b.minY;
export const townBounds=s=>({minX:s.x-s.w,maxX:s.x,minY:s.y-s.d,maxY:s.y});
const streets = [
    ...[20,36,52].map((y,i)=>({id:['Ash Street','Birch Street','Cedar Street'][i],axis:'x',from:{x:10,y},to:{x:y===52?40:44,y},halfWidth:1})),
    ...[10,29,44].map(x=>({id:`North link ${x}`,axis:'y',from:{x,y:20},to:{x,y:x===10?52:x===44?36:71},halfWidth:1})),
    {id:'Market Street',axis:'x',from:{x:29,y:61},to:{x:88,y:61},halfWidth:1},
    {id:'Market east link',axis:'y',from:{x:72,y:61},to:{x:72,y:67},halfWidth:1},
];
export function buildTownPlan() {
    const layout=compileStreetLayout({streets});
    const homes=[];
    for(const [row,y] of [14,26,30,42,46,58].entries()) {
        for(const [col,x] of [19,26,39].entries()) {
            const n=row*3+col+1;
            const s={type:'townBuilding',id:`home-${n}`,label:`${n} ${['Ash','Ash','Birch','Birch','Cedar','Cedar'][row]} Street`,
                x,y,w:3.75,d:3,asset:n%2?'townHousePlaster':'townHouseBrick',district:'residential',
                spriteAnchor:{x:.60,y:.935},artStatus:'candidate',
                collisionBounds:{minX:-3.75,maxX:0,minY:-3,maxY:0}};
            const roadY=[20,20,36,36,52,52][row];
            // South-side homes are approached along their east wall, then around the front.
            const door={x:x-1.8,y:y+.45};
            const path=row%2===0 ? [{x:door.x,y:roadY},{x:door.x,y:door.y}]
                : [{x:x+.65,y:roadY},{x:x+.65,y:door.y},{x:door.x,y:door.y}];
            homes.push({...s,door,path,parcel:{minX:x-4.5,maxX:x+1.2,minY:y-3.5,maxY:y+1.2}});
        }
    }
    const shops=[65,71,77,83].map((x,i)=>({
        type:'townBuilding',id:`shop-${i+1}`,label:['Corner Grocer','Pharmacy','Hardware','Laundrette'][i],
        x,y:57.5,w:3,d:2,asset:'townCornerShop',district:'commercial',
        spriteAnchor:{x:.65,y:.97},artStatus:'candidate',
        collisionBounds:{minX:-3,maxX:0,minY:-2,maxY:0},
        door:{x:x-1.5,y:58},path:[{x:x-1.5,y:61},{x:x-1.5,y:58}],
        parcel:{minX:x-3.5,maxX:x+1,minY:54.5,maxY:59},
    }));
    const buildings=[...homes,...shops];
    const signs=[...streets.slice(0,3).map(s=>({x:12,y:s.from.y+2.4,text:s.id.toUpperCase()})),
        {x:46,y:63.4,text:'MARKET STREET'},
        ...shops.map(s=>({x:s.door.x,y:59,text:s.label.toUpperCase()}))];
    return {layout,homes,shops,buildings,signs};
}
export function prepareTownExpansion(world,structureBounds,plan=buildTownPlan()) {
    const authored=b=>townAreas.some(a=>overlap(a,b));
    world.structures=world.structures.filter(s=>isHoldfastStructure(s)||!authored(structureBounds(s)));
    for(const field of ['props','trees','fencePosts']) {
        world[field]=(world[field]??[]).filter(p=>{
            const r=p.collisionRadius??(field==='trees'?.6*(p.height||1):.6*(p.scale||1));
            return !authored({minX:p.x-r,maxX:p.x+r,minY:p.y-r,maxY:p.y+r});
        });
    }
    world.structures.push(...plan.buildings);
    return plan;
}
export function buildTownGround(plan=buildTownPlan()) {
    const map=new Map();
    const add=(slab,stage=0)=>{
        const x=Math.floor(slab.x0/8)*8,y=Math.floor(slab.y0/8)*8,k=`${stage}:${x},${y}`;
        if(!map.has(k)) map.set(k,{x,y,stage,slabs:[]});
        map.get(k).slabs.push(slab);
    };
    // Authored turf replaces unrelated procedural terrain underneath each block.
    for(const a of [townAreas[0],townAreas[2],townAreas[3]]) for(let x=a.minX;x<a.maxX;x++) for(let y=a.minY;y<a.maxY;y++)
        add({x0:x,y0:y,x1:x+1,y1:y+1,fill:'#41483d',material:((x*13+y*7)%11===0?'dirt':'dead_grass')});
    // A muted paved Holdfast courtyard replaces the legacy brown tile floor.
    for(let x=40;x<62;x++)for(let y=40;y<61;y++)if(Math.hypot(x+.5-50,y+.5-50)<10.5)
        add({x0:x,y0:y,x1:x+1,y1:y+1,fill:(x+y)%2?'#646762':'#6c7069',material:'concrete'});
    const lots=plan.buildings.map(s=>({id:s.id,bounds:s.parcel}));
    for(const slab of fringeStreetGround({...plan.layout,lots},null,null,[])) add(slab,1);
    for(const s of plan.buildings) {
        for(let i=1;i<s.path.length;i++) {
            const a=s.path[i-1],b=s.path[i];
            const steps=Math.max(1,Math.ceil(Math.hypot(b.x-a.x,b.y-a.y)*4));
            for(let n=0;n<steps;n++) {
                const x=a.x+(b.x-a.x)*(n+.5)/steps,y=a.y+(b.y-a.y)*(n+.5)/steps;
                if(plan.layout.cells.some(c=>c.role==='road' && Math.abs(c.x-x)<.76 && Math.abs(c.y-y)<.76))continue;
                add({x0:x-.25,y0:y-.25,x1:x+.25,y1:y+.25,fill:'#77796e',material:'concrete'},2);
            }
        }
    }
    return [...map.values()].sort((a,b)=>a.stage-b.stage).map(c=>({...c,cells:[],altered:Object.fromEntries(['restraint','compulsion'].map(side=>[side,alteredFringeGround(c.slabs,{cells:[]},side)]))}));
}
export function townLocation(x,y) {
    if(Math.hypot(x-50,y-50)<11)return 'The Holdfast · Chapel / Archive / Workshop / Quarters';
    if(y<65&&x>62) return 'Market Street · Grocer / Pharmacy / Hardware / Laundrette';
    if(y<62&&x<44) return 'North Suburb · Ash / Birch / Cedar Streets';
    return null;
}
// Contact points measured on the immutable source sprites, normalized to their canvas.
// Each facade is corrected separately; shared vertical corners remain continuous.
const CONTACTS={
 townHousePlaster:{contact:{x:.598,y:.933},left:{x:.055,y:.853},right:{x:.958,y:.761}},
 townHouseBrick:{contact:{x:.600,y:.894},left:{x:.040,y:.849},right:{x:.960,y:.747}},
 townCornerShop:{contact:{x:.678,y:.969},left:{x:.035,y:.837},right:{x:.960,y:.815}},
 townChapel:{contact:{x:.526,y:.991},left:{x:.076,y:.942},right:{x:.925,y:.857}},
};
export function buildingFaceTransforms(asset,w,d) {
 const points=CONTACTS[asset];
 if(!points)throw new Error('Uncalibrated building asset: '+asset);
 const vertical=(w+d)*32;
 const face=(source,x,y)=>({source,a:x/(source.x-points.contact.x),
  b:(y-vertical*(source.y-points.contact.y))/(source.x-points.contact.x),c:0,d:vertical});
 return {contact:points.contact,left:face(points.left,-w*32,-w*16),right:face(points.right,d*32,-d*16)};
}
export function drawTownBuilding(ctx,sx,sy,s,image,event) {
 if(!image)return;
 const {contact,left,right}=buildingFaceTransforms(s.asset,s.w,s.d);
 ctx.save();
 if(event.polarity==='restraint')ctx.filter=`saturate(${1-event.intensity*.65})`;
 if(event.polarity==='compulsion')ctx.filter=`sepia(${event.intensity*.45})`;
 for(const [side,m]of [['left',left],['right',right]]) {
  ctx.save();ctx.transform(m.a,m.b,m.c,m.d,sx,sy);
  ctx.beginPath();ctx.rect(side==='left'?-2:0,-3,2,4);ctx.clip();
  ctx.drawImage(image,-contact.x,-contact.y,1,1);ctx.restore();
 }
 ctx.restore();
}
const HOLDFAST_LABELS=new Set(['The Holdfast','Dwelling','Storehouse','Archive','Workshop','Hut','Quarters','Armory']);
const isHoldfastStructure=s=>HOLDFAST_LABELS.has(s.label)&&Math.hypot(s.x-50,s.y-50)<=12;
export function prepareHoldfastArt(world,structureBounds) {
 for(const s of world.structures) {
  if(!isHoldfastStructure(s)||s.type==='townBuilding')continue;
  const b=structureBounds(s),chapel=s.type==='chapel';
  const asset=chapel?'townChapel':['storehouse','barn'].includes(s.type)?'townCornerShop':s.label==='Dwelling'?'townHousePlaster':'townHouseBrick';
  Object.assign(s,{type:'townBuilding',asset,district:'holdfast',x:b.maxX,y:b.maxY,w:b.maxX-b.minX,d:b.maxY-b.minY,
   collisionBounds:{minX:b.minX-b.maxX,maxX:0,minY:b.minY-b.maxY,maxY:0},artStatus:'candidate'});
 }
}
