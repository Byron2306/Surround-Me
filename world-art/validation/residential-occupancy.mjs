const EPSILON = 1e-9;

function cellBounds(cell) {
  return {
    minX: cell.x - 0.5,
    maxX: cell.x + 0.5,
    minY: cell.y - 0.5,
    maxY: cell.y + 0.5
  };
}

function intersects(a, b) {
  return (
    a.minX < b.maxX - EPSILON &&
    a.maxX > b.minX + EPSILON &&
    a.minY < b.maxY - EPSILON &&
    a.maxY > b.minY + EPSILON
  );
}

function lotBounds(lot) {
  return {
    minX: lot.bounds.minX - 0.5,
    maxX: lot.bounds.maxX + 0.5,
    minY: lot.bounds.minY - 0.5,
    maxY: lot.bounds.maxY + 0.5
  };
}

function contains(outer, inner) {
  return (
    inner.minX >= outer.minX - EPSILON &&
    inner.maxX <= outer.maxX + EPSILON &&
    inner.minY >= outer.minY - EPSILON &&
    inner.maxY <= outer.maxY + EPSILON
  );
}

export function buildingFootprint(placement, dimensions) {
  const halfWidth = dimensions.widthM / 4;
  const depth = dimensions.depthM / 2;

  return {
    minX: placement.x - halfWidth,
    maxX: placement.x + halfWidth,
    minY: placement.y - depth,
    maxY: placement.y
  };
}

export function validateResidentialPlacement(
  layout,
  lot,
  placement,
  dimensions
) {
  const footprint = buildingFootprint(
    placement,
    dimensions
  );

  const parcel = lotBounds(lot);

  const publicCells = layout.cells.filter(
    cell => [
      'road',
      'curb',
      'sidewalk'
    ].includes(cell.role)
  );

  const parcelConflicts = publicCells.filter(
    cell => intersects(parcel, cellBounds(cell))
  );

  const footprintConflicts = publicCells.filter(
    cell => intersects(footprint, cellBounds(cell))
  );

  const reasons = [];

  if (!contains(parcel, footprint)) {
    reasons.push('FOOTPRINT_OUTSIDE_PARCEL');
  }

  if (parcelConflicts.length) {
    reasons.push('PARCEL_PUBLIC_INFRASTRUCTURE_OVERLAP');
  }

  if (footprintConflicts.length) {
    reasons.push('BUILDING_PUBLIC_INFRASTRUCTURE_OVERLAP');
  }

  return {
    status: reasons.length ? 'REFUSE' : 'PASS',
    lotId: lot.id,
    houseKind: placement.houseKind,
    parcel,
    footprint,
    parcelConflicts: parcelConflicts.map(
      ({x, y, role}) => ({x, y, role})
    ),
    footprintConflicts: footprintConflicts.map(
      ({x, y, role}) => ({x, y, role})
    ),
    reasons
  };
}
