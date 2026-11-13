
import {
  checkStructure,
  structureFootprint
} from './residential-admission-v7.mjs';

const EPS=1e-9;

function intersects(a,b){
  return (
    a.minX<b.maxX-EPS &&
    a.maxX>b.minX+EPS &&
    a.minY<b.maxY-EPS &&
    a.maxY>b.minY+EPS
  );
}

function pointInside(box,x,y){
  return (
    x>box.minX+EPS &&
    x<box.maxX-EPS &&
    y>box.minY+EPS &&
    y<box.maxY-EPS
  );
}

export function bindA01Porch(placement,source){
  const width=source.widthM;
  const depth=source.depthM;
  const door=source.door;
  const porch=source.porch;

  if(
    width!==7.5 ||
    depth!==6 ||
    door?.facade!=='FRONT' ||
    porch?.facade!=='FRONT' ||
    !Array.isArray(porch.boundsM) ||
    porch.boundsM.length!==3
  ){
    return {
      status:'REFUSE',
      reasons:['SOURCE_GEOMETRY_INVALID']
    };
  }

  const [porchWidth,porchDepth]=porch.boundsM;

  const doorOffsetX=
    (door.lateralPosition-.5)*width/2;

  const doorX=placement.x+doorOffsetX;

  const footprint={
    minX:doorX-porchWidth/4,
    maxX:doorX+porchWidth/4,
    minY:placement.y,
    maxY:placement.y+porchDepth/2
  };

  return {
    status:'PROVISIONAL',
    doorX,
    doorApproach:{
      x:doorX,
      y:placement.y+porchDepth/2
    },
    footprint,
    coordinateConvention:
      'runtime-front-positive-y',
    coordinateAuthority:'PROVISIONAL',
    reasons:['COORDINATE_AUTHORITY_UNVERIFIED']
  };
}

export function checkA01Porch(
  layout,
  lot,
  placement,
  source
){
  const bound=bindA01Porch(
    placement,
    source
  );

  if(!bound.footprint){
    return bound;
  }

  const clearance=checkStructure(
    layout,
    lot,
    bound.footprint
  );

  return {
    ...bound,
    clearance,
    status:clearance.status==='PASS'
      ?'PROVISIONAL'
      :'REFUSE',
    reasons:[
      ...bound.reasons,
      ...clearance.reasons
    ]
  };
}

export function inspectAccessCorridor({
  layout,
  lot,
  placement,
  building,
  porch,
  driveway
}){
  const main=structureFootprint(
    placement,
    building.widthM,
    building.depthM
  );

  if(
    !porch?.doorApproach ||
    !Number.isFinite(driveway?.curbX) ||
    !Number.isFinite(driveway?.curbY)
  ){
    return {
      status:'REFUSE',
      reasons:['ACCESS_ENDPOINT_UNBOUND']
    };
  }

  const start=porch.doorApproach;
  const end={
    x:driveway.curbX,
    y:driveway.curbY
  };

  // Deterministic two-segment candidate:
  // move forward to the driveway frontage,
  // then align laterally with its curb opening.
  const bend={
    x:start.x,
    y:end.y
  };

  const points=[start,bend,end];

  const blocked=points.some(
    p=>pointInside(main,p.x,p.y)
  );

  const reasons=[];

  if(blocked){
    reasons.push('ACCESS_INTERSECTS_BUILDING');
  }

  // Segment-level public-cell and pedestrian
  // clearance validation is not implemented yet.
  reasons.push('ACCESS_SEGMENT_CLEARANCE_UNVERIFIED');

  // Driveway identity and curb connectivity
  // must be established independently.
  reasons.push('DRIVEWAY_CONNECTIVITY_UNVERIFIED');

  return {
    status:'PENDING',
    points,
    reasons,
    candidateOnly:true
  };
}

export function evaluateA01V8({
  layout,
  lot,
  placement,
  source
}){
  const main=checkStructure(
    layout,
    lot,
    structureFootprint(
      placement,
      source.widthM,
      source.depthM
    )
  );

  const porch=checkA01Porch(
    layout,
    lot,
    placement,
    source
  );

  const access=inspectAccessCorridor({
    layout,
    lot,
    placement,
    building:source,
    porch,
    driveway:lot.driveway
  });

  return {
    schema:'verge-residential-admission-v8',
    houseKind:'A01',
    lotId:lot.id,
    placement:{
      x:placement.x,
      y:placement.y
    },
    main,
    porch,
    access,
    status:'REFUSE',
    productionAdmission:'REFUSE',
    reasons:[
      'COORDINATE_AUTHORITY_UNVERIFIED',
      ...access.reasons,
      ...(main.status==='PASS'
        ?[]
        :['MAIN_STRUCTURE_NOT_CLEAR']),
      ...(porch.clearance?.status==='PASS'
        ?[]
        :['PORCH_NOT_CLEAR'])
    ]
  };
}
