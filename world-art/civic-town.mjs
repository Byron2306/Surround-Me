import { compileStreetLayout } from './street-layout.mjs';
import { alteredFringeGround, drawFringeGround, fringeStreetGround } from './validation/fringe-street.mjs?v=civic-1';

export const civicAssetIds = ['roxy','hall','rail','pump','huddled-ordinary','huddled-restraint','huddled-compulsion'];
export const civicStart = {x:44,y:71};
export const civicRoutes = {
    'Main Street': [[44,71],[72,71]],
    'Chapel Road': [[44,71],[44,67],[72,67],[72,71]],
    'Rail Approach': [[58,71],[58,88],[64,88]],
    'Works Road': [[64,88],[82,88],[82,86]],
    'Civic Back Road': [[82,86],[82,78],[72,78],[72,71]],
    'Hospital turnoff': [[72,67],[76,67],[76,62]],
    'School turnoff': [[72,71],[86,71]],
    'Memorial turnoff': [[72,78],[72,82],[70,82]],
    'Bridge turnoff': [[64,88],[64,95],[68,95]],
};
const stops = [
    [44,71,'Fringe Junction','Main Street east · Chapel Road north · Fringe Street west'],
    [58,71,'Main Street','Roxy Cinema · Civic Square east · Rail Yards south'],
    [72,71,'Civic Square','Town Hall · Waterworks south · School east · Hospital north'],
    [64,88,'Rail Yards','Loading gantry · Waterworks east · Bridge south'],
    [82,86,'Waterworks','Pump house · Civic Square north · Rail Yards south'],
    [76,62,'Hospital turnoff','Road closed · Civic Square south'],
    [86,71,'School turnoff','Road closed · Civic Square west'],
    [70,82,'Memorial turnoff','Road closed · Civic Back Road east'],
    [68,95,'Bridge turnoff','Road closed · Rail Yards north'],
];
const landmarks = [
    {id:'roxy',x:62.4,y:75.6,w:4.5,d:2.8,anchor:.39},
    {id:'hall',x:76.7,y:75.5,w:5.2,d:2.9,anchor:.28},
    {id:'rail',x:65,y:84.3,w:4.8,d:1.9,anchor:.20},
    {id:'pump',x:85.9,y:83.7,w:3.8,d:3.1,anchor:.53},
];
export const civicSigns = [
    [57.9,69.4,'MAIN ST'],[70.2,73.7,'CIVIC SQ'],[63.3,89.6,'RAIL YARDS'],[83.8,85.5,'WATERWORKS'],
    [76,61.5,'HOSPITAL RD'],[86.6,71,'SCHOOL RD'],[69.5,82,'MEMORIAL RD'],[68.6,95,'BRIDGE RD'],
].map(([x,y,text])=>({x,y,text}));
export const civicDressingSites = [{x:60,y:71},{x:75,y:71},{x:63,y:88},{x:83,y:86}];
export const huddledPositions = [{x:64.7,y:91.4},{x:66,y:91.9},{x:67.1,y:91.1}];
export const civicHazePools = landmarks.map(({x,y},i)=>
    ({x:x+.7,y:y+1.4,radius:3.4,density:.27,pulse:1.2+i*.8}));

const segments = Object.entries(civicRoutes).flatMap(([name,path])=>
    path.slice(1).map(([bx,by],i)=>{
        const [ax,ay]=path[i];
        return {id:`${name} ${i+1}`,axis:ax===bx?'y':'x',from:{x:ax,y:ay},to:{x:bx,y:by},
            halfWidth:name==='Chapel Road'||name.endsWith('turnoff')?0:1};
    }));
const yards = [
    {minX:59,maxX:66,minY:73,maxY:78,material:'cinema'},
    {minX:73,maxX:80,minY:73,maxY:77,material:'square'},
    {minX:61,maxX:69,minY:82,maxY:87,material:'ballast'},
    {minX:62,maxX:70,minY:90,maxY:93,material:'ballast'},
    {minX:83,maxX:90,minY:81,maxY:87,material:'works'},
];
const key=(x,y)=>`${x},${y}`;
const cells=new Map(compileStreetLayout({streets:segments}).cells.map(c=>[key(c.x,c.y),c]));
for (const yard of yards) {
    for (let x=yard.minX; x<=yard.maxX; x++) for (let y=yard.minY; y<=yard.maxY; y++) {
        if (cells.get(key(x,y))?.role!=='road') cells.set(key(x,y),{x,y,role:'yard',material:yard.material});
    }
}
export const civicStreetCells=[...cells.values()].filter(c=>c.x>=44);

function distanceToBox(x,y,{minX,maxX,minY,maxY}) {
    return Math.hypot(Math.max(minX-x,x-maxX,0),Math.max(minY-y,y-maxY,0));
}

export function civicExposure(x,y) {
    let distance=Infinity;
    for (const {from,to,halfWidth} of segments) {
        const edge=halfWidth+.5;
        const dx=Math.max(Math.min(from.x,to.x)-edge-x,x-Math.max(from.x,to.x)-edge,0);
        const dy=Math.max(Math.min(from.y,to.y)-edge-y,y-Math.max(from.y,to.y)-edge,0);
        distance=Math.min(distance,Math.hypot(dx,dy));
    }
    for (const yard of yards) distance=Math.min(distance,distanceToBox(x,y,yard));
    return Math.max(0,distance-1.75);
}

export function civicLocation(x,y) {
    let distance=5,label='Civic Loop · Follow the paved roads';
    for (const [sx,sy,name,guide] of stops) {
        const next=Math.hypot(sx-x,sy-y);
        if (next<distance) {
            distance=next;
            label=`${name} · ${guide}`;
        }
    }
    return label;
}

export function civicStrikeClear(x,y,targetX,targetY,isBlockedAt) {
    const samples=Math.ceil(Math.hypot(targetX-x,targetY-y)*8);
    for (let i=1;i<samples;i++) {
        const t=i/samples;
        if (isBlockedAt(x+(targetX-x)*t,y+(targetY-y)*t)) return false;
    }
    return true;
}

export function prepareCivicTown(world,structureBounds) {
    const overlaps=({minX,maxX,minY,maxY})=>{
        for (let x=Math.max(44,Math.ceil(minX-.7));x<=Math.floor(maxX+.7);x++) {
            for (let y=Math.ceil(minY-.7);y<=Math.floor(maxY+.7);y++) {
                if (cells.has(key(x,y))) return true;
            }
        }
        return false;
    };
    world.structures=world.structures.filter(s=>
        s.type==='governedHouseA'||s.type==='northFringeHouse'||!overlaps(structureBounds(s)));
    for (const [field,radius] of [
        ['props',p=>.6*(p.scale||1)],['trees',p=>.6*(p.height||1)],['fencePosts',()=>.35],
    ]) {
        world[field]=world[field].filter(p=>{
            const r=p.collisionRadius??radius(p);
            return !overlaps({minX:p.x-r,maxX:p.x+r,minY:p.y-r,maxY:p.y+r});
        });
    }
    world.structures.push(...landmarks.map(({x,y,w,d,...art})=>({
        ...art,type:'civicLandmark',x:x+w/2,y:y+d/2,w,d,
        collisionBounds:{minX:-w,maxX:0,minY:-d,maxY:0},
    })));
}

const CHUNK=8;
const paving = {
    cinema:['#60625c','#797971','#555952','concrete'],
    square:['#73746b','#818478','#505852','concrete'],
    ballast:['#55534a','#716c5e','#454743',undefined],
    works:['#595e5d','#6b7371','#464c4b','concrete'],
};
function grit(x,y,i) {
    const hash=Math.imul(x*317+i*131,374761393)^Math.imul(y*109-i*27,668265263);
    return (Math.imul(hash^(hash>>>13),1274126177)>>>0)/4294967296;
}

export function buildCivicGround() {
    const chunks=new Map();
    const chunkAt=(x,y)=>{
        const cx=Math.floor(x/CHUNK)*CHUNK,cy=Math.floor(y/CHUNK)*CHUNK,k=key(cx,cy);
        if (!chunks.has(k)) chunks.set(k,{x:cx,y:cy,slabs:[],cells:[]});
        return chunks.get(k);
    };
    const rect=(slabs,x0,y0,x1,y1,fill,material)=>slabs.push({x0,y0,x1,y1,fill,material});
    const verges=new Map();
    for (const {x,y} of civicStreetCells) {
        for (let dx=-2;dx<=2;dx++) for (let dy=-2;dy<=2;dy++) {
            const distance=Math.hypot(dx,dy),px=x+dx,py=y+dy,k=key(px,py);
            if (distance<=2.25 && px>=47 && !cells.has(k) && distance<(verges.get(k)?.distance??Infinity)) {
                verges.set(k,{x:px,y:py,distance});
            }
        }
    }
    for (const {x,y,distance} of verges.values()) {
        const {slabs}=chunkAt(x,y),inner=distance<=1.5;
        const color=grit(x,y,2)>.5?'61,61,50':'71,65,51';
        rect(slabs,x-.5,y-.5,x+.5,y+.5,`rgba(${color},${inner?.56:.25})`);
        for (let i=0;i<(inner?23:9);i++) {
            const px=x-.46+grit(x,y,10+i)*.91,py=y-.45+grit(x,y,44+i)*.9;
            rect(slabs,px,py,px+.04+grit(x,y,75+i)*.08,py+.024,i%3?'rgba(117,111,84,.29)':'rgba(25,26,22,.4)');
        }
    }
    const roadSlabs=fringeStreetGround({cells:civicStreetCells,lots:[]},null,null,[],[]);
    for (const slab of roadSlabs) chunkAt(slab.x0+.5,slab.y0+.5).slabs.push(slab);
    for (const cell of civicStreetCells) {
        const {x,y,role,material}=cell;
        const chunk=chunkAt(x,y),{slabs}=chunk;
        if (role!=='yard') {
            chunk.cells.push(cell);
            if (role==='road' && grit(x,y,33)<.66) continue;
            const px=x-.30+grit(x,y,8)*.53,py=y-.30+grit(x,y,11)*.53;
            const stain=role==='road'?'rgba(21,27,29,.26)':'rgba(54,51,40,.30)';
            rect(slabs,px-.13,py-.13,px+.13,py+.13,stain);
            for (let i=0;i<6;i++) {
                const dx=px+(grit(x,y,45+i)-.5)*.33,dy=py+(grit(x,y,66+i)-.5)*.26;
                rect(slabs,dx,dy,dx+.036,dy+.018,i%2?'#777266':'#373b36');
            }
            continue;
        }
        const [base,light,dark,texture]=paving[material];
        rect(slabs,x-.5,y-.5,x+.5,y+.5,dark);
        rect(slabs,x-.477,y-.477,x+.477,y+.477,(x+y)%3?base:light,texture);
        if (material==='ballast') {
            for (let i=0;i<13;i++) {
                const px=x-.44+grit(x,y,i)*.83,py=y-.43+grit(x,y,i+14)*.87;
                rect(slabs,px,py,px+.06,py+.04,i%3?light:dark);
            }
            if (y===86 || y===91) {
                rect(slabs,x-.5,y-.36,x+.5,y-.30,'#878379');
                rect(slabs,x-.5,y+.30,x+.5,y+.36,'#878379');
                for (const offset of [-.28,.13]) rect(slabs,x+offset,y-.41,x+offset+.11,y+.41,'#514438');
            }
        }
        if (material==='square' && (x===74 || y===73)) {
            rect(slabs,x-.43,y-.043,x+.43,y+.043,'#9a9580');
            rect(slabs,x-.043,y-.43,x+.043,y+.43,'#9a9580');
        }
    }
    for (const [x,y] of stops.slice(5)) {
        const {slabs}=chunkAt(x,y);
        for (let i=-2;i<=2;i++) rect(slabs,x+i*.15-.06,y-.31,x+i*.15+.06,y+.31,'#aa9876');
    }
    return [...chunks.values()].map(chunk=>({
        ...chunk,altered:Object.fromEntries(['restraint','compulsion'].map(side=>
            [side,alteredFringeGround(chunk.slabs,chunk,side)])),
    }));
}

export function drawCivicGround(ctx,chunks,project,cam,images,event,view) {
    for (const {x,y,slabs,altered} of chunks) {
        const left=project(x-1,y+CHUNK+1),right=project(x+CHUNK+1,y-1);
        const top=project(x-1,y-1),bottom=project(x+CHUNK+1,y+CHUNK+1);
        if (left.x+cam.x>view.width || right.x+cam.x<0 || top.y+cam.y>view.height || bottom.y+cam.y<0) continue;
        const variant=altered[event.polarity],amount=variant?event.intensity:0;
        if (amount<1) drawFringeGround(ctx,slabs,project,cam,images);
        if (amount>0) {
            ctx.save();
            ctx.globalAlpha*=amount;
            drawFringeGround(ctx,variant,project,cam,images);
            ctx.restore();
        }
    }
}

export function drawCivicLandmark(ctx,sx,sy,s,image,event) {
    if (!image) return;
    const width=(s.w+s.d)*32,height=width*image.height/image.width,i=event.intensity;
    ctx.save();
    if (event.polarity==='restraint') ctx.filter=`saturate(${1-.8*i}) brightness(${1-.26*i})`;
    else if (event.polarity==='compulsion') {
        ctx.filter=`sepia(${.46*i}) hue-rotate(${-24*i}deg) saturate(${1+.5*i}) brightness(${1-.11*i})`;
    }
    ctx.drawImage(image,sx-width*s.anchor,sy-height,width,height);
    ctx.restore();
}

export function drawCivicSign(ctx,x,y,{text},event) {
    ctx.fillStyle='rgba(10,14,13,.45)';
    ctx.beginPath();
    ctx.ellipse(x+2,y,7,2.6,0,0,Math.PI*2);
    ctx.fill();
    ctx.fillStyle='#55564d';
    ctx.fillRect(x-1.4,y-27,2.8,27);
    ctx.font='bold 7px monospace';
    ctx.textAlign='center';
    const width=ctx.measureText(text).width+8;
    ctx.fillStyle=event.polarity==='compulsion'?'#543c32':'#394443';
    ctx.fillRect(x-width/2,y-29,width,11);
    ctx.strokeStyle='#77786c';
    ctx.strokeRect(x-width/2,y-29,width,11);
    ctx.fillStyle='#d1c6a5';
    ctx.fillText(text,x,y-21);
}

export function civicHuddledPose(huddle,time,phase) {
    if (huddle.attack>0) {
        const charge=1-huddle.attack/huddle.windup;
        return {x:-huddle.side*charge*2,y:charge,lean:-huddle.side*charge*.07,width:1-charge*.20,height:1-charge*.14};
    }
    if (huddle.recover>0) {
        const reach=huddle.recover/.28;
        return {x:huddle.side*reach*6,y:0,lean:huddle.side*reach*.13,width:1+reach*.16,height:1-reach*.08};
    }
    if (huddle.moving) {
        const step=huddle.stride/.7*Math.PI*2;
        return {x:Math.sin(step)*1.3,y:-Math.abs(Math.sin(step))*2.3,
            lean:Math.sin(step)*.065,width:1,height:1+Math.cos(step)*.026};
    }
    return {x:0,y:0,lean:Math.sin(time*1.2+phase)*.021,width:1,height:1};
}
