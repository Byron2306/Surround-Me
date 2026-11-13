import test from 'node:test';
import assert from 'node:assert/strict';

import {
  validateResidentialPlacement
} from '../world-art/validation/residential-occupancy.mjs';

import {
  streetReviewLayout,
  reviewHousePlacements
} from '../world-art/street-layout-review.mjs';

test('A01 overlapping sidewalk is refused', () => {
  const layout = streetReviewLayout();
  const placement = reviewHousePlacements(layout)[0];
  const lot = layout.lots[0];

  const result = validateResidentialPlacement(
    layout,
    lot,
    placement,
    {widthM:7.5, depthM:6}
  );

  assert.equal(result.status, 'REFUSE');

  assert.ok(
    result.reasons.includes(
      'BUILDING_PUBLIC_INFRASTRUCTURE_OVERLAP'
    )
  );
});

test('A02 has no building/public infrastructure overlap', () => {
  const layout = streetReviewLayout();
  const placement = reviewHousePlacements(layout)[1];
  const lot = layout.lots[1];

  const result = validateResidentialPlacement(
    layout,
    lot,
    placement,
    {widthM:6, depthM:6}
  );

  assert.equal(
    result.footprintConflicts.length,
    0
  );
});

test('parcel infrastructure conflicts are reported', () => {
  const layout = streetReviewLayout();
  const placements = reviewHousePlacements(layout);

  const results = placements.map((placement, index) =>
    validateResidentialPlacement(
      layout,
      layout.lots[index],
      placement,
      {
        widthM: index === 0 ? 7.5 : 6,
        depthM: 6
      }
    )
  );

  assert.ok(
    results.some(result =>
      result.reasons.includes(
        'PARCEL_PUBLIC_INFRASTRUCTURE_OVERLAP'
      )
    )
  );
});
