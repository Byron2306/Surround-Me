(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.SurroundPhaseAScene = api;
})(typeof window !== 'undefined' ? window : globalThis, function () {
  const LAYERS = {
    ground: 0,
    road_decal: 1,
    structure_vehicle_prop: 2,
    vegetation: 3,
    atmosphere: 4
  };

  function projectedDepth(object, tileHeight = 32) {
    return (object.worldX + object.worldY) * (tileHeight / 2) +
      (Number.isFinite(object.zBias) ? object.zBias : 0);
  }

  function assertPointInsideBounds(object, bounds) {
    if (
      !Number.isFinite(object.worldX) || !Number.isFinite(object.worldY) ||
      object.worldX < bounds.minX || object.worldX > bounds.maxX ||
      object.worldY < bounds.minY || object.worldY > bounds.maxY
    ) {
      throw new Error(`Phase A object ${object.assetId || '<unknown>'} is outside scene bounds`);
    }
  }

  function collisionRect(object, record) {
    const fp = object.collisionFootprint || record.footprintTiles;
    if (!Array.isArray(fp) || fp.length !== 2 || !fp.every(v => Number.isFinite(v) && v > 0)) {
      throw new Error(`Phase A object ${object.assetId} has invalid collision footprint`);
    }
    const halfW = fp[0] / 2;
    const halfH = fp[1] / 2;
    return {
      assetId: object.assetId,
      minX: object.worldX - halfW,
      minY: object.worldY - halfH,
      maxX: object.worldX + halfW,
      maxY: object.worldY + halfH
    };
  }

  function normalizeObject(raw, registry, defaultLayer) {
    if (!raw || typeof raw !== 'object') throw new TypeError('Phase A scene object must be an object');
    if (typeof raw.assetId !== 'string' || !raw.assetId) throw new Error('Phase A scene object requires assetId');
    const record = registry.require(raw.assetId);
    const object = {
      assetId: raw.assetId,
      worldX: Number(raw.worldX),
      worldY: Number(raw.worldY),
      zBias: Number.isFinite(raw.zBias) ? raw.zBias : 0,
      layer: raw.layer || defaultLayer,
      blocking: raw.blocking === true,
      variant: raw.variant == null ? null : raw.variant,
      collisionFootprint: raw.collisionFootprint || null
    };
    return { object, record };
  }

  function sortObjects(objects) {
    return objects.slice().sort((a, b) => {
      const la = LAYERS[a.layer] ?? LAYERS.structure_vehicle_prop;
      const lb = LAYERS[b.layer] ?? LAYERS.structure_vehicle_prop;
      if (la !== lb) return la - lb;
      const da = projectedDepth(a);
      const db = projectedDepth(b);
      if (da !== db) return da - db;
      return a.assetId.localeCompare(b.assetId);
    });
  }

  function loadPhaseABlock(sceneData, registry) {
    if (!sceneData || typeof sceneData !== 'object') throw new TypeError('sceneData is required');
    if (!registry || typeof registry.require !== 'function') throw new TypeError('registry.require is required');
    const bounds = sceneData.bounds;
    const spawn = sceneData.spawn;
    if (!bounds || !['minX','minY','maxX','maxY'].every(k => Number.isFinite(bounds[k]))) {
      throw new Error('Phase A scene bounds are required');
    }
    if (bounds.minX >= bounds.maxX || bounds.minY >= bounds.maxY) throw new Error('Phase A scene bounds are invalid');
    if (!spawn || !Number.isFinite(spawn.x) || !Number.isFinite(spawn.y)) throw new Error('Phase A spawn is required');
    if (spawn.x < bounds.minX || spawn.x > bounds.maxX || spawn.y < bounds.minY || spawn.y > bounds.maxY) {
      throw new Error('Phase A spawn is outside scene bounds');
    }

    const normalized = [];
    const collisions = [];

    if (sceneData.ground) {
      const { object: groundObject } = normalizeObject(sceneData.ground, registry, 'ground');
      assertPointInsideBounds(groundObject, bounds);
    }

    const groups = [
      [Array.isArray(sceneData.objects) ? sceneData.objects : [], 'structure_vehicle_prop'],
      [Array.isArray(sceneData.atmosphere) ? sceneData.atmosphere : [], 'atmosphere']
    ];

    for (const [items, defaultLayer] of groups) {
      for (const raw of items) {
        const { object, record } = normalizeObject(raw, registry, defaultLayer);
        assertPointInsideBounds(object, bounds);
        normalized.push(object);
        if (object.blocking) collisions.push(collisionRect(object, record));
      }
    }

    return {
      objects: sortObjects(normalized),
      collisionRects: collisions,
      spawn: { x: spawn.x, y: spawn.y }
    };
  }

  return { loadPhaseABlock, projectedDepth };
});
