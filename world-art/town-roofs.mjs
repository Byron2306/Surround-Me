// Roof geometry belongs to the world projection, not to the sprite's facade seam.
export function houseRoofGeometry({w,d}) {
 const wallHeight=(w+d)*10.2,rise=w*Math.tan(32*Math.PI/180)*19.6;
 const front={x:0,y:-wallHeight},back={x:d*32,y:-d*16-wallHeight};
 const ridge={x:-w*16,y:-w*8-wallHeight-rise};
 const ridgeBack={x:ridge.x+d*32,y:ridge.y-d*16};
 return {wallHeight,rise,slope:[front,back,ridgeBack,ridge],
  gable:[{x:-w*32,y:-w*16-wallHeight},front,ridge]};
}
export function roofWallPolygon(s,side,height) {
 return side==='left'?[{x:0,y:0},{x:-s.w*32,y:-s.w*16},{x:-s.w*32,y:-s.w*16-height},{x:0,y:-height}]
  :[{x:0,y:0},{x:s.d*32,y:-s.d*16},{x:s.d*32,y:-s.d*16-height},{x:0,y:-height}];
}
export function polygon(ctx,points) {
 ctx.beginPath();for(const [i,p]of points.entries())i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y);ctx.closePath();
}
function texturePlane(ctx,image,target,source) {
 const [a,b,c]=source,[p,q,r]=target;
 const u={x:b.x-a.x,y:b.y-a.y},v={x:c.x-a.x,y:c.y-a.y};
 const tu={x:q.x-p.x,y:q.y-p.y},tv={x:r.x-p.x,y:r.y-p.y},det=u.x*v.y-u.y*v.x;
 const m={a:(tu.x*v.y-tv.x*u.y)/det,c:(tv.x*u.x-tu.x*v.x)/det,
  b:(tu.y*v.y-tv.y*u.y)/det,d:(tv.y*u.x-tu.y*v.x)/det};
 ctx.transform(m.a,m.b,m.c,m.d,p.x-m.a*a.x-m.c*a.y,p.y-m.b*a.x-m.d*a.y);
 ctx.drawImage(image,0,0,1,1);
}
const ROOFS={
 townHousePlaster:{eave:{x:.598,y:.600},back:{x:.985,y:.410},ridge:{x:.295,y:.285},left:{x:.040,y:.510}},
 townHouseBrick:{eave:{x:.600,y:.570},back:{x:.980,y:.450},ridge:{x:.295,y:.280},left:{x:.040,y:.510}},
 townCornerShop:{eave:{x:.678,y:.375},back:{x:.960,y:.235},left:{x:.040,y:.230}},
 townHardware:{eave:{x:.780,y:.295},back:{x:.975,y:.225},left:{x:.025,y:.295}},
 townLaundrette:{eave:{x:.800,y:.320},back:{x:.975,y:.185},left:{x:.025,y:.270}},
 townPharmacy:{eave:{x:.735,y:.290},back:{x:.945,y:.150},left:{x:.055,y:.160}},
};
export function roofGeometryFor(s) {
 const source=ROOFS[s.asset];if(!source)return null;
 if(source.ridge)return {...houseRoofGeometry(s),source,kind:'gable'};
 const wallHeight=(s.w+s.d)*32*(s.spriteContactY-source.eave.y);
 return {wallHeight,kind:'flat',source,slope:[{x:0,y:-wallHeight},{x:s.d*32,y:-s.d*16-wallHeight},
  {x:s.d*32-s.w*32,y:-s.d*16-s.w*16-wallHeight},{x:-s.w*32,y:-s.w*16-wallHeight}]};
}
export function drawContinuousRoof(ctx,s,image,g) {
 const {source}=g;
 if(g.kind==='gable'){
  ctx.save();polygon(ctx,g.gable);ctx.fillStyle='#78756a';ctx.fill();ctx.clip();
  texturePlane(ctx,image,g.gable,[source.left,source.eave,source.ridge]);ctx.restore();
 }
 ctx.save();polygon(ctx,g.slope);ctx.fillStyle='#4c4d47';ctx.fill();ctx.clip();
 texturePlane(ctx,image,[g.slope[0],g.slope[1],g.slope[3]],[source.eave,source.back,source.ridge??source.left]);ctx.restore();
 // One continuous eave/ridge contour; no independently sheared roof halves.
 polygon(ctx,g.slope);ctx.strokeStyle=g.kind==='gable'?'#4d4b43':'#78796e';ctx.lineWidth=1.2;ctx.stroke();
 if(g.kind==='gable'){
  ctx.beginPath();ctx.moveTo(g.gable[0].x,g.gable[0].y);ctx.lineTo(g.gable[2].x,g.gable[2].y);ctx.lineTo(g.gable[1].x,g.gable[1].y);
  ctx.strokeStyle='#aaa697';ctx.lineWidth=2.2;ctx.stroke();
 }
}
