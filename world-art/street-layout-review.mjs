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

function drawGroundDiamond(ctx,x,y,zoom) {
  diamondPath(ctx,x,y,zoom);
  ctx.fillStyle=groundTone(x,y);
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

async function loadGovernedReviewHouses() {
  const masterRaw=await loadImage('./world-art/hd-iso-v1/runtime/house-master-a-g1-8-governed-2048.png');
  const master=masterRaw ? prepareHouseRuntime(masterRaw,document) : null;
  const variant=await loadVariant('./world-art/hd-iso-v1/runtime/');
  return {
    A01:{
      image:master,
      logicalWidth:512,
      logicalHeight:512,
      anchorPixelX:220,
      anchorPixelY:334,
      label:'A-01',
      visibleBounds:{minX:-95.5,maxX:144,minY:-148.5,maxY:33.25},
    },
    A02:{
      image:variant.image,
      logicalWidth:variant.metadata.logicalWidth,
      logicalHeight:variant.metadata.logicalHeight,
      anchorPixelX:variant.metadata.anchorPixelX,
      anchorPixelY:variant.metadata.anchorPixelY,
      label:'A-02',
      visibleBounds:{minX:-59.5,maxX:156,minY:-142.5,maxY:27.25},
    },
  };
}

function drawDriveway(ctx,lot,cx,cy,originX,originY,zoom) {
  const a=project(lot.driveway.curbX,lot.driveway.curbY,cx,cy,originX,originY,zoom);
  const b=project(lot.houseSocket.x,lot.houseSocket.y,cx,cy,originX,originY,zoom);
  const dx=b.x-a.x,dy=b.y-a.y;
  const len=Math.hypot(dx,dy)||1;
  const px=-dy/len,py=dx/len;
  const half=Math.max(7,8*zoom);
  ctx.save();
  ctx.fillStyle='rgba(73,70,65,0.96)';
  ctx.beginPath();
  ctx.moveTo(a.x+px*half,a.y+py*half);
  ctx.lineTo(a.x-px*half,a.y-py*half);
  ctx.lineTo(b.x-px*half,b.y-py*half);
  ctx.lineTo(b.x+px*half,b.y+py*half);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle='rgba(126,120,110,0.28)';
  ctx.lineWidth=Math.max(1,1.1*zoom);
  ctx.stroke();
  ctx.strokeStyle='rgba(35,34,32,0.28)';
  ctx.lineWidth=Math.max(1,1.2*zoom);
  for(const offset of [-half*.42,half*.42]){
    ctx.beginPath();
    ctx.moveTo(a.x+px*offset,a.y+py*offset);
    ctx.lineTo(b.x+px*offset,b.y+py*offset);
    ctx.stroke();
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
  const [asphaltImg,concreteImg,dirtImg,houses]=await Promise.all([

    loadImage('../asphalt1.png'),
    loadImage('../concrete.png'),
    loadImage('../asphalt1.png'),
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
  ctx.fillStyle='#17191a';
  ctx.fillRect(0,0,width,height);

  const placements=reviewHousePlacements(layout);
  const fit=requestedZoom
    ? {zoom:requestedZoom,originX:width/2,originY:height*0.46}
    : computeReviewFit(layout,placements,houses,width,height,cx,cy,28);
  const zoom=fit.zoom;
  const originX=fit.originX;
  const originY=fit.originY;
  const cells=[...layout.cells].sort((a,b)=>(a.x+a.y)-(b.x+b.y)||a.y-b.y||a.x-b.x);

  // Neutral deterministic terrain underlay. Roads/curbs/sidewalks own their art.
  for(let x=cx-12;x<=cx+12;x++){
    for(let y=cy-12;y<=cy+12;y++){
      const p=project(x,y,cx,cy,originX,originY,zoom);
      drawGroundDiamond(ctx,p.x,p.y,zoom,x,y);
    }
  }

  for(const cell of cells){
    const p=project(cell.x,cell.y,cx,cy,originX,originY,zoom);
    if(cell.role==='road'){
      drawTexturedDiamond(ctx,asphaltImg,p.x,p.y,zoom,'#303234');
      roadMarking(ctx,p.x,p.y,zoom,cell);
    } else {
      drawTexturedDiamond(ctx,concreteImg,p.x,p.y,zoom,cell.role==='curb'?'#66645f':'#555553');
      if(cell.role==='curb'){
        const profile=curbRenderProfile(cell);
        if(profile.gutter) gutterAndDrain(ctx,p.x,p.y,zoom,cell);
        for(const side of cell.roadSides??[]){
          if(profile.ramp) drivewayCurbRamp(ctx,p.x,p.y,zoom,side);
          else if(profile.raised) curbEdge(ctx,p.x,p.y,zoom,side);
        }
      }
    }
  }

  const presentation=options.presentation??reviewPresentation(typeof location!=='undefined'?location.search:'');
  for(const lot of layout.lots??[]) {
    drawDriveway(ctx,lot,cx,cy,originX,originY,zoom);
    if(presentation.debug) drawLotOverlay(ctx,lot,cx,cy,originX,originY,zoom);
  }

  const sortedPlacements=[...placements]
    .sort((a,b)=>(a.x+a.y)-(b.x+b.y)||a.y-b.y||a.x-b.x);
  for(const placement of sortedPlacements){
    drawGovernedHouse(ctx,placement,houses[placement.houseKind],cx,cy,originX,originY,zoom,presentation.debug);
  }

  if(presentation.debug){
    ctx.fillStyle='rgba(235,225,205,0.92)';
    ctx.font='14px monospace';
    ctx.textAlign='left';
    ctx.fillText('DETERMINISTIC STREET REVIEW v1',18,26);
    ctx.fillText(`road ${layout.counts.road}  curb ${layout.counts.curb}  sidewalk ${layout.counts.sidewalk}`,18,46);
  }
  return layout;
}

async function boot() {
  const canvas=document.querySelector('[data-street-review]');
  if(!canvas)return;
  await renderStreetReview(canvas);
}

if(typeof window!=='undefined' && typeof document!=='undefined'){
  window.addEventListener('DOMContentLoaded',()=>{boot().catch(error=>{
    const el=document.querySelector('[data-street-error]');
    if(el)el.textContent=String(error?.stack||error);
    console.error(error);
  });});
}
