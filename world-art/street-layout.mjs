// Deterministic street-plan compiler for Surround Me.
// Pure data: no canvas, RNG, assets, or camera authority.
//
// Grid contract:
// - one cell = one logical world tile
// - road segments occupy integer cells
// - curb is the first cardinal ring outside road
// - sidewalk is the next cardinal ring outside curb
// - intersections are created by road-set union, never by sprite overlap

const CARDINAL = Object.freeze([
  ['n', 0, -1],
  ['e', 1, 0],
  ['s', 0, 1],
  ['w', -1, 0],
]);

const key = (x, y) => `${x},${y}`;

function assertInt(v, name) {
  if (!Number.isInteger(v)) throw new Error(`${name}_must_be_integer`);
}

function normalizeSegment(segment) {
  if (!segment || typeof segment !== 'object') throw new Error('invalid_street_segment');
  const { id, axis, from, to, halfWidth = 1 } = segment;
  if (typeof id !== 'string' || !id) throw new Error('street_id_required');
  if (axis !== 'x' && axis !== 'y') throw new Error('street_axis_invalid');
  for (const [name, p] of [['from', from], ['to', to]]) {
    if (!p) throw new Error(`${name}_required`);
    assertInt(p.x, `${name}_x`);
    assertInt(p.y, `${name}_y`);
  }
  assertInt(halfWidth, 'halfWidth');
  if (halfWidth < 0) throw new Error('halfWidth_must_be_nonnegative');
  if (axis === 'x' && from.y !== to.y) throw new Error('x_street_must_be_horizontal');
  if (axis === 'y' && from.x !== to.x) throw new Error('y_street_must_be_vertical');
  return { id, axis, from: {...from}, to: {...to}, halfWidth };
}

function addRoadSegment(road, owner, segment) {
  const s = normalizeSegment(segment);
  if (s.axis === 'x') {
    const x0 = Math.min(s.from.x, s.to.x);
    const x1 = Math.max(s.from.x, s.to.x);
    for (let x = x0; x <= x1; x++) {
      for (let dy = -s.halfWidth; dy <= s.halfWidth; dy++) {
        const y = s.from.y + dy;
        road.add(key(x, y));
        const k = key(x, y);
        if (!owner.has(k)) owner.set(k, []);
        owner.get(k).push(s.id);
      }
    }
  } else {
    const y0 = Math.min(s.from.y, s.to.y);
    const y1 = Math.max(s.from.y, s.to.y);
    for (let y = y0; y <= y1; y++) {
      for (let dx = -s.halfWidth; dx <= s.halfWidth; dx++) {
        const x = s.from.x + dx;
        road.add(key(x, y));
        const k = key(x, y);
        if (!owner.has(k)) owner.set(k, []);
        owner.get(k).push(s.id);
      }
    }
  }
  return s;
}

function parseKey(k) {
  const [x, y] = k.split(',').map(Number);
  return {x, y};
}

function cardinalRoadSides(x, y, road) {
  return CARDINAL.filter(([, dx, dy]) => road.has(key(x + dx, y + dy))).map(([name]) => name);
}

function roadVariant(connections) {
  const s = new Set(connections);
  if (s.size === 4) return 'road-cross';
  if (s.size === 3) return 'road-t-' + [...s].sort().join('');
  if (s.size === 2) {
    if (s.has('e') && s.has('w')) return 'road-ew';
    if (s.has('n') && s.has('s')) return 'road-ns';
    return 'road-corner-' + [...s].sort().join('');
  }
  if (s.size === 1) return 'road-end-' + connections[0];
  return 'road-isolated';
}

function curbVariant(sides) {
  const s = new Set(sides);
  if (s.size === 1) return `curb-${sides[0]}`;
  if (s.size === 2) {
    if (s.has('n') && s.has('s')) return 'curb-ns';
    if (s.has('e') && s.has('w')) return 'curb-ew';
    return 'curb-corner-' + [...s].sort().join('');
  }
  if (s.size >= 3) return 'curb-junction-' + [...s].sort().join('');
  return 'curb-none';
}

function curbModule(sides) {
  const s = new Set(sides);
  if (s.size === 1) return 'curb-straight-' + sides[0];
  if (s.size === 2) {
    if (s.has('n') && s.has('s')) return 'curb-channel-ns';
    if (s.has('e') && s.has('w')) return 'curb-channel-ew';
    return 'curb-corner-' + [...s].sort().join('');
  }
  if (s.size >= 3) return 'curb-junction-' + [...s].sort().join('');
  return 'curb-none';
}

function isStormDrainSocket(cell, module) {
  if (!module.startsWith('curb-straight-')) return false;
  const side = module.slice('curb-straight-'.length);
  const along = (side === 'n' || side === 's') ? cell.x : cell.y;
  // Stable cadence. Offset avoids symmetrical drains colliding at the review origin.
  return ((along % 6) + 6) % 6 === 2;
}

function ringOutside(inner, blocked) {
  const out = new Set();
  for (const k of inner) {
    const {x, y} = parseKey(k);
    for (const [, dx, dy] of CARDINAL) {
      const nk = key(x + dx, y + dy);
      if (!inner.has(nk) && !blocked.has(nk)) out.add(nk);
    }
  }
  return out;
}

function sortedCells(set) {
  return [...set].map(parseKey).sort((a,b) => a.y - b.y || a.x - b.x);
}

function compileResidentialFrontage(spec, streets, curbCells, road) {
  const cfg = spec?.residential;
  if (!cfg) return [];
  const street = streets.find(s => s.id === cfg.streetId);
  if (!street) throw new Error('residential_street_not_found');
  if (street.axis !== 'x') throw new Error('residential_v1_requires_horizontal_street');
  if (!['north','south'].includes(cfg.side)) throw new Error('residential_side_invalid');

  const lotWidth = cfg.lotWidth ?? 5;
  const lotDepth = cfg.lotDepth ?? 4;
  const setback = cfg.setback ?? 2;
  for (const [name,v] of [['lotWidth',lotWidth],['lotDepth',lotDepth],['setback',setback]]) {
    assertInt(v,name);
    if (v < 1) throw new Error(`${name}_must_be_positive`);
  }

  const x0=Math.min(street.from.x,street.to.x);
  const x1=Math.max(street.from.x,street.to.x);
  const roadEdgeY = street.from.y + (cfg.side === 'south' ? street.halfWidth : -street.halfWidth);
  const curbY = roadEdgeY + (cfg.side === 'south' ? 1 : -1);
  const lotNearY = curbY + (cfg.side === 'south' ? 1 : -1);
  const sign = cfg.side === 'south' ? 1 : -1;

  const lots=[];
  let ordinal=0;
  for(let start=x0+1; start+lotWidth-1<=x1-1; start+=lotWidth){
    const end=start+lotWidth-1;
    const centerX=Math.floor((start+end)/2);
    const driveway={curbX:centerX,curbY};
    const houseY=curbY + sign*setback;
    const bounds={
      minX:start,maxX:end,
      minY:Math.min(lotNearY, lotNearY + sign*(lotDepth-1)),
      maxY:Math.max(lotNearY, lotNearY + sign*(lotDepth-1)),
    };

    const curbByKeyLocal=new Map(curbCells.map(c=>[key(c.x,c.y),c]));
    const drivewayCurb=curbByKeyLocal.get(key(driveway.curbX,driveway.curbY));
    if(!drivewayCurb || !drivewayCurb.module.startsWith('curb-straight-')) continue;

    let blocked=false;
    for(let x=bounds.minX;x<=bounds.maxX && !blocked;x++){
      for(let y=bounds.minY;y<=bounds.maxY;y++){
        if(road.has(key(x,y))){ blocked=true; break; }
      }
    }
    if(blocked) continue;

    lots.push({
      id:`${street.id}-${cfg.side}-lot-${String(ordinal+1).padStart(2,'0')}`,
      streetId:street.id,
      side:cfg.side,
      bounds,
      frontage:{fromX:start,toX:end,y:curbY},
      driveway,
      houseSocket:{x:centerX,y:houseY,facing:cfg.side==='south'?'north':'south'},
    });
    ordinal++;
  }

  const curbByKey=new Map(curbCells.map(c=>[key(c.x,c.y),c]));
  for(const lot of lots){
    const c=curbByKey.get(key(lot.driveway.curbX,lot.driveway.curbY));
    if(c && c.module.startsWith('curb-straight-')){
      c.module='curb-driveway';
      c.variant='curb-driveway';
      c.stormDrain=false;
    }
  }
  return lots;
}

export function compileStreetLayout(spec) {
  if (!spec || typeof spec !== 'object') throw new Error('street_layout_spec_required');
  const tileMeters = spec.tileMeters ?? 2;
  if (!(Number.isFinite(tileMeters) && tileMeters > 0)) throw new Error('tileMeters_invalid');
  if (!Array.isArray(spec.streets) || spec.streets.length === 0) throw new Error('streets_required');

  const road = new Set();
  const owner = new Map();
  const streets = spec.streets.map(s => addRoadSegment(road, owner, s));

  // First non-road cardinal ring is curb.
  const curb = new Set();
  for (const k of road) {
    const {x, y} = parseKey(k);
    for (const [, dx, dy] of CARDINAL) {
      const nk = key(x + dx, y + dy);
      if (!road.has(nk)) curb.add(nk);
    }
  }

  // Second ring is sidewalk, excluding road and curb.
  const blocked = new Set([...road, ...curb]);
  const sidewalk = ringOutside(curb, blocked);

  const streetById = new Map(streets.map(s => [s.id, s]));
  const roadCells = sortedCells(road).map(c => {
    const connections = cardinalRoadSides(c.x, c.y, road);
    const streetIds = [...new Set(owner.get(key(c.x,c.y)) ?? [])].sort();
    const owned = streetIds.map(id => streetById.get(id)).filter(Boolean);
    const axes = new Set(owned.map(s => s.axis));
    let marking = 'none';
    if (axes.size > 1) {
      marking = 'junction';
    } else if (owned.length) {
      const axis = owned[0].axis;
      if (axis === 'x' && owned.some(s => c.y === s.from.y)) marking = 'centerline-ew';
      if (axis === 'y' && owned.some(s => c.x === s.from.x)) marking = 'centerline-ns';
    }
    return {
      ...c,
      role: 'road',
      assetRole: 'groundAsphalt',
      streetIds,
      connections,
      variant: roadVariant(connections),
      marking,
    };
  });

  const curbCells = sortedCells(curb).map(c => {
    const roadSides = cardinalRoadSides(c.x, c.y, road);
    const module = curbModule(roadSides);
    const gutterEdge = roadSides.length === 1 ? roadSides[0] : null;
    return {
      ...c,
      role: 'curb',
      assetRole: 'groundConcrete',
      roadSides,
      variant: curbVariant(roadSides),
      module,
      gutterEdge,
      stormDrain: isStormDrainSocket(c, module),
    };
  });

  const sidewalkCells = sortedCells(sidewalk).map(c => ({
    ...c,
    role: 'sidewalk',
    assetRole: 'groundConcrete',
  }));

  const lots = compileResidentialFrontage(spec, streets, curbCells, road);

  return {
    schema: 'surround-me-street-layout-v1',
    tileMeters,
    streets,
    lots,
    cells: [...roadCells, ...curbCells, ...sidewalkCells],
    counts: {
      road: roadCells.length,
      curb: curbCells.length,
      sidewalk: sidewalkCells.length,
      lots: lots.length,
    },
  };
}

export function cellsByRole(layout, role) {
  return layout.cells.filter(c => c.role === role);
}
