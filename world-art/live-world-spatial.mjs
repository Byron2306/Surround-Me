// Shared world-space rules; sprite canvas dimensions never define a footprint.
export function structureAnchor(s) {
 return s.collisionBounds ? {x:s.x,y:s.y} : {x:s.x+s.w/2,y:s.y+s.h/2};
}
export function structureBounds(s) {
 const b=s.collisionBounds;
 return b ? {minX:s.x+b.minX,maxX:s.x+b.maxX,minY:s.y+b.minY,maxY:s.y+b.maxY}
  : {minX:s.x-0.5,maxX:s.x+s.w+0.5,minY:s.y-0.5,maxY:s.y+s.h+0.5};
}
export function actorHeight(type, heightM) {
 const heights={burdened:2.25,huddled:1.45,deferred:1.3};
 return (Number.isFinite(heightM) && heightM>0 ? heightM : heights[type]??1.72)*8*Math.sqrt(6);
}
export function viewportSize(w,h) {
 const aspect=Math.max(0.25,Math.min(4,w/Math.max(1,h)));
 // Keep a useful short axis in portrait; cap pixel cost for extreme displays.
 let width=aspect>=1?720*aspect:720;
 let height=aspect>=1?720:720/aspect;
 const cap=Math.min(1,Math.sqrt(2800000/(width*height)));
 return {w:Math.round(width*cap),h:Math.round(height*cap)};
}
export function placementClear(x,y,structures,radius=0.5) {
 return structures.every(s=>{
  const b=structureBounds(s);
  const inBuilding=x>b.minX-radius && x<b.maxX+radius && y>b.minY-radius && y<b.maxY+radius;
  const frontX=s.doorApproach ? s.x+s.doorApproach.x : (b.minX+b.maxX)/2;
  const inApproach=Math.abs(x-frontX)<0.75+radius && y>=b.maxY-radius && y<b.maxY+1.5+radius;
  return !inBuilding && !inApproach;
 });
}

export function wallFace(w, project) {
 const origin=project(w.x,w.y);
 const end=w.end ?? {x:w.x-Math.sin(w.angle)*0.5,y:w.y+Math.cos(w.angle)*0.5,height:w.height};
 const point=project(end.x,end.y);
 const dx=point.x-origin.x,dy=point.y-origin.y;
 return [{x:0,y:0},{x:dx,y:dy},{x:dx,y:dy-28*end.height},{x:0,y:-28*w.height}];
}
