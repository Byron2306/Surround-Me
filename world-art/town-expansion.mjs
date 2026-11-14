import {compileStreetLayout} from './street-layout.mjs';
import {fringeStreetGround, alteredFringeGround} from './validation/fringe-street.mjs';

export const townAssetPaths = {
    townHousePlaster:'./assets/town/house-plaster-v1.webp',
    townHouseBrick:'./assets/town/house-brick-v1.webp',
    townCornerShop:'./assets/town/corner-shop-v1.webp',
    townGrass:'./world-art/fringe-art-kit-v1/art/ground/dead_grass.png',
    townDirt:'./world-art/fringe-art-kit-v1/art/ground/dirt.png',
};
export const townAreas = [
    {minX:7,maxX:43,minY:8,maxY:61},
    {minX:26,maxX:32,minY:59,maxY:71},
    {minX:29,maxX:75,minY:59,maxY:64},
    {minX:46,maxX:71,minY:53,maxY:59},
    {minX:69,maxX:75,minY:61,maxY:67},
];
export const inTownArea=(x,y)=>townAreas.some(a=>x>=a.minX&&x<=a.maxX&&y>=a.minY&&y<=a.maxY);
const overlap=(a,b)=>a.minX<b.maxX&&a.maxX>b.minX&&a.minY<b.maxY&&a.maxY>b.minY;
export const townBounds=s=>({minX:s.x-s.w,maxX:s.x,minY:s.y-s.d,maxY:s.y});
const streets = [
    ...[20,36,52].map((y,i)=>({id:['Ash Street','Birch Street','Cedar Street'][i],axis:'x',from:{x:10,y},to:{x:44,y},halfWidth:1})),
    ...[10,29,44].map(x=>({id:`North link ${x}`,axis:'y',from:{x,y:20},to:{x,y:x===10?52:x===44?36:71},halfWidth:1})),
    {id:'Market Street',axis:'x',from:{x:29,y:61},to:{x:72,y:61},halfWidth:1},
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
    const shops=[49,55,61,67].map((x,i)=>({
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
    world.structures=world.structures.filter(s=>!authored(structureBounds(s)));
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
    const add=slab=>{
        const x=Math.floor(slab.x0/8)*8,y=Math.floor(slab.y0/8)*8,k=`${x},${y}`;
        if(!map.has(k)) map.set(k,{x,y,slabs:[]});
        map.get(k).slabs.push(slab);
    };
    // Authored turf replaces unrelated procedural terrain underneath each block.
    for(const a of [townAreas[0],townAreas[2],townAreas[3]]) for(let x=a.minX;x<a.maxX;x++) for(let y=a.minY;y<a.maxY;y++)
        add({x0:x,y0:y,x1:x+1,y1:y+1,fill:'#41483d',material:((x*13+y*7)%11===0?'dirt':'dead_grass')});
    const lots=plan.buildings.map(s=>({id:s.id,bounds:s.parcel}));
    for(const slab of fringeStreetGround({...plan.layout,lots},null,null,[])) add(slab);
    for(const s of plan.buildings) {
        for(let i=1;i<s.path.length;i++) {
            const a=s.path[i-1],b=s.path[i];
            add({x0:Math.min(a.x,b.x)-.25,y0:Math.min(a.y,b.y)-.25,
                x1:Math.max(a.x,b.x)+.25,y1:Math.max(a.y,b.y)+.25,fill:'#77796e',material:'concrete'});
        }
    }
    return [...map.values()].map(c=>({...c,cells:[],altered:Object.fromEntries(['restraint','compulsion'].map(side=>[side,alteredFringeGround(c.slabs,{cells:[]},side)]))}));
}
export function townLocation(x,y) {
    if(y<65&&x>45) return 'Market Street · Grocer / Pharmacy / Hardware / Laundrette';
    if(y<62&&x<44) return 'North Suburb · Ash / Birch / Cedar Streets';
    return null;
}
export function drawTownBuilding(ctx,sx,sy,s,image,event) {
    if(!image) return;
    const width=(s.w+s.d)*32, height=width*image.height/image.width;
    ctx.save();
    if(event.polarity==='restraint') ctx.filter=`saturate(${1-event.intensity*.65})`;
    if(event.polarity==='compulsion') ctx.filter=`sepia(${event.intensity*.45})`;
    ctx.drawImage(image,sx-width*s.spriteAnchor.x,sy-height*s.spriteAnchor.y,width,height);
    ctx.restore();
}
