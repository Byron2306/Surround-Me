export function basicHitDamage(damage,maxHealth,weapon) {
  if ((weapon!=='gun' && weapon!=='stab') || !(maxHealth>0)) return damage;
  return Math.min(damage,maxHealth*.55);
}

export function dashDuration(side,modifier=1) {
  const base=side==='restraint'?.12:side==='compulsion'?.21:.17;
  return Math.min(.23,base*Math.max(.75,Math.min(1.15,modifier)));
}

export function dashFrame({x,y,dirX,dirY,remaining,dt,side,agency,isBlocked}) {
  const elapsed=Math.min(remaining,dt);
  const speed=(side==='restraint'?6.2:side==='compulsion'?9:8.5)*Math.max(.65,Math.min(1,agency));
  const distance=speed*elapsed;
  const steps=Math.max(1,Math.ceil(distance/.05));
  const dx=dirX*distance/steps, dy=dirY*distance/steps;
  for(let i=0;i<steps;i++){
    if(isBlocked(x+dx,y+dy)) return {x,y,remaining:0};
    x+=dx;
    y+=dy;
  }
  return {x,y,remaining:Math.max(0,remaining-elapsed)};
}

export function walkVelocity(x,y,baseSpeed,side,agency) {
  const norm=Math.max(1,Math.hypot(x,y));
  const pace=side==='restraint' ? .55+.45*Math.max(0,Math.min(1,agency)) : 1;
  return {x:x/norm*baseSpeed*pace,y:y/norm*baseSpeed*pace};
}
