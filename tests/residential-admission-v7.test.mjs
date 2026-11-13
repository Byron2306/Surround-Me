
import test from 'node:test';
import assert from 'node:assert/strict';

import {
  streetReviewLayout,
  reviewHousePlacements
} from '../world-art/street-layout-review.mjs';

import {
  deriveBuildableCells,
  structureFootprint,
  checkStructure,
  residentialAdmission
} from '../world-art/validation/residential-admission-v7.mjs';

const layout=streetReviewLayout();
const placements=reviewHousePlacements(layout);

const a01=placements[0];
const a02=placements[1];

const lot1=layout.lots[0];
const lot2=layout.lots[1];

test('public infrastructure is excluded from buildable cells',()=>{
  const result=deriveBuildableCells(layout,lot1);

  assert.ok(result.excluded.length>0);

  assert.equal(
    result.usable.length+result.excluded.length,
    result.nominalCellCount
  );
});

test('original A01 footprint conflicts with sidewalk',()=>{
  const footprint=structureFootprint(
    a01,7.5,6
  );

  const result=checkStructure(
    layout,lot1,footprint
  );

  assert.equal(result.status,'REFUSE');
  assert.ok(result.conflicts.some(
    cell=>cell.role==='sidewalk'
  ));
});

test('A01 shifted half a tile clears public infrastructure',()=>{
  const shifted={
    ...a01,
    x:44.5
  };

  const footprint=structureFootprint(
    shifted,7.5,6
  );

  const result=checkStructure(
    layout,lot1,footprint
  );

  assert.equal(result.status,'PASS');
});

test('original A02 footprint remains clear',()=>{
  const footprint=structureFootprint(
    a02,6,6
  );

  const result=checkStructure(
    layout,lot2,footprint
  );

  assert.equal(result.status,'PASS');
});

test('A01 porch without footprint refuses admission',()=>{
  const result=residentialAdmission(
    layout,
    lot1,
    {...a01,x:44.5},
    {
      widthM:7.5,
      depthM:6,
      attachments:[
        {
          name:'porch',
          boundsM:[2.4,1.2,1.2]
        }
      ]
    }
  );

  assert.equal(result.status,'REFUSE');

  assert.ok(result.reasons.includes(
    'ATTACHMENT_NOT_ADMITTED'
  ));
});

test('access without route proof refuses admission',()=>{
  const result=residentialAdmission(
    layout,
    lot2,
    a02,
    {
      widthM:6,
      depthM:6,
      attachments:[]
    }
  );

  assert.equal(result.status,'REFUSE');

  assert.ok(result.reasons.includes(
    'ACCESS_ROUTE_NOT_VERIFIED'
  ));

  assert.equal(result.main.status,'PASS');
});
