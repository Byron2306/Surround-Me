
const EPS = 1e-9;

const PUBLIC_ROLES = new Set([
  'road',
  'curb',
  'sidewalk'
]);

function key(x,y){
  return `${x},${y}`;
}

function cellBounds(cell){
  return {
    minX:cell.x-.5,
    maxX:cell.x+.5,
    minY:cell.y-.5,
    maxY:cell.y+.5
  };
}

function intersects(a,b){
  return (
    a.minX < b.maxX-EPS &&
    a.maxX > b.minX+EPS &&
    a.minY < b.maxY-EPS &&
    a.maxY > b.minY+EPS
  );
}

function contains(outer,inner){
  return (
    inner.minX >= outer.minX-EPS &&
    inner.maxX <= outer.maxX+EPS &&
    inner.minY >= outer.minY-EPS &&
    inner.maxY <= outer.maxY+EPS
  );
}

export function nominalParcelBounds(lot){
  return {
    minX:lot.bounds.minX-.5,
    maxX:lot.bounds.maxX+.5,
    minY:lot.bounds.minY-.5,
    maxY:lot.bounds.maxY+.5
  };
}

export function deriveBuildableCells(layout,lot){
  const occupied=new Set(
    layout.cells
      .filter(cell=>PUBLIC_ROLES.has(cell.role))
      .map(cell=>key(cell.x,cell.y))
  );

  const usable=[];
  const excluded=[];

  for(
    let y=lot.bounds.minY;
    y<=lot.bounds.maxY;
    y++
  ){
    for(
      let x=lot.bounds.minX;
      x<=lot.bounds.maxX;
      x++
    ){
      const cell={x,y};

      if(occupied.has(key(x,y))){
        excluded.push(cell);
      }else{
        usable.push(cell);
      }
    }
  }

  return {
    lotId:lot.id,
    usable,
    excluded,
    nominalCellCount:
      (lot.bounds.maxX-lot.bounds.minX+1)*
      (lot.bounds.maxY-lot.bounds.minY+1)
  };
}

export function structureFootprint(
  placement,
  widthM,
  depthM
){
  const halfWidth=widthM/4;
  const depth=depthM/2;

  return {
    minX:placement.x-halfWidth,
    maxX:placement.x+halfWidth,
    minY:placement.y-depth,
    maxY:placement.y
  };
}

export function checkStructure(
  layout,
  lot,
  footprint
){
  const parcel=nominalParcelBounds(lot);

  const conflicts=layout.cells
    .filter(cell=>PUBLIC_ROLES.has(cell.role))
    .filter(cell=>intersects(
      footprint,
      cellBounds(cell)
    ))
    .map(({x,y,role})=>({x,y,role}));

  const reasons=[];

  if(!contains(parcel,footprint)){
    reasons.push('OUTSIDE_NOMINAL_PARCEL');
  }

  if(conflicts.length){
    reasons.push('PUBLIC_INFRASTRUCTURE_OVERLAP');
  }

  return {
    status:reasons.length?'REFUSE':'PASS',
    footprint,
    conflicts,
    reasons
  };
}

export function residentialAdmission(
  layout,
  lot,
  placement,
  building
){
  const envelope=deriveBuildableCells(
    layout,
    lot
  );

  const footprint=structureFootprint(
    placement,
    building.widthM,
    building.depthM
  );

  const main=checkStructure(
    layout,
    lot,
    footprint
  );

  const attachments=[];

  // Attachment geometry is deliberately not inferred.
  // A porch requires an explicit footprint contract.
  for(const attachment of building.attachments??[]){
    if(!attachment.footprint){
      attachments.push({
        name:attachment.name,
        status:'REFUSE',
        reasons:['ATTACHMENT_FOOTPRINT_UNBOUND']
      });
      continue;
    }

    attachments.push({
      name:attachment.name,
      ...checkStructure(
        layout,
        lot,
        attachment.footprint
      )
    });
  }

  const reasons=[
    ...main.reasons
  ];

  if(attachments.some(a=>a.status!=='PASS')){
    reasons.push('ATTACHMENT_NOT_ADMITTED');
  }

  // This phase has no authoritative pedestrian
  // navigation or collision-route proof.
  reasons.push('ACCESS_ROUTE_NOT_VERIFIED');

  return {
    schema:'verge-residential-admission-v7',
    lotId:lot.id,
    houseKind:placement.houseKind,
    placement:{
      x:placement.x,
      y:placement.y
    },
    envelope,
    main,
    attachments,
    access:{
      status:'PENDING',
      reason:'ACCESS_ROUTE_NOT_VERIFIED'
    },
    status:'REFUSE',
    reasons:[...new Set(reasons)]
  };
}
