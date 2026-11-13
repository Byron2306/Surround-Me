import { compileStreetLayout } from './street-layout.mjs';
import { loadVariant } from './house-variant-runtime.mjs';
import { prepareHouseRuntime } from './house-runtime-alpha.mjs';

export function residentialCrossroadSpec(cx=50,cy=50) {
  if (!Number.isInteger(cx) || !Number.isInteger(cy)) throw new Error('review_center_must_be_integer');
  return {
    tileMeters:2,
    streets:[
      {id:'residential-ew',axis:'x',from:{x:cx-8,y:cy},to:{x:cx+8,y:cy},halfWidth:1},
      {id:'residential-ns',axis:'y',from:{x:cx,y:cy-8},to:{x:cx,y:cy+8},halfWidth:1},
    ],
    residential:{
      streetId:'residential-ew',
      side:'north',
      lotDepth:6,
      lotWidth:5,
      setback:2,
    },
  };
}

export function streetReviewLayout(cx=50,cy=50) {
  return compileStreetLayout(residentialCrossroadSpec(cx,cy));
}

export function streetReviewCells(cx=50,cy=50) {
  return streetReviewLayout(cx,cy).cells;
}

export function reviewHousePlacements(layout) {
  return (layout.lots??[]).map((lot,index)=>({
    lotId:lot.id,
    houseKind:index%2===0?'A01':'A02',
    x:lot.houseSocket.x,
    y:lot.houseSocket.y,
    facing:lot.houseSocket.facing,
    driveway:{...lot.driveway},
  }));
}

export function computeReviewFit(layout,placements,houses,width,height,cx=50,cy=50,margin=28) {
  const points=[];
  const push=(x,y)=>points.push({x,y});

  for(const cell of layout.cells??[]){
    const p=project(cell.x,cell.y,cx,cy,0,0,1);
    push(p.x-TILE_W/2,p.y-TILE_H/2);
    push(p.x+TILE_W/2,p.y+TILE_H/2);
  }

  for(const placement of placements??[]){
    const asset=houses?.[placement.houseKind];
    if(!asset?.visibleBounds)continue;
    const p=project(placement.x,placement.y,cx,cy,0,0,1);
    push(p.x+asset.visibleBounds.minX,p.y+asset.visibleBounds.minY);
    push(p.x+asset.visibleBounds.maxX,p.y+asset.visibleBounds.maxY);
  }

  if(!points.length) return {zoom:1,originX:width/2,originY:height/2,bounds:{minX:0,maxX:0,minY:0,maxY:0}};
  const minX=Math.min(...points.map(p=>p.x));
  const maxX=Math.max(...points.map(p=>p.x));
  const minY=Math.min(...points.map(p=>p.y));
  const maxY=Math.max(...points.map(p=>p.y));
  const sceneW=Math.max(1,maxX-minX);
  const sceneH=Math.max(1,maxY-minY);
  const zoom=Math.min((width-margin*2)/sceneW,(height-margin*2)/sceneH);
  const originX=margin-minX*zoom+(width-margin*2-sceneW*zoom)/2;
  const originY=margin-minY*zoom+(height-margin*2-sceneH*zoom)/2;
  return {zoom,originX,originY,bounds:{minX,maxX,minY,maxY}};
}

export function reviewPresentation(search='') {
  const q=new URLSearchParams(search.startsWith('?')?search.slice(1):search);
  const v=(q.get('debug')??'').toLowerCase();
  return {debug:v==='1' || v==='true' || v==='yes'};
}

export function curbRenderProfile(cell) {
  if(cell?.module==='curb-driveway') return {raised:false,gutter:false,ramp:true};
  return {raised:true,gutter:Boolean(cell?.gutterEdge),ramp:false};
}

export function depthKey(item) {
  if(!item) return -Infinity;
  if(Number.isFinite(item.depth)) return item.depth;
  if(Number.isFinite(item.x) && Number.isFinite(item.y)) return item.x + item.y;
  return -Infinity;
}

export function houseProjectionConformance(points,tolerance=0.08) {
  if(!points?.left || !points?.right || !points?.rear) return {status:'REFUSE',reason:'points_required'};
  const slope=(a,b)=>{
    const dx=b.x-a.x,dy=b.y-a.y;
    if(Math.abs(dx)<1e-9) return Infinity;
    return dy/dx;
  };
  const front=slope(points.left,points.right);
  const side=slope(points.left,points.rear);
  const expectedFront=0.5;
  const expectedSide=-0.5;
  const frontError=Math.abs(front-expectedFront);
  const sideError=Math.abs(side-expectedSide);
  return {
    status:(frontError<=tolerance && sideError<=tolerance)?'PASS':'REFUSE',
    frontSlope:front,
    sideSlope:side,
    expectedFront,
    expectedSide,
    tolerance,
    frontError,
    sideError,
  };
}

export function buildElevatedRenderables(layout,placements) {
  const items=[];
  for(const cell of layout.cells??[]){
    if(cell.role!=='curb') continue;
    const profile=curbRenderProfile(cell);
    if(profile.raised || profile.ramp || profile.gutter){
      items.push({kind:'curb-face',cell,x:cell.x,y:cell.y,depth:cell.x+cell.y});
    }
  }
  for(const placement of placements??[]){
    items.push({kind:'house',placement,x:placement.x,y:placement.y,depth:placement.x+placement.y});
  }
  return items;
}

const TILE_W=64;
const TILE_H=32;

function project(x,y,cx,cy,originX,originY,zoom) {
  return {
    x:originX+((x-cx)-(y-cy))*(TILE_W/2)*zoom,
    y:originY+((x-cx)+(y-cy))*(TILE_H/2)*zoom,
  };
}

function diamondPath(ctx,x,y,zoom) {
  const hw=(TILE_W/2)*zoom;
  const hh=(TILE_H/2)*zoom;
  ctx.beginPath();
  ctx.moveTo(x,y-hh);
  ctx.lineTo(x+hw,y);
  ctx.lineTo(x,y+hh);
  ctx.lineTo(x-hw,y);
  ctx.closePath();
}

function groundTone(x,y) {
  const n=((x*73856093)^(y*19349663))>>>0;
  const v=(n%17)-8;
  return `rgb(${48+v},${44+Math.floor(v*.6)},${38+Math.floor(v*.35)})`;
}

function drawGroundDiamond(ctx,x,y,zoom,worldX,worldY) {
  diamondPath(ctx,x,y,zoom);
  ctx.fillStyle=groundTone(worldX,worldY);
  ctx.fill();
  ctx.strokeStyle='rgba(20,18,16,0.08)';
  ctx.lineWidth=Math.max(.5,.65*zoom);
  ctx.stroke();
}

function drawTexturedDiamond(ctx,img,x,y,zoom,fallback) {
  diamondPath(ctx,x,y,zoom);
  ctx.save();
  ctx.clip();
  if (img?.complete && img.naturalWidth>0) {
    const hw=(TILE_W/2)*zoom;
    const hh=(TILE_H/2)*zoom;
    ctx.drawImage(img,x-hw,y-hh,hw*2,hh*2);
  } else {
    ctx.fillStyle=fallback;
    ctx.fillRect(x-TILE_W*zoom/2,y-TILE_H*zoom/2,TILE_W*zoom,TILE_H*zoom);
  }
  ctx.restore();
}


// =========================================================
// GREYLINE V3: WORLD-SPACE MATERIAL ENGINE
// =========================================================
//
// One tile = 2 metres.
// Projection = 64x32 pixels.
//
// Materials are sampled in world coordinates and projected
// through the same affine transform as the civil geometry.
//
// Geometry is never inferred from the texture.
// =========================================================

export function greylineMaterialConfig(search='') {
  const q = new URLSearchParams(
    search.startsWith('?') ? search.slice(1) : search
  );

  const number = (key, fallback, min, max) => {
    const raw = q.get(key);
    if (raw === null) return fallback;
    const value = Number(raw);
    return Number.isFinite(value)
      ? Math.max(min, Math.min(max, value))
      : fallback;
  };

  return {
    surface: q.get('surface') === 'legacy'
      ? 'legacy'
      : 'greyline',

    asphaltMeters: number('asphaltMeters', 24, 4, 96),
    concreteMeters: number('concreteMeters', 12, 2, 48),

    markings: q.get('markings') === 'on',
    markingInterval: Math.round(
      number('markingInterval', 5, 2, 20)
    ),

    materialDebug: q.get('materialDebug') === '1'
  };
}

export function greylineMaterialTransform(
  tileMeters,
  materialMeters,
  zoom,
  cx,
  cy,
  originX,
  originY,
  imageWidth,
  imageHeight
) {
  if (!(tileMeters > 0 && materialMeters > 0 &&
        zoom > 0 && imageWidth > 0 && imageHeight > 0)) {
    throw new Error('invalid_material_transform');
  }

  const tilesPerRepeat = materialMeters / tileMeters;

  // A source image covers a physical square of
  // materialMeters x materialMeters.
  //
  // x world axis: (+32,+16) pixels per tile
  // y world axis: (-32,+16) pixels per tile

  const sx = tilesPerRepeat / imageWidth;
  const sy = tilesPerRepeat / imageHeight;

  return {
    a:  TILE_W / 2 * zoom * sx,
    b:  TILE_H / 2 * zoom * sx,
    c: -TILE_W / 2 * zoom * sy,
    d:  TILE_H / 2 * zoom * sy,

    e: originX - (cx - cy) * TILE_W / 2 * zoom,
    f: originY - (cx + cy) * TILE_H / 2 * zoom
  };
}

function drawWorldMaterial(
  ctx,
  image,
  x,
  y,
  zoom,
  materialMeters,
  tileMeters,
  cx,
  cy,
  originX,
  originY,
  fallback
) {
  diamondPath(ctx,x,y,zoom);

  ctx.save();
  ctx.clip();

  if (!image?.complete || image.naturalWidth <= 0) {
    ctx.fillStyle = fallback;
    ctx.fillRect(
      x-TILE_W*zoom/2,
      y-TILE_H*zoom/2,
      TILE_W*zoom,
      TILE_H*zoom
    );
    ctx.restore();
    return;
  }

  const pattern = ctx.createPattern(image,'repeat');

  if (!pattern || typeof pattern.setTransform !== 'function') {
    ctx.fillStyle = fallback;
  } else {
    const t = greylineMaterialTransform(
      tileMeters,
      materialMeters,
      zoom,
      cx,
      cy,
      originX,
      originY,
      image.naturalWidth,
      image.naturalHeight
    );

    pattern.setTransform(
      new DOMMatrix([t.a,t.b,t.c,t.d,t.e,t.f])
    );

    ctx.fillStyle = pattern;
  }

  ctx.fillRect(
    x-TILE_W*zoom/2,
    y-TILE_H*zoom/2,
    TILE_W*zoom,
    TILE_H*zoom
  );

  ctx.restore();
}

function greylineHash(x,y) {
  let n = Math.imul(x,73856093) ^
          Math.imul(y,19349663);
  n = Math.imul(n ^ (n >>> 16), 2246822519);
  return (n ^ (n >>> 13)) >>> 0;
}

export function shouldDrawGreylineMarking(cell,interval=5) {
  if (!cell || !cell.marking ||
      cell.marking === 'none' ||
      cell.marking === 'junction') return false;

  if (cell.marking === 'centerline-ew') {
    return ((cell.x % interval)+interval)%interval === 0;
  }

  if (cell.marking === 'centerline-ns') {
    return ((cell.y % interval)+interval)%interval === 0;
  }

  return false;
}

function drawGreylineMarking(ctx,x,y,zoom,cell) {
  const hw=TILE_W/2*zoom;
  const hh=TILE_H/2*zoom;

  ctx.save();

  ctx.strokeStyle='rgba(160,145,96,0.48)';
  ctx.lineWidth=Math.max(1,1.35*zoom);
  ctx.setLineDash([]);

  const draw=(x1,y1,x2,y2)=>{
    ctx.beginPath();
    ctx.moveTo(x1,y1);
    ctx.lineTo(x2,y2);
    ctx.stroke();
  };

  if(cell.marking==='centerline-ew'){
    draw(
      x-hw*.72,y+hh*.72,
      x+hw*.72,y-hh*.72
    );
  }

  if(cell.marking==='centerline-ns'){
    draw(
      x-hw*.72,y-hh*.72,
      x+hw*.72,y+hh*.72
    );
  }

  ctx.restore();
}

// =========================================================
// GREYLINE V4: RESIDENTIAL LAND-USE
// =========================================================
//
// This layer is visual only.
// It does not modify road cells, lot geometry or collision.
// =========================================================

function landHash(x,y,salt=0){
  let n=Math.imul(x+salt,73856093)^Math.imul(y-salt,19349663);
  n=Math.imul(n^(n>>>16),2246822519);
  return (n^(n>>>13))>>>0;
}

function landTone(x,y){
  const n=landHash(x,y);
  const variation=n%17;

  const r=45+variation;
  const g=47+Math.floor(variation*.8);
  const b=42+Math.floor(variation*.5);

  return `rgb(${r},${g},${b})`;
}


function drawLandBase(ctx,width,height){
  ctx.fillStyle='#34372f';
  ctx.fillRect(0,0,width,height);
}

function drawContinuousTerrain(
  ctx,image,width,height,
  cx,cy,originX,originY,zoom
){
  if(!image?.complete || image.naturalWidth<=0)return;

  const pattern=ctx.createPattern(image,'repeat');
  if(!pattern?.setTransform)return;

  const t=greylineMaterialTransform(
    2,32,zoom,cx,cy,originX,originY,
    image.naturalWidth,image.naturalHeight
  );

  pattern.setTransform(
    new DOMMatrix([t.a,t.b,t.c,t.d,t.e,t.f])
  );

  ctx.save();
  ctx.globalAlpha=.34;
  ctx.fillStyle=pattern;
  ctx.fillRect(0,0,width,height);
  ctx.restore();
}

function drawResidentialParcel(
  ctx,lot,cx,cy,originX,originY,zoom
){
  const b=lot.bounds;
  if(!b)return;

  const corners=[
    [b.minX-.5,b.minY-.5],
    [b.maxX+.5,b.minY-.5],
    [b.maxX+.5,b.maxY+.5],
    [b.minX-.5,b.maxY+.5]
  ].map(([x,y])=>
    project(x,y,cx,cy,originX,originY,zoom)
  );

  ctx.save();
  ctx.beginPath();
  ctx.moveTo(corners[0].x,corners[0].y);

  for(const p of corners.slice(1)){
    ctx.lineTo(p.x,p.y);
  }

  ctx.closePath();
  ctx.fillStyle='rgba(88,80,61,.22)';
  ctx.fill();
  ctx.restore();
}
function drawRoadsideNeglect(
  ctx,layout,cx,cy,originX,originY,zoom
){
  const road=new Set(
    layout.cells
      .filter(c=>c.role==='road')
      .map(c=>`${c.x},${c.y}`)
  );

  const sidewalk=layout.cells.filter(
    c=>c.role==='sidewalk'
  );

  ctx.save();

  for(const cell of sidewalk){
    const n=landHash(cell.x,cell.y,17);

    // Sparse, deterministic vegetation.
    if(n%11!==0)continue;

    const x=cell.x;
    const y=cell.y;

    // Never place vegetation on a road cell.
    if(road.has(`${x},${y}`))continue;

    const p=project(
      x,y,cx,cy,originX,originY,zoom
    );

    const ox=((n>>>8)%13-6)*zoom;
    const oy=((n>>>16)%7-3)*zoom;

    ctx.strokeStyle='rgba(64,78,49,0.54)';
    ctx.lineWidth=Math.max(.6,.7*zoom);

    for(let i=0;i<3;i++){
      const dx=(i-1)*2.5*zoom;

      ctx.beginPath();
      ctx.moveTo(p.x+ox,p.y+oy);
      ctx.lineTo(
        p.x+ox+dx,
        p.y+oy-(3+i)*zoom
      );
      ctx.stroke();
    }
  }

  ctx.restore();
}
function roadMarking(ctx,x,y,zoom,cell) {
  const hw=(TILE_W/2)*zoom;
  const hh=(TILE_H/2)*zoom;
  ctx.save();
  ctx.strokeStyle='rgba(201,154,48,0.95)';
  ctx.lineWidth=Math.max(2,2.2*zoom);
  ctx.setLineDash([Math.max(5,7*zoom),Math.max(4,6*zoom)]);

  const draw=(x1,y1,x2,y2)=>{
    ctx.beginPath();
    ctx.moveTo(x1,y1);
    ctx.lineTo(x2,y2);
    ctx.stroke();
  };

  if(cell.marking==='junction' || cell.marking==='none') {
    ctx.restore();
    return;
  }

  if(cell.marking==='centerline-ew') {
    draw(x-hw*0.74,y+hh*0.74,x+hw*0.74,y-hh*0.74);
  } else if(cell.marking==='centerline-ns') {
    draw(x-hw*0.74,y-hh*0.74,x+hw*0.74,y+hh*0.74);
  }

  ctx.restore();
}

function gutterAndDrain(ctx,x,y,zoom,cell) {
  const side=cell.gutterEdge;
  if(!side)return;
  const hw=(TILE_W/2)*zoom;
  const hh=(TILE_H/2)*zoom;
  const inset=Math.max(2,3*zoom);
  const edges={
    n:[[x,y-hh+inset],[x+hw-inset*2,y-inset]],
    e:[[x+hw-inset*2,y+inset],[x,y+hh-inset]],
    s:[[x,y+hh-inset],[x-hw+inset*2,y+inset]],
    w:[[x-hw+inset*2,y-inset],[x,y-hh+inset]],
  };
  const edge=edges[side];
  if(!edge)return;
  const [[x1,y1],[x2,y2]]=edge;

  ctx.strokeStyle='rgba(24,25,26,0.85)';
  ctx.lineWidth=Math.max(2,2.4*zoom);
  ctx.beginPath();
  ctx.moveTo(x1,y1);
  ctx.lineTo(x2,y2);
  ctx.stroke();

  if(!cell.stormDrain)return;
  const mx=(x1+x2)/2, my=(y1+y2)/2;
  const dx=x2-x1, dy=y2-y1;
  const len=Math.hypot(dx,dy)||1;
  const ux=dx/len, uy=dy/len;
  const px=-uy, py=ux;
  const half=Math.max(5,5.5*zoom);
  const depth=Math.max(2,2.6*zoom);

  ctx.fillStyle='rgba(18,19,20,0.98)';
  ctx.beginPath();
  ctx.moveTo(mx-ux*half-px*depth,my-uy*half-py*depth);
  ctx.lineTo(mx+ux*half-px*depth,my+uy*half-py*depth);
  ctx.lineTo(mx+ux*half+px*depth,my+uy*half+py*depth);
  ctx.lineTo(mx-ux*half+px*depth,my-uy*half+py*depth);
  ctx.closePath();
  ctx.fill();

  ctx.strokeStyle='rgba(92,94,94,0.95)';
  ctx.lineWidth=Math.max(0.8,0.8*zoom);
  for(let i=-2;i<=2;i++){
    const along=i*(half/2.4);
    ctx.beginPath();
    ctx.moveTo(mx+ux*along-px*depth,my+uy*along-py*depth);
    ctx.lineTo(mx+ux*along+px*depth,my+uy*along+py*depth);
    ctx.stroke();
  }
}

function drivewayCurbRamp(ctx,x,y,zoom,side) {
  const hw=(TILE_W/2)*zoom;
  const hh=(TILE_H/2)*zoom;
  const edges={
    n:[[x,y-hh],[x+hw,y]],
    e:[[x+hw,y],[x,y+hh]],
    s:[[x,y+hh],[x-hw,y]],
    w:[[x-hw,y],[x,y-hh]],
  };
  const edge=edges[side];
  if(!edge)return;
  const [[x1,y1],[x2,y2]]=edge;
  ctx.save();
  ctx.strokeStyle='rgba(86,84,80,0.9)';
  ctx.lineWidth=Math.max(2,2.4*zoom);
  ctx.beginPath();
  ctx.moveTo(x1,y1);
  ctx.lineTo(x2,y2);
  ctx.stroke();
  ctx.strokeStyle='rgba(154,150,142,0.45)';
  ctx.lineWidth=Math.max(.8,.9*zoom);
  ctx.beginPath();
  ctx.moveTo(x1,y1-1.2*zoom);
  ctx.lineTo(x2,y2-1.2*zoom);
  ctx.stroke();
  ctx.restore();
}

function curbEdge(ctx,x,y,zoom,side) {
  const hw=(TILE_W/2)*zoom;
  const hh=(TILE_H/2)*zoom;
  const lift=Math.max(3,4*zoom);
  const edges={
    n:[[x,y-hh],[x+hw,y]],
    e:[[x+hw,y],[x,y+hh]],
    s:[[x,y+hh],[x-hw,y]],
    w:[[x-hw,y],[x,y-hh]],
  };
  const edge=edges[side];
  if(!edge)return;
  const [[x1,y1],[x2,y2]]=edge;

  // vertical concrete face
  ctx.fillStyle='rgba(38,38,40,0.92)';
  ctx.beginPath();
  ctx.moveTo(x1,y1);
  ctx.lineTo(x2,y2);
  ctx.lineTo(x2,y2-lift);
  ctx.lineTo(x1,y1-lift);
  ctx.closePath();
  ctx.fill();

  // worn top lip
  ctx.strokeStyle='rgba(150,148,142,0.9)';
  ctx.lineWidth=Math.max(1,1.25*zoom);
  ctx.beginPath();
  ctx.moveTo(x1,y1-lift);
  ctx.lineTo(x2,y2-lift);
  ctx.stroke();
}

function drawLotOverlay(ctx,lot,cx,cy,originX,originY,zoom) {
  const min=project(lot.bounds.minX,lot.bounds.minY,cx,cy,originX,originY,zoom);
  const max=project(lot.bounds.maxX+1,lot.bounds.maxY+1,cx,cy,originX,originY,zoom);
  const a=project(lot.bounds.minX,lot.bounds.minY,cx,cy,originX,originY,zoom);
  const b=project(lot.bounds.maxX+1,lot.bounds.minY,cx,cy,originX,originY,zoom);
  const d=project(lot.bounds.minX,lot.bounds.maxY+1,cx,cy,originX,originY,zoom);
  const e=project(lot.bounds.maxX+1,lot.bounds.maxY+1,cx,cy,originX,originY,zoom);

  ctx.save();
  ctx.strokeStyle='rgba(176,160,118,0.78)';
  ctx.lineWidth=Math.max(1,1.1*zoom);
  ctx.setLineDash([6*zoom,4*zoom]);
  ctx.beginPath();
  ctx.moveTo(a.x,a.y);
  ctx.lineTo(b.x,b.y);
  ctx.lineTo(e.x,e.y);
  ctx.lineTo(d.x,d.y);
  ctx.closePath();
  ctx.stroke();
  ctx.setLineDash([]);

  const hs=project(lot.houseSocket.x,lot.houseSocket.y,cx,cy,originX,originY,zoom);
  ctx.fillStyle='rgba(184,211,191,0.95)';
  ctx.beginPath();
  ctx.arc(hs.x,hs.y,Math.max(3,3.5*zoom),0,Math.PI*2);
  ctx.fill();

  const dw=project(lot.driveway.curbX,lot.driveway.curbY,cx,cy,originX,originY,zoom);
  ctx.fillStyle='rgba(190,160,100,0.95)';
  ctx.fillRect(dw.x-4*zoom,dw.y-2*zoom,8*zoom,4*zoom);

  ctx.fillStyle='rgba(225,218,198,0.92)';
  ctx.font=`${Math.max(9,10*zoom)}px monospace`;
  ctx.textAlign='center';
  ctx.fillText(lot.id,hs.x,hs.y-8*zoom);
  ctx.restore();
}

function loadImage(src) {
  return new Promise(resolve=>{
    const img=new Image();
    img.onload=()=>resolve(img);
    img.onerror=()=>resolve(null);
    img.src=src;
  });
}


async function loadProvisionalA01(){
  const base='./world-art/hd-iso-v1/calibration/';
  const response=await fetch(
    base+'house-a01-provisional.json',
    {cache:'no-store'}
  );

  if(!response.ok){
    throw new Error('A01 provisional manifest missing');
  }

  const manifest=await response.json();

  if(
    manifest.assetId!=='house.a.01.provisional' ||
    manifest.status!=='CALIBRATION_ONLY' ||
    manifest.productionAdmission!=='REFUSE'
  ){
    throw new Error('A01 provisional governance mismatch');
  }

  const imageResponse=await fetch(
    base+'house-a01-provisional-2048.png',
    {cache:'no-store'}
  );

  if(!imageResponse.ok){
    throw new Error('A01 provisional image missing');
  }

  const bytes=await imageResponse.arrayBuffer();

  const digest='sha256:'+Array.from(
    new Uint8Array(
      await crypto.subtle.digest('SHA-256',bytes)
    ),
    v=>v.toString(16).padStart(2,'0')
  ).join('');

  if(digest!==manifest.imageSha256){
    throw new Error('A01 provisional SHA-256 mismatch');
  }

  const image=await createImageBitmap(
    new Blob([bytes],{type:'image/png'})
  );

  if(image.width!==2048 || image.height!==2048){
    image.close();
    throw new Error('A01 provisional dimensions mismatch');
  }

  return {
    image,
    logicalWidth:512,
    logicalHeight:512,
    anchorPixelX:manifest.anchorPixel[0],
    anchorPixelY:manifest.anchorPixel[1],
    label:'A01 PROVISIONAL',
    visibleBounds:{
      minX:-95.5,maxX:144,
      minY:-148.5,maxY:33.25
    },
    doorApproach:{x:-.675,y:.5},
    status:'CALIBRATION_ONLY'
  };
}

async function loadGovernedReviewHouses(){
  const [master,variant]=await Promise.all([
    loadProvisionalA01(),
    loadVariant('./world-art/hd-iso-v1/runtime/')
  ]);

  return {
    A01:master,
    A02:{
      image:variant.image,
      logicalWidth:variant.metadata.logicalWidth,
      logicalHeight:variant.metadata.logicalHeight,
      anchorPixelX:variant.metadata.anchorPixelX,
      anchorPixelY:variant.metadata.anchorPixelY,
      label:'A02 GOVERNED',
      visibleBounds:{
        minX:-59.5,maxX:156,
        minY:-142.5,maxY:27.25
      },
      doorApproach:{...variant.metadata.doorApproach},
      status:'GOVERNED_HUMAN_REVIEW_PENDING'
    }
  };
}

function drawDriveway(ctx,lot,cx,cy,originX,originY,zoom,concreteImg) {
  const x=lot.driveway.curbX;
  const y0=lot.driveway.curbY;
  const y1=lot.houseSocket.y;
  const step=y1>=y0?1:-1;
  for(let y=y0;y!==y1+step;y+=step){
    const p=project(x,y,cx,cy,originX,originY,zoom);
    drawWorldMaterial(
      ctx,concreteImg,p.x,p.y,zoom,
      12,2,cx,cy,originX,originY,'#514d47'
    );
    diamondPath(ctx,p.x,p.y,zoom);
    ctx.strokeStyle='rgba(70,66,61,0.28)';
    ctx.lineWidth=Math.max(.7,.9*zoom);
    ctx.stroke();
  }
}


function drawEntrancePath(
  ctx,placement,asset,
  cx,cy,originX,originY,zoom,
  debug=false
){
  if(!asset?.doorApproach)return;

  const door={
    x:placement.x+asset.doorApproach.x,
    y:placement.y+asset.doorApproach.y
  };

  // North-side residential lots face south.
  // Connect toward the known driveway/curb approach.
  const destination={
    x:placement.driveway.curbX+asset.doorApproach.x,
    y:placement.driveway.curbY
  };

  const a=project(
    door.x,door.y,cx,cy,originX,originY,zoom
  );

  const b=project(
    destination.x,destination.y,
    cx,cy,originX,originY,zoom
  );

  ctx.save();

  ctx.strokeStyle='rgba(107,100,87,.92)';
  ctx.lineWidth=Math.max(3,5*zoom);
  ctx.lineCap='round';

  ctx.beginPath();
  ctx.moveTo(a.x,a.y);
  ctx.lineTo(b.x,b.y);
  ctx.stroke();

  ctx.strokeStyle='rgba(167,156,132,.46)';
  ctx.lineWidth=Math.max(1,1.2*zoom);
  ctx.stroke();

  if(debug){
    ctx.fillStyle='#d4b86e';
    ctx.beginPath();
    ctx.arc(a.x,a.y,Math.max(3,4*zoom),0,Math.PI*2);
    ctx.fill();

    ctx.fillStyle='#82c9be';
    ctx.beginPath();
    ctx.arc(b.x,b.y,Math.max(3,4*zoom),0,Math.PI*2);
    ctx.fill();
  }

  ctx.restore();
}

function drawGovernedHouse(ctx,placement,asset,cx,cy,originX,originY,zoom,debug=false) {
  if(!asset?.image)return;
  const p=project(placement.x,placement.y,cx,cy,originX,originY,zoom);
  const w=asset.logicalWidth*zoom;
  const h=asset.logicalHeight*zoom;
  ctx.save();
  ctx.drawImage(
    asset.image,
    p.x-asset.anchorPixelX*zoom,
    p.y-asset.anchorPixelY*zoom,
    w,h
  );
  if(debug){
    ctx.fillStyle='rgba(225,218,198,0.92)';
    ctx.font=`${Math.max(9,10*zoom)}px monospace`;
    ctx.textAlign='center';
    ctx.fillText(asset.label,p.x,p.y+16*zoom);
  }
  ctx.restore();
}

export async function renderStreetReview(canvas,options={}) {
  if(!canvas?.getContext) throw new Error('review_canvas_required');
  const cx=options.cx??50;
  const cy=options.cy??50;
  const requestedZoom=options.zoom;
  const layout=streetReviewLayout(cx,cy);
  const material=greylineMaterialConfig(
    typeof location!=='undefined' ? location.search : ''
  );
  const [asphaltImg,concreteImg,dirtImg,houses]=await Promise.all([

    loadImage(
      material.surface==='legacy'
        ? './asphalt1.png'
        : './world-art/greyline-ground/greyline_asphalt_v2_2048.png'
    ),
    loadImage('./concrete.png'),
    loadImage('./asphalt1.png'),
    loadGovernedReviewHouses(),
  ]);

  const rect=canvas.getBoundingClientRect();
  const dpr=Math.max(1,window.devicePixelRatio||1);
  canvas.width=Math.max(1,Math.round(rect.width*dpr));
  canvas.height=Math.max(1,Math.round(rect.height*dpr));
  const ctx=canvas.getContext('2d');
  ctx.setTransform(dpr,0,0,dpr,0,0);
  const width=rect.width;
  const height=rect.height;
  ctx.clearRect(0,0,width,height);
  drawLandBase(ctx,width,height);

  const placements=reviewHousePlacements(layout);
  const fit=requestedZoom
    ? {zoom:requestedZoom,originX:width/2,originY:height*0.46}
    : computeReviewFit(layout,placements,houses,width,height,cx,cy,28);
  const zoom=fit.zoom;
  const originX=fit.originX;
  const originY=fit.originY;
  const cells=[...layout.cells].sort((a,b)=>(a.x+a.y)-(b.x+b.y)||a.y-b.y||a.x-b.x);

  // V5: continuous world-space terrain.
  drawContinuousTerrain(
    ctx,dirtImg,width,height,
    cx,cy,originX,originY,zoom
  );

  // Legal residential parcels are drawn before civil surfaces.
  for(const lot of layout.lots??[]){
    drawResidentialParcel(
      ctx,lot,cx,cy,originX,originY,zoom
    );
  }

  for(const cell of cells){
    const p=project(cell.x,cell.y,cx,cy,originX,originY,zoom);
    if(cell.role==='road'){
      drawWorldMaterial(
        ctx,asphaltImg,p.x,p.y,zoom,
        material.asphaltMeters,layout.tileMeters,
        cx,cy,originX,originY,'#303234'
      );

      if(material.markings &&
         shouldDrawGreylineMarking(
           cell,material.markingInterval
         )){
        drawGreylineMarking(ctx,p.x,p.y,zoom,cell);
      }
    } else {
      drawWorldMaterial(
        ctx,concreteImg,p.x,p.y,zoom,
        material.concreteMeters,layout.tileMeters,
        cx,cy,originX,originY,
        cell.role==='curb'?'#66645f':'#555553'
      );
      // Raised curb faces, gutters and ramps are rendered later in the
      // elevated depth pass so buildings/props can occlude correctly.
    }
  }

  drawRoadsideNeglect(
    ctx,layout,cx,cy,originX,originY,zoom
  );

  const presentation=options.presentation??reviewPresentation(typeof location!=='undefined'?location.search:'');
  for(const lot of layout.lots??[]) {
    drawDriveway(ctx,lot,cx,cy,originX,originY,zoom,concreteImg);
    if(presentation.debug) drawLotOverlay(ctx,lot,cx,cy,originX,originY,zoom);
  }

  for(const placement of placements){
    drawEntrancePath(
      ctx,placement,houses[placement.houseKind],
      cx,cy,originX,originY,zoom,
      presentation.debug
    );
  }

  const elevated=buildElevatedRenderables(layout,placements)
    .sort((a,b)=>depthKey(a)-depthKey(b) || a.kind.localeCompare(b.kind));

  for(const item of elevated){
    if(item.kind==='curb-face'){
      const cell=item.cell;
      const p=project(cell.x,cell.y,cx,cy,originX,originY,zoom);
      const profile=curbRenderProfile(cell);
      if(profile.gutter) gutterAndDrain(ctx,p.x,p.y,zoom,cell);
      for(const side of cell.roadSides??[]){
        if(profile.ramp) drivewayCurbRamp(ctx,p.x,p.y,zoom,side);
        else if(profile.raised) curbEdge(ctx,p.x,p.y,zoom,side);
      }
    } else if(item.kind==='house'){
      const placement=item.placement;
      drawGovernedHouse(ctx,placement,houses[placement.houseKind],cx,cy,originX,originY,zoom,presentation.debug);
    }
  }

  if(presentation.debug){
    ctx.fillStyle='rgba(235,225,205,0.92)';
    ctx.font='14px monospace';
    ctx.textAlign='left';
    ctx.fillText('DETERMINISTIC STREET REVIEW v1',18,26);
    ctx.fillText(`road ${layout.counts.road}  curb ${layout.counts.curb}  sidewalk ${layout.counts.sidewalk}`,18,46);
  }
  const diagnostics={
    lots:layout.lots.length,
    placements:placements.length,
    renderedHouses:placements.filter(
      p=>Boolean(houses[p.houseKind]?.image)
    ).length,
    A01:houses.A01.status,
    A02:houses.A02.status
  };

  window.vergeV5Diagnostics=diagnostics;

  if(diagnostics.renderedHouses!==diagnostics.placements){
    throw new Error(
      'V5 house rendering incomplete: '+
      JSON.stringify(diagnostics)
    );
  }

  return layout;
}
