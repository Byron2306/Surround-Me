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

  const roadCells = sortedCells(road).map(c => ({
    ...c,
    role: 'road',
    assetRole: 'groundRoad',
    streetIds: [...new Set(owner.get(key(c.x,c.y)) ?? [])].sort(),
  }));

  const curbCells = sortedCells(curb).map(c => {
    const roadSides = cardinalRoadSides(c.x, c.y, road);
    return {
      ...c,
      role: 'curb',
      assetRole: 'groundConcrete',
      roadSides,
      variant: curbVariant(roadSides),
    };
  });

  const sidewalkCells = sortedCells(sidewalk).map(c => ({
    ...c,
    role: 'sidewalk',
    assetRole: 'groundConcrete',
  }));

  return {
    schema: 'surround-me-street-layout-v1',
    tileMeters,
    streets,
    cells: [...roadCells, ...curbCells, ...sidewalkCells],
    counts: {
      road: roadCells.length,
      curb: curbCells.length,
      sidewalk: sidewalkCells.length,
    },
  };
}

export function cellsByRole(layout, role) {
  return layout.cells.filter(c => c.role === role);
}
