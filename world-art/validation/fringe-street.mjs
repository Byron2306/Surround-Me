// Presentation only. The admitted street layout continues to own access.
const key=(x,y)=>`${x},${y}`;
const noise=(x,y,i)=>{
  let n=Math.imul(x*997+i*17,374761393)^Math.imul(y*991-i*31,668265263);
  n=Math.imul(n^(n>>>13),1274126177);
  return ((n^(n>>>16))>>>0)/4294967296;
};

export function fringeStreetGround(layout,review,area,footprints=[]) {
  const slabs=[];
  const rect=(x0,y0,x1,y1,fill,material)=>slabs.push({x0,y0,x1,y1,fill,material});
  // Cover incidental procedural roads inside the authored block.
  if (area) rect(area.minX,area.minY,area.maxX,area.maxY,'#4a4c44');
  const surfaces=new Map(layout.cells.map(c=>[key(c.x,c.y),c]));
  const lots=layout.lots.slice().sort((a,b)=>a.id.localeCompare(b.id));
  for (const [index,lot] of lots.entries()) {
    const b=lot.bounds;
    for(let x=b.minX;x<=b.maxX;x++) for(let y=b.minY;y<=b.maxY;y++){
      if(surfaces.has(key(x,y))) continue;
      const soil = noise(x,y,33) > .74;
      rect(x-.5,y-.5,x+.5,y+.5,soil?'#464841':index%2===0?'#51554a':'#4b5247');
      for(let i=0;i<14;i++){
        const px=x-.46+noise(x,y,i)*.88,py=y-.46+noise(x,y,i+15)*.88;
        const width = .026 + noise(x,y,i+40)*.105;
        rect(px,py,px+width,py+.025,i%2?'#5c5e50':'#41473d');
      }
    }
  }
  for(const {x,y,role,module,marking,stormDrain,gutterEdge} of layout.cells){
    if(role==='road'){
      rect(x-.5,y-.5,x+.5,y+.5,'#3c4042','asphalt');
      for(let i=0;i<9;i++){
        const px=x-.48+noise(x,y,i)*.92,py=y-.48+noise(x,y,i+11)*.92;
        rect(px,py,px+.045,py+.027,i%2?'#484b4b':'#323637');
      }
      const eastWest=marking==='centerline-ew';
      const northSouth=marking==='centerline-ns';
      const along=eastWest?x:y;
      if ((eastWest || northSouth) && Math.abs(along)%3!==0) {
        const inset=.13+noise(x,y,21)*.13;
        const paint=noise(x,y,22)>.45?'#a29b76':'#8a856b';
        if (eastWest) rect(x-.5+inset,y-.026,x+.39,y+.026,paint);
        else rect(x-.026,y-.5+inset,x+.026,y+.39,paint);
      }
      if (noise(x,y,29)>.93) {
        rect(x-.22,y-.21,x+.29,y+.13,'rgba(23,30,31,.25)');
        rect(x-.17,y-.18,x+.27,y-.13,'rgba(126,137,136,.17)');
      }
    } else if(role==='sidewalk'){
      rect(x-.5,y-.5,x+.5,y+.5,'#625e57');
      rect(x-.487,y-.487,x+.487,y+.487,noise(x,y,5)>.5?'#858681':'#7c7f7c','concrete');
    } else if(role==='curb'){
      rect(x-.5,y-.5,x+.5,y+.5,module==='curb-driveway'?'#70746f':'#545955');
      if(module!=='curb-driveway'){
        for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]){
          if(surfaces.get(key(x+dx,y+dy))?.role!=='road') continue;
          if(dx) rect(x+dx*.46-.035,y-.5,x+dx*.46+.035,y+.5,'#979a92');
          else rect(x-.5,y+dy*.46-.035,x+.5,y+dy*.46+.035,'#979a92');
        }
      }
      if (stormDrain && gutterEdge) {
        const horizontal=gutterEdge==='n' || gutterEdge==='s';
        const d=gutterEdge==='n' || gutterEdge==='w'?-.34:.34;
        const dx=horizontal?0:d, dy=horizontal?d:0;
        const hx=horizontal?.20:.11, hy=horizontal?.11:.20;
        rect(x+dx-hx,y+dy-hy,x+dx+hx,y+dy+hy,'#303638');
        for(let i=-2;i<=2;i++){
          if(horizontal) rect(x+i*.059-.012,y+dy-hy+.028,x+i*.059+.012,y+dy+hy-.028,'#777e79');
          else rect(x+dx-hx+.028,y+i*.059-.012,x+dx+hx-.028,y+i*.059+.012,'#777e79');
        }
      }
    }
  }
  // Aprons only occupy the declared driveway and its adjoining sidewalk.
  for(const lot of lots){
    const {curbX:x,curbY:y}=lot.driveway??{};
    const side=lot.side==='north'?-1:lot.side==='south'?1:0;
    if(!Number.isInteger(x)||!Number.isInteger(y)||!side) continue;
    if(surfaces.get(key(x,y))?.module!=='curb-driveway' ||
       surfaces.get(key(x,y+side))?.role!=='sidewalk') continue;
    rect(x-.37,Math.min(y+side,y)-.5,x+.37,Math.max(y+side,y)+.5,'#777c77','concrete');
  }
  if (review) {
    const x=review.doorX,y=review.porch.maxY;
    rect(x-.22,y,x+.22,y+.5,'#8b8a7f','concrete');
    for (const path of review.doorPaths??[]) {
      rect(path.x-.2,path.y,path.x+.2,path.toY,'#8b8a7f','concrete');
    }
  }
  for (const box of footprints) {
    rect(box.minX-.13,box.minY-.08,box.maxX+.20,box.maxY+.18,'rgba(22,30,26,.12)');
    rect(box.minX-.06,box.minY-.03,box.maxX+.08,box.maxY+.08,'rgba(19,24,23,.25)');
  }
  return slabs;
}

const ALTERED = {
  compulsion: {
    dark: [31, 24, 27], light: [114, 66, 48],
    wear: '#392b29', reveal: '#62434a', hardware: '#89716c',
  },
  restraint: {
    dark: [35, 40, 42], light: [135, 144, 141],
    wear: '#757d78', reveal: '#90968a', hardware: '#a1a89e',
  },
};

export function alteredFringeGround(slabs, layout, side) {
  const palette = ALTERED[side];
  const altered = slabs.map(slab => {
    if (!slab.fill.startsWith('#')) return slab;
    const value = Number.parseInt(slab.fill.slice(1), 16);
    const light = ((value >> 16) * .21 + ((value >> 8) & 255) * .72 + (value & 255) * .07) / 170;
    const channels = palette.dark.map((dark, i) => Math.round(dark + (palette.light[i] - dark) * light));
    return { ...slab, fill: `rgb(${channels.join(',')})` };
  });
  const rect = (x0,y0,x1,y1,fill) => altered.push({x0,y0,x1,y1,fill});
  for (const { x, y, role, module, stormDrain } of layout.cells) {
    const n = noise(x,y,51);
    if (role === 'road' && n > .63) {
      const offset = noise(x,y,60) * .52 - .26;
      rect(x-.49,y+offset,x+.43,y+offset+.026,palette.wear);
      rect(x+.16,y+offset,x+.195,y+.48,palette.wear);
      if (n > .86) {
        rect(x-.47,y+offset+.034,x-.05,y+offset+.056,palette.reveal);
        rect(x+.198,y+offset+.06,x+.22,y+.45,palette.reveal);
        if (side === 'compulsion') {
          // Exposed ribs sit below the broken wearing course.
          rect(x-.43,y-.39,x+.33,y-.03,'#252127');
          rect(x-.40,y-.37,x+.29,y-.055,'#4a3746');
          for (let rib = 0; rib < 8; rib++) {
            const at = x-.40 + rib*.09;
            rect(at,y-.39,at+.045,y-.03,rib%2?'#463331':'#513936');
          }
          rect(x-.43,y-.06,x+.33,y-.025,palette.wear);
        } else {
          rect(x-.47,y-.37,x+.44,y-.26,'#424c50');
          rect(x-.47,y-.38,x+.44,y-.365,palette.reveal);
        }
      }
    } else if (role === 'curb' && stormDrain && module !== 'curb-driveway') {
      rect(x-.28,y-.11,x+.28,y+.13,palette.wear);
      for (let index = -3; index <= 3; index++) {
        const bar = x + index * .071;
        rect(bar,y-.085,bar+.026,y+.10,palette.hardware);
      }
    }
  }
  return altered;
}

function paintSlabs(ctx,slabs,project,cam,images){
  ctx.save();
  const patterns={};
  const origin=project(0,0);
  for (const [key,image,span] of [['asphalt',images.groundAsphalt,3],['concrete',images.groundConcrete,2],['dead_grass',images.townGrass,2],['dirt',images.townDirt,2]]) {
    if (!image) continue;
    const pattern=ctx.createPattern(image,'repeat');
    if (!pattern) continue;
    const u=project(span,0), v=project(0,span);
    pattern.setTransform(new DOMMatrix([
      (u.x-origin.x)/image.width,(u.y-origin.y)/image.width,
      (v.x-origin.x)/image.height,(v.y-origin.y)/image.height,
      origin.x+cam.x,origin.y+cam.y,
    ]));
    patterns[key]=pattern;
  }
  for(const {x0,y0,x1,y1,fill,material} of slabs){
    const a=project(x0,y0),b=project(x1,y0),c=project(x1,y1),d=project(x0,y1);
    ctx.beginPath();
    ctx.moveTo(a.x+cam.x,a.y+cam.y);
    for(const p of [b,c,d])ctx.lineTo(p.x+cam.x,p.y+cam.y);
    ctx.closePath();
    ctx.fillStyle=fill;
    ctx.fill();
    if (patterns[material]) {
      ctx.save();
      ctx.globalAlpha *= material==='dead_grass'||material==='dirt' ? .42 : .12;
      ctx.fillStyle = patterns[material];
      ctx.fill();
      ctx.restore();
    }
  }
  ctx.restore();
}


// Static ground is rasterized once per scene, not once per camera frame.
const groundCaches = new WeakMap();
function bakeGround(slabs,project,images) {
  let left=Infinity,top=Infinity,right=-Infinity,bottom=-Infinity;
  for (const {x0,y0,x1,y1} of slabs) {
    for (const [x,y] of [[x0,y0],[x1,y0],[x1,y1],[x0,y1]]) {
      const p=project(x,y);
      left=Math.min(left,p.x);top=Math.min(top,p.y);
      right=Math.max(right,p.x);bottom=Math.max(bottom,p.y);
    }
  }
  left=Math.floor(left)-1;top=Math.floor(top)-1;
  const width=Math.ceil(right)-left+1,height=Math.ceil(bottom)-top+1;
  if (!(width>0 && height>0 && width*height<=4_000_000)) return null;
  const surface=document.createElement('canvas');
  surface.width=width;surface.height=height;
  const layer=surface.getContext('2d');
  if (!layer) return null;
  paintSlabs(layer,slabs,project,{x:-left,y:-top},images);
  return {surface,left,top};
}

export function drawFringeGround(ctx,slabs,project,cam,images={}){
  let cached=groundCaches.get(slabs);
  if (!cached || cached.project!==project) {
    cached={project,layer:bakeGround(slabs,project,images)};
    groundCaches.set(slabs,cached);
  }
  const layer=cached.layer;
  if (layer) ctx.drawImage(layer.surface,layer.left+cam.x,layer.top+cam.y);
  else paintSlabs(ctx,slabs,project,cam,images);
}
