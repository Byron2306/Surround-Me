# Surround Me Phase A Acceptance

Status: **NEEDS_REVIEW**

Phase A is not accepted until every mandatory entry in `acceptance-checklist.json` is `PASS` and `tools/verify_phase_a_acceptance.py` returns zero errors.

## Frozen references

- Projection: orthographic game-isometric
- Grid: 64 × 32 logical pixels per diamond
- Closest normal gameplay zoom: 2.0625
- Aliza reference: 80 logical px / 165 screen px
- Reference exterior door: 2.0 m
- Reference sedan: 4.5 m
- Lighting: neutral-cool overcast, northwest toward southeast
- Asset scale tolerance before regeneration/review: ±3%

## Murder-test protocol

Inspect at far zoom, normal gameplay zoom, and 2.0625 closest-normal zoom. Walk Aliza around every building corner, between parked vehicles, along curbs, beneath utility infrastructure, and through the complete intersection.

REFUSE any asset or placement showing perspective drift, scale jumps, soft/flat close detail, alpha halos, floating ground contact, depth-sort pops, collision mismatch, broken road continuity, unreadable clutter, or fog that conceals gameplay truth.

Do not convert REFUSE to PASS by shrinking the object, reducing gameplay zoom, hiding it in fog, or applying an arbitrary per-object runtime scale constant. Regenerate or correct the underlying asset/metadata.

## Current gate

One recovered original Surround Me suburban-house master has entered `candidate` state after automated alpha/dimension validation. The remaining Golden Four masters and full Phase A kit are still required before the human visual gate can run.
