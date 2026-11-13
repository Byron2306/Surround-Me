import { evaluateA01V8 } from './residential-admission-v8.mjs';
import { nominalParcelBounds } from './residential-admission-v7.mjs';

export const WALK_RADIUS = 0.12;
const key = (x,y) => `${x},${y}`;
export const cellBox = ({x,y}) => ({minX:x-.5,maxX:x+.5,minY:y-.5,maxY:y+.5});
const expand = (b,r) => ({minX:b.minX-r,maxX:b.maxX+r,minY:b.minY-r,maxY:b.maxY+r});
export const inside = (b,x,y) => x>=b.minX && x<=b.maxX && y>=b.minY && y<=b.maxY;

function segmentHits(a,b,box) {
  let low=0, high=1;
  for (const [axis,min,max] of [['x',box.minX,box.maxX],['y',box.minY,box.maxY]]) {
    const delta=b[axis]-a[axis];
    if (!delta) {
      if (a[axis]<min || a[axis]>max) return false;
      continue;
    }
    const t1=(min-a[axis])/delta, t2=(max-a[axis])/delta;
    low=Math.max(low,Math.min(t1,t2));
    high=Math.min(high,Math.max(t1,t2));
    if (low>high) return false;
  }
  return true;
}

export function buildAccessReview({layout,lot,placement,source}) {
  const v8=evaluateA01V8({layout,lot,placement,source});
  const refuse=reason=>({status:'REFUSE',reason,productionAdmission:'REFUSE'});
  if (v8.main.status!=='PASS' || v8.porch.clearance?.status!=='PASS') return refuse('HOUSE_OR_PORCH_CLEARANCE');
  const {curbX:x,curbY:y}=lot.driveway??{};
  if (![x,y].every(Number.isInteger) || lot.side!=='north') return refuse('DRIVEWAY_UNBOUND');
  const cells=new Map(layout.cells.map(c=>[key(c.x,c.y),c]));
  const ramp=cells.get(key(x,y));
  const sidewalk=cells.get(key(x,y-1));
  const road=cells.get(key(x,y+1));
  if (ramp?.role!=='curb' || ramp.module!=='curb-driveway' || sidewalk?.role!=='sidewalk' || road?.role!=='road') {
    return refuse('DRIVEWAY_NOT_CONNECTED');
  }
  const main=v8.main.footprint, porch=v8.porch.footprint, doorX=v8.porch.doorX;
  const parcel=nominalParcelBounds(lot);
  const end={x:doorX,y:main.maxY+.25};
  const points=[{x,y},{x,y:y-1},{x:doorX,y:y-1},end];
  if (!inside(porch,end.x,end.y)) return refuse('PORCH_APPROACH_UNBOUND');
  // Street and curb restrictions belong to the designated access route, not player movement.
  const routeBlockers=[main,...layout.cells.filter(c=>c.role==='road' || (c.role==='curb' && c.module!=='curb-driveway')).map(cellBox)].map(b=>expand(b,WALK_RADIUS));
  const body=expand(main,WALK_RADIUS);
  const blocked=(x,y)=>!Number.isFinite(x) || !Number.isFinite(y) || inside(body,x,y);
  const walkSurface=(x,y)=>{
    const c=cells.get(key(Math.floor(x+.5),Math.floor(y+.5)));
    if (c?.role==='road' || c?.role==='curb') return c===ramp;
    return c?.role==='sidewalk' || inside(parcel,x,y);
  };
  for (let i=1;i<points.length;i++) {
    const a=points[i-1],b=points[i];
    if (routeBlockers.some(box=>segmentHits(a,b,box))) return refuse('ROUTE_BLOCKED');
    const steps=Math.max(1,Math.ceil(Math.hypot(b.x-a.x,b.y-a.y)*32));
    for (let k=0;k<=steps;k++) {
      const t=k/steps;
      if (!walkSurface(a.x+(b.x-a.x)*t,a.y+(b.y-a.y)*t)) return refuse('ROUTE_LEAVES_WALK_SURFACE');
    }
  }
  return {status:'PASS',productionAdmission:'REFUSE',coordinateAuthority:'PROVISIONAL',
    points,main,porch,parcel,ramp,doorX,blocked,
    atDoor:(x,y)=>!blocked(x,y) && inside(porch,x,y) && Math.abs(x-doorX)<=source.door.widthM/4 && Math.abs(y-end.y)<=.2};
}
