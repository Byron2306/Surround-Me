import { createRequire } from 'node:module';
import test from 'node:test';
import assert from 'node:assert/strict';
const require = createRequire(import.meta.url);
const { WorldArtRegistry } = require('../world-art/hd-iso-v1/runtime-registry.js');
const { loadSceneAssets } = require('../world-art/hd-iso-v1/asset-loader.js');
test('production refuses candidates before requesting their bytes', async () => {
  const registry = new WorldArtRegistry({assets:[{id:'car',status:'candidate',runtimeSource:'car.webp'}]});
  let called = false;
  const result = await loadSceneAssets(registry, ['car'], async () => { called = true; });
  assert.equal(called, false);
  assert.equal(result[0].state, 'REFUSE');
});
test('candidate preview attaches images without changing approval', async () => {
  const registry = new WorldArtRegistry({assets:[{id:'car',status:'candidate',runtimeSource:'car.webp'}]}, {baseUrl:'../../'});
  const image = {width:16,height:16};
  const results = await loadSceneAssets(registry, ['car','car'], async url => {assert.equal(url,'../../car.webp'); return image;}, {candidates:true});
  assert.equal(results.length, 1);
  assert.equal(registry.imageFor('car'), image);
  assert.throws(() => registry.require('car'), /not approved/);
});
test('missing bytes produce a visible diagnostic result', async () => {
  const registry = new WorldArtRegistry({assets:[{id:'shop',status:'candidate',runtimeSource:'shop.webp'}]});
  const results = await loadSceneAssets(registry, ['shop'], async () => {throw Error('HTTP 404');}, {candidates:true});
  assert.equal(results[0].state, 'REFUSE');
  assert.match(results[0].reason, /404/);
});
