import test from 'node:test';
import assert from 'node:assert/strict';
import { advanceSamsarraDepth, createSamsarraEvent } from '../world-art/samsarra-event.mjs';

const neutral = { g: 0, depth: 0, tier: 0, persist: 0 };
const tick = (event, sample, seconds) => {
    for (let i = 0; i < Math.round(seconds * 20); i++) event.update(sample, .05);
    return event.snapshot;
};
const extreme = g => ({ g, depth: .95, tier: 3, persist: .85 });

test('bleed and district pressure appear before a sustained fall', () => {
    const event = createSamsarraEvent();
    assert.equal(tick(event, { g: .68, depth: .33, tier: 1, persist: .6 }, .5).phase, 'bleed');
    assert.equal(tick(event, extreme(.9), .7).phase, 'pressure');
    assert.equal(event.update(extreme(.9), 0).phase, 'pressure');
    assert.equal(tick(event, neutral, 1).phase, 'ordinary');
    assert.equal(tick(event, extreme(.9), .7).phase, 'pressure');
    assert.equal(tick(event, extreme(-.9), .7).phase, 'pressure');
    assert.equal(tick(event, extreme(-.9), 2).phase, 'samsarra');
    assert.equal(event.snapshot.polarity, 'restraint');
});

test('fall holds its polarity and releases only after depth and persistence ease', () => {
    const event = createSamsarraEvent();
    assert.equal(tick(event, extreme(.9), 3).intensity, 1);
    assert.equal(tick(event, extreme(-.9), 2).polarity, 'compulsion');
    assert.equal(tick(event, { ...neutral, depth: .64 }, 2).phase, 'samsarra');
    assert.equal(tick(event, { ...neutral, persist: .6 }, 2).phase, 'samsarra');
    assert.equal(tick(event, neutral, .5).phase, 'samsarra');
    assert.equal(tick(event, neutral, .65).phase, 'release');
    assert.equal(tick(event, extreme(-.9), .05).phase, 'samsarra');
    assert.equal(tick(event, neutral, 3).phase, 'ordinary');
    assert.equal(event.snapshot.polarity, null);
    assert.equal(event.snapshot.intensity, 0);
});

test('review commands exercise the same transitions and yield to live Greyline', () => {
    const event = createSamsarraEvent();
    event.preview('compulsion');
    assert.equal(tick(event, neutral, .5).phase, 'pressure');
    assert.equal(tick(event, neutral, 2.5).polarity, 'compulsion');
    event.preview('restraint');
    assert.equal(tick(event, neutral, .25).phase, 'release');
    assert.equal(tick(event, neutral, 5).polarity, 'restraint');
    event.preview('release');
    assert.equal(tick(event, extreme(.9), 3).phase, 'ordinary');
    event.preview(null);
    assert.equal(tick(event, extreme(.9), 3).polarity, 'compulsion');
});

test('sustained edge pressure builds depth at ordinary persistence and fades near centre', () => {
    const config = { samFill: .35, samDecay: .30, samATheta: .70 };
    let depth = 0;
    for (let i = 0; i < 160; i++) {
        depth = advanceSamsarraDepth(depth, .90, .20, .05, config);
        if (i === 19) assert.ok(depth < .25, 'a brief extreme must stay ordinary');
    }
    assert.ok(depth >= .80, 'a sustained extreme must reach tier three');
    assert.ok(advanceSamsarraDepth(depth, .90, .50, .05, config) > depth);
    assert.equal(advanceSamsarraDepth(depth, .15, .20, 4, config), 0);
});
