(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.SurroundWorldArtCalibration = api;
})(typeof window !== 'undefined' ? window : globalThis, function () {
  const CALIBRATION_MODE_ID = 'hd-iso-v1';

  function assertTileSize(tileWidth, tileHeight) {
    if (!Number.isFinite(tileWidth) || tileWidth <= 0 || !Number.isFinite(tileHeight) || tileHeight <= 0) {
      throw new TypeError('tileWidth and tileHeight must be positive finite numbers');
    }
  }

  function worldToIso(x, y, tileWidth = 64, tileHeight = 32) {
    assertTileSize(tileWidth, tileHeight);
    if (!Number.isFinite(x) || !Number.isFinite(y)) throw new TypeError('world coordinates must be finite');
    return { x: (x - y) * (tileWidth / 2), y: (x + y) * (tileHeight / 2) };
  }

  function isoToWorld(screenX, screenY, tileWidth = 64, tileHeight = 32) {
    assertTileSize(tileWidth, tileHeight);
    if (!Number.isFinite(screenX) || !Number.isFinite(screenY)) throw new TypeError('screen coordinates must be finite');
    return {
      x: (screenX / (tileWidth / 2) + screenY / (tileHeight / 2)) / 2,
      y: (screenY / (tileHeight / 2) - screenX / (tileWidth / 2)) / 2
    };
  }

  function anchorScreenPosition(worldX, worldY, anchor, camera, tileWidth = 64, tileHeight = 32) {
    const ground = worldToIso(worldX, worldY, tileWidth, tileHeight);
    const ax = Array.isArray(anchor) ? anchor[0] : 0.5;
    const ay = Array.isArray(anchor) ? anchor[1] : 1;
    if (![ax, ay].every((v) => Number.isFinite(v) && v >= 0 && v <= 1)) {
      throw new TypeError('anchor must be normalized [x,y]');
    }
    const camX = camera && Number.isFinite(camera.x) ? camera.x : 0;
    const camY = camera && Number.isFinite(camera.y) ? camera.y : 0;
    const zoom = camera && Number.isFinite(camera.zoom) ? camera.zoom : 1;
    return { x: (ground.x + camX) * zoom, y: (ground.y + camY) * zoom, anchorX: ax, anchorY: ay };
  }

  return { CALIBRATION_MODE_ID, worldToIso, isoToWorld, anchorScreenPosition };
});
