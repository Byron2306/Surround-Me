
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

import {
  streetReviewLayout,
  reviewHousePlacements
} from '../world-art/street-layout-review.mjs';

import {
  bindA01Porch,
  checkA01Porch,
  evaluateA01V8
} from '../world-art/validation/residential-admission-v8.mjs';

const layout=streetReviewLayout();
const placement=reviewHousePlacements(layout)
  .find(p=>p.houseKind==='A01');

const lot=layout.lots.find(
  l=>l.id===placement.lotId
);

const source=JSON.parse(
  fs.readFileSync(
    new URL(
      '../evidence/residential-v8/a01-source-binding.json',
      import.meta.url
    ),
    'utf8'
  )
);

const shifted={
  ...placement,
  x:44.5
};

test('actual porch dimensions are bound',()=>{
  assert.deepEqual(
    source.porch.boundsM,
    [2,1,1.1]
  );
});

test('porch centre follows door lateral position',()=>{
  const result=bindA01Porch(
    shifted,
    source
  );

  assert.equal(
    result.doorX,
    43.825
  );

  assert.equal(
    result.footprint.minX,
    43.325
  );

  assert.equal(
    result.footprint.maxX,
    44.325
  );
});

test('porch is attached to front facade',()=>{
  const result=bindA01Porch(
    shifted,
    source
  );

  assert.equal(
    result.footprint.minY,
    46
  );

  assert.equal(
    result.footprint.maxY,
    46.5
  );
});

test('porch clears public infrastructure',()=>{
  const result=checkA01Porch(
    layout,
    lot,
    shifted,
    source
  );

  assert.equal(
    result.clearance.status,
    'PASS'
  );
});

test('coordinate authority remains provisional',()=>{
  const result=bindA01Porch(
    shifted,
    source
  );

  assert.equal(
    result.coordinateAuthority,
    'PROVISIONAL'
  );
});

test('access cannot pass without segment proof',()=>{
  const result=evaluateA01V8({
    layout,
    lot,
    placement:shifted,
    source
  });

  assert.equal(
    result.access.status,
    'PENDING'
  );

  assert.ok(
    result.access.reasons.includes(
      'ACCESS_SEGMENT_CLEARANCE_UNVERIFIED'
    )
  );

  assert.equal(
    result.productionAdmission,
    'REFUSE'
  );
});
