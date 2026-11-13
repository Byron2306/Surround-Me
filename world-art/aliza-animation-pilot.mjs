// The original pose sheets are preserved. These source rectangles are their cells.
const sheets={
  walk:{file:'walk-south.png',width:1024,height:1536,rows:2},
  actions:{file:'actions-southeast.png',width:1254,height:1254,rows:4},
};
// Row-major cell numbers; timing follows gameplay, not sheet order.
const timings={
  walk:[[0,.10],[5,.23],[6,.38],[3,.50],[4,.60],[1,.73],[2,.88],[7,1]],
  dash:[[0,.13],[1,.36],[2,.76],[3,1]],
  // Damage happens at input: begin at extension, then recoil and settle.
  shoot:[[1,.20],[2,.58],[3,1]],
  stab:[[2,.40],[3,1]],
  crouch:[[0,.25],[1,.68],[2,1]],
  crouchExit:[[3,1]],
};
const clips={
  walk:{sheet:'walk',direction:4,first:0,anchor:[128,719],footRows:[716,708,702,705,721,724,718,718],height:680},
  dash:{sheet:'actions',direction:3,first:0,anchor:[156,295],height:301},
  shoot:{sheet:'actions',direction:3,first:4,anchor:[156,307],height:301},
  stab:{sheet:'actions',direction:3,first:8,anchor:[156,303],height:301},
  crouch:{sheet:'actions',direction:3,first:12,anchor:[156,307],height:301},
  crouchExit:{sheet:'actions',direction:3,first:12,anchor:[156,307],height:301},
};
export async function loadAlizaPilot(base='./world-art/aliza-pilot/') {
  const results=await Promise.allSettled(Object.entries(sheets).map(async ([key,s])=>{
    const image=new Image();
    image.src=base+s.file;
    await image.decode();
    if(image.naturalWidth!==s.width || image.naturalHeight!==s.height) throw new Error('Aliza sheet dimensions mismatch: '+s.file);
    return [key,image];
  }));
  const images=Object.fromEntries(results.filter(r=>r.status==='fulfilled').map(r=>r.value));
  if(!Object.keys(images).length) throw new Error('No Aliza pilot sheets available');
  return images;
}

export function alizaPilotFrame(images,action,direction,progress) {
  const clip=clips[action];
  const image=clip && images?.[clip.sheet];
  if(!image || clip.direction!==direction || !Number.isFinite(progress)) return null;
  const sheet=sheets[clip.sheet];
  const p=action==='walk'?((progress%1)+1)%1:Math.min(1,Math.max(0,progress));
  const timing=timings[action];
  const [cell]=timing.find(([,until])=>p<until) ?? timing[timing.length-1];
  const index=clip.first+cell;
  const col=index%4,row=Math.floor(index/4);
  const x=Math.floor(col*sheet.width/4),y=Math.floor(row*sheet.height/sheet.rows);
  // Align the bottom of the visible shoe to the same ground line in every pose.
  const anchor=clip.footRows ? [clip.anchor[0],clip.footRows[index-clip.first]] : clip.anchor;
  return {image,x,y,w:Math.floor((col+1)*sheet.width/4)-x,
    h:Math.floor((row+1)*sheet.height/sheet.rows)-y,anchor,height:clip.height};
}

export function drawAlizaPilotFrame(ctx,frame,x,y,standingHeight) {
  const k=standingHeight/frame.height;
  ctx.drawImage(frame.image,frame.x,frame.y,frame.w,frame.h,
    x-frame.anchor[0]*k,y-frame.anchor[1]*k,frame.w*k,frame.h*k);
}
