import {compileStreetLayout} from '../street-layout.mjs';
import {fringeStreetGround,alteredFringeGround,drawFringeGround} from './fringe-street.mjs?v=samsarra-1';
import {residentialCrossroadSpec,streetReviewLayout,reviewHousePlacements} from '../street-layout-review.mjs';
import {buildAccessReview} from './residential-access-v9.mjs?v=91';
import {checkStructure,structureFootprint,nominalParcelBounds} from './residential-admission-v7.mjs';

const A01_IMAGE='./world-art/hd-iso-v1/calibration/house-a01-provisional-2048.png';
const overlaps=(a,b)=>a.minX<=b.maxX && a.maxX>=b.minX && a.minY<=b.maxY && a.maxY>=b.minY;

export async function installSuburbPlaytest({world,structureBounds,variant,variantStructure,loadedImages,isBlockedAt,extraVariants=[]}) {
  let layout=streetReviewLayout(29,71);
  let placements=reviewHousePlacements(layout);
  if (extraVariants.length) {
    const spec=residentialCrossroadSpec(29,71);
    spec.streets[0].from.x=16;
    spec.streets[0].to.x=46;
    layout=compileStreetLayout(spec);
    const kinds=new Map([[19,'A03'],[24,'A01'],[34,'A02'],[39,'A04']]);
    placements=layout.lots.map(l=>({...l.houseSocket,lotId:l.id,houseKind:kinds.get(l.houseSocket.x)}));
    if (placements.length!==4 || placements.some(p=>!p.houseKind)) throw new Error('Fringe Street lot plan changed');
  }
  const a=placements.find(p=>p.houseKind==='A01'), b=placements.find(p=>p.houseKind==='A02');
  if (!a || !b) throw new Error('Expected both residential plots');
  const lot=layout.lots.find(l=>l.id===a.lotId);
  const secondLot=layout.lots.find(l=>l.id===b.lotId);
  if (!lot || !secondLot) throw new Error('Residential lot missing');
  const response=await fetch('./evidence/residential-v8/a01-source-binding.json',{cache:'no-store'});
  if (!response.ok) throw new Error('A-01 source binding missing');
  const source=await response.json();
  const placement={...a,x:a.x-.5};
  const review=buildAccessReview({layout,lot,placement,source});
  if (review.status!=='PASS') throw new Error(review.reason);
  if (checkStructure(layout,secondLot,structureFootprint(b,6,6)).status!=='PASS') throw new Error('A-02 plot clearance refused');

  const extras=extraVariants.map(v=>{
    const kind=v.metadata.variantId==='house.a.03'?'A03':'A04';
    const slot=placements.find(p=>p.houseKind===kind);
    const house=variantStructure(v.metadata,slot.x,slot.y);
    const lot=layout.lots.find(l=>l.id===slot.lotId);
    const bounds=structureFootprint(slot,house.w*2,house.h*2);
    if (checkStructure(layout,lot,bounds).status!=='PASS') throw new Error(kind+' plot clearance refused');
    return {house,image:v.image,lot};
  });
  const image=new Image();
  image.src=A01_IMAGE;
  await image.decode();
  if (image.naturalWidth!==2048 || image.naturalHeight!==2048) throw new Error('A-01 calibration PNG must be 2048 × 2048');
  const bounds=[...layout.cells.map(c=>({minX:c.x-.5,maxX:c.x+.5,minY:c.y-.5,maxY:c.y+.5})),...layout.lots.map(nominalParcelBounds)];
  const area={
    minX:Math.min(...bounds.map(p=>p.minX))-.5,maxX:Math.max(...bounds.map(p=>p.maxX))+.5,
    minY:Math.min(...bounds.map(p=>p.minY))-.5,maxY:Math.max(...bounds.map(p=>p.maxY))+.5,
  };
  world.structures=world.structures.filter(s=>s.label!=='House' || s.type!=='shack')
    .filter(s=>!overlaps(area,structureBounds(s)));
  for (const [field,fallback] of [
    ['props',p=>.6*(p.scale||1)],['trees',p=>.6*(p.height||1)],['fencePosts',()=>.35],
  ]) {
    world[field]=(world[field]??[]).filter(p=>{
      const r=p.collisionRadius??fallback(p);
      return !overlaps(area,{minX:p.x-r,maxX:p.x+r,minY:p.y-r,maxY:p.y+r});
    });
  }
  loadedImages.houseA01Suburb=image;
  loadedImages.houseA02=variant.image;
  world.structures.push({
    ...placement,type:'governedHouseA',asset:'houseA01Suburb',governedTest:true,label:'A-01 · Porch',
    governedSprite:{logicalWidth:512,logicalHeight:512,anchorPixelX:220,anchorPixelY:334},
    collisionBounds:{minX:review.main.minX-placement.x,maxX:review.main.maxX-placement.x,minY:review.main.minY-placement.y,maxY:0},
  },{...variantStructure(variant.metadata,b.x,b.y),governedTest:true,label:'A-02'});

  for (const {house,image} of extras) {
    loadedImages[house.asset]=image;
    world.structures.push(house);
  }

  // Check each additional route against the same runtime blockers.
  const doorPaths=[];
  for (const {house,lot} of extras) {
    const x=house.x+house.doorApproach.x;
    const y=house.y+house.doorApproach.y;
    const {curbX,curbY}=lot.driveway;
    if (!layout.cells.some(c=>c.x===curbX && c.y===curbY && c.module==='curb-driveway') ||
        !layout.cells.some(c=>c.x===curbX && c.y===curbY-1 && c.role==='sidewalk')) {
      throw new Error(house.label+' has no connected driveway');
    }
    const points=[[curbX,curbY],[curbX,curbY-1],[x,curbY-1],[x,y]];
    for (let i=1;i<points.length;i++) {
      const [ax,ay]=points[i-1],[bx,by]=points[i];
      const steps=Math.max(1,Math.ceil(Math.hypot(bx-ax,by-ay)*32));
      for(let n=0;n<=steps;n++){
        if (isBlockedAt(ax+(bx-ax)*n/steps,ay+(by-ay)*n/steps)) throw new Error(house.label+' path is obstructed');
      }
    }
    doorPaths.push({x,y:house.y,toY:curbY-1});
  }

  // Check the actual generated world's remaining blockers as well as the plan.
  for (let i=1;i<review.points.length;i++) {
    const a=review.points[i-1],b=review.points[i];
    const steps=Math.max(1,Math.ceil(Math.hypot(b.x-a.x,b.y-a.y)*32));
    for (let n=0;n<=steps;n++) {
      if (isBlockedAt(a.x+(b.x-a.x)*n/steps,a.y+(b.y-a.y)*n/steps)) throw new Error('Generated world obstructs A-01 access');
    }
  }
  const footprints=world.structures
    .filter(s=>s.asset==='houseA01Suburb' || s.asset==='houseA02' || extras.some(({house})=>house===s))
    .map(structureBounds);
  const ground = fringeStreetGround(layout,{...review,doorPaths},area,footprints);
  const altered = {
    compulsion: alteredFringeGround(ground, layout, 'compulsion'),
    restraint: alteredFringeGround(ground, layout, 'restraint'),
  };
  const mailbox = { x: review.doorX + .85, y: review.porch.maxY + .52 };
  // Visual volumes only. They share the field budget with existing gameplay pools.
  const hazePools = [
    { x: review.doorX - 1.4, y: review.porch.maxY + .85, radius: 1.85, density: .24, pulse: 1.1 },
    { x: 29.4, y: 71.6, radius: 2.65, density: .24, pulse: 2.2 },
    { x: 36.7, y: 70, radius: 2.1, density: .20, pulse: 3.6 },
  ];
  return {...review,layout,area,ground,altered,mailbox,hazePools};
}

export function drawSuburbGround(ctx,review,project,cam,images,event) {
  const variant = review.altered[event.polarity];
  const amount = variant ? event.intensity : 0;
  if (amount < 1) drawFringeGround(ctx,review.ground,project,cam,images);
  if (amount > 0) {
    ctx.save();
    ctx.globalAlpha *= amount;
    drawFringeGround(ctx,variant,project,cam,images);
    ctx.restore();
  }
}
