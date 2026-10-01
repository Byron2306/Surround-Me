(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.SurroundPhaseAPlayer = api;
})(typeof window !== 'undefined' ? window : globalThis, function () {
  const PLAYER_LOGICAL_HEIGHT = 80;
  const PLAYER_SCREEN_HEIGHT_AT_NORMAL_ZOOM = 165;
  const DEFAULT_SPEED_TILES_PER_SECOND = 4;
  const DEFAULT_RADIUS_TILES = 0.25;

  function overlapsRect(x, y, radius, rect) {
    const nearestX = Math.max(rect.minX, Math.min(x, rect.maxX));
    const nearestY = Math.max(rect.minY, Math.min(y, rect.maxY));
    const dx = x - nearestX;
    const dy = y - nearestY;
    return dx * dx + dy * dy < radius * radius;
  }

  function blocked(x, y, radius, collisionRects) {
    return collisionRects.some(rect => overlapsRect(x, y, radius, rect));
  }

  function clampToBounds(value, min, max, radius) {
    return Math.max(min + radius, Math.min(max - radius, value));
  }

  function movementVector(input) {
    let dx = 0;
    let dy = 0;
    if (input.west) dx -= 1;
    if (input.east) dx += 1;
    if (input.north) dy -= 1;
    if (input.south) dy += 1;
    const length = Math.hypot(dx, dy);
    if (length > 0) {
      dx /= length;
      dy /= length;
    }
    return { dx, dy };
  }

  function stepPlayer(position, input, dtSeconds, collisionRects, options = {}) {
    if (!position || !Number.isFinite(position.x) || !Number.isFinite(position.y)) {
      throw new TypeError('position must contain finite x and y');
    }
    if (!Number.isFinite(dtSeconds) || dtSeconds < 0) {
      throw new TypeError('dtSeconds must be a non-negative finite number');
    }
    const speed = Number.isFinite(options.speedTilesPerSecond)
      ? options.speedTilesPerSecond
      : DEFAULT_SPEED_TILES_PER_SECOND;
    const radius = Number.isFinite(options.radiusTiles)
      ? options.radiusTiles
      : DEFAULT_RADIUS_TILES;
    const collisions = Array.isArray(collisionRects) ? collisionRects : [];
    const vector = movementVector(input || {});
    const distance = speed * dtSeconds;

    let nextX = position.x + vector.dx * distance;
    let nextY = position.y;
    if (options.bounds) {
      nextX = clampToBounds(nextX, options.bounds.minX, options.bounds.maxX, radius);
    }
    if (blocked(nextX, nextY, radius, collisions)) nextX = position.x;

    nextY = position.y + vector.dy * distance;
    if (options.bounds) {
      nextY = clampToBounds(nextY, options.bounds.minY, options.bounds.maxY, radius);
    }
    if (blocked(nextX, nextY, radius, collisions)) nextY = position.y;

    return { x: nextX, y: nextY };
  }

  return {
    PLAYER_LOGICAL_HEIGHT,
    PLAYER_SCREEN_HEIGHT_AT_NORMAL_ZOOM,
    DEFAULT_SPEED_TILES_PER_SECOND,
    DEFAULT_RADIUS_TILES,
    movementVector,
    overlapsRect,
    stepPlayer,
  };
});
