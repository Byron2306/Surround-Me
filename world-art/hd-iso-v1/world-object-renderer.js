(function (root, factory) {
  const api = factory(root && root.SurroundWorldArtCalibration);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.SurroundWorldArtRenderer = api;
})(typeof window !== 'undefined' ? window : globalThis, function (calibration) {
  const LAYER_ORDER = {
    ground: 0,
    road_decal: 1,
    structure_vehicle_prop: 2,
    vegetation: 3,
    atmosphere: 4,
  };

  function projectedDepth(object, tileWidth = 64, tileHeight = 32) {
    const p = calibration
      ? calibration.worldToIso(object.worldX, object.worldY, tileWidth, tileHeight)
      : { y: (object.worldX + object.worldY) * (tileHeight / 2) };
    return p.y + (Number.isFinite(object.zBias) ? object.zBias : 0);
  }

  function compareWorldArtObjects(a, b) {
    const la = LAYER_ORDER[a.layer || 'structure_vehicle_prop'] ?? 2;
    const lb = LAYER_ORDER[b.layer || 'structure_vehicle_prop'] ?? 2;
    if (la !== lb) return la - lb;
    const da = projectedDepth(a);
    const db = projectedDepth(b);
    if (da !== db) return da - db;
    return String(a.assetId).localeCompare(String(b.assetId));
  }

  function drawWorldArtObject(ctx, object, camera, registry) {
    const record = registry.require(object.assetId);
    const image = registry.imageFor(object.assetId);
    if (!image) throw new Error(`world-art image not loaded: ${object.assetId}`);
    const tileWidth = object.tileWidth || 64;
    const tileHeight = object.tileHeight || 32;
    const p = calibration
      ? calibration.worldToIso(object.worldX, object.worldY, tileWidth, tileHeight)
      : { x: (object.worldX - object.worldY) * tileWidth / 2, y: (object.worldX + object.worldY) * tileHeight / 2 };
    const camX = camera && Number.isFinite(camera.x) ? camera.x : 0;
    const camY = camera && Number.isFinite(camera.y) ? camera.y : 0;
    const anchor = record.anchor || [0.5, 1];
    const runtimePixels = record.runtimePixels || [image.width, image.height];
    const footprint = object.displayFootprintTiles || record.footprintTiles || [1, 1];
    const width = (footprint[0] + footprint[1]) * (tileWidth / 2);
    const sourceAspect = runtimePixels[0] > 0 ? runtimePixels[1] / runtimePixels[0] : image.height / image.width;
    const height = width * sourceAspect;
    const dx = p.x + camX - width * anchor[0];
    const dy = p.y + camY - height * anchor[1];
    ctx.drawImage(image, dx, dy, width, height);
    return { x: dx, y: dy, width, height, depth: projectedDepth(object, tileWidth, tileHeight) };
  }

  return { LAYER_ORDER, projectedDepth, compareWorldArtObjects, drawWorldArtObject };
});
