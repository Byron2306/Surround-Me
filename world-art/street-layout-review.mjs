import { compileStreetLayout } from './street-layout.mjs';

export function residentialCrossroadSpec(cx=50,cy=50) {
  if (!Number.isInteger(cx) || !Number.isInteger(cy)) throw new Error('review_center_must_be_integer');
  return {
    tileMeters:2,
    streets:[
      {id:'residential-ew',axis:'x',from:{x:cx-8,y:cy},to:{x:cx+8,y:cy},halfWidth:1},
      {id:'residential-ns',axis:'y',from:{x:cx,y:cy-8},to:{x:cx,y:cy+8},halfWidth:1},
    ],
  };
}

export function streetReviewCells(cx=50,cy=50) {
  return compileStreetLayout(residentialCrossroadSpec(cx,cy)).cells;
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

function loadImage(src) {
  return new Promise(resolve=>{
    const img=new Image();
    img.onload=()=>resolve(img);
    img.onerror=()=>resolve(null);
    img.src=src;
  });
}

export async function renderStreetReview(canvas,options={}) {
  if(!canvas?.getContext) throw new Error('review_canvas_required');
  const cx=options.cx??50;
  const cy=options.cy??50;
  const zoom=options.zoom??1.55;
  const layout=compileStreetLayout(residentialCrossroadSpec(cx,cy));
  const [asphaltImg,concreteImg,dirtImg]=await Promise.all([
    loadImage('../asphalt1.png'),
    loadImage('../concrete.png'),
    loadImage('../asphalt1.png'),
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

  const originX=width/2;
  const originY=height*0.46;
  const cells=[...layout.cells].sort((a,b)=>(a.x+a.y)-(b.x+b.y)||a.y-b.y||a.x-b.x);

  // underlay makes the review boundary explicit without changing topology
  for(let x=cx-12;x<=cx+12;x++){
    for(let y=cy-12;y<=cy+12;y++){
      const p=project(x,y,cx,cy,originX,originY,zoom);
      drawTexturedDiamond(ctx,dirtImg,p.x,p.y,zoom,'#2a2a28');
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
        for(const side of cell.roadSides??[]) curbEdge(ctx,p.x,p.y,zoom,side);
      }
    }
  }

  ctx.fillStyle='rgba(235,225,205,0.92)';
  ctx.font='14px monospace';
  ctx.textAlign='left';
  ctx.fillText('DETERMINISTIC STREET REVIEW v1',18,26);
  ctx.fillText(`road ${layout.counts.road}  curb ${layout.counts.curb}  sidewalk ${layout.counts.sidewalk}`,18,46);
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
