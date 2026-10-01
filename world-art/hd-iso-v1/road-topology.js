(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.SurroundRoadTopology = api;
})(typeof window !== 'undefined' ? window : globalThis, function () {
  const DIRECTION_BITS = Object.freeze({ N: 1, E: 2, S: 4, W: 8 });
  const ORDER = ['N', 'E', 'S', 'W'];

  const TOPOLOGY_BY_MASK = Object.freeze([
    'none',
    'dead_end_n',
    'dead_end_e',
    'corner_ne',
    'dead_end_s',
    'straight_ns',
    'corner_se',
    't_missing_w',
    'dead_end_w',
    'corner_nw',
    'straight_ew',
    't_missing_s',
    'corner_sw',
    't_missing_e',
    't_missing_n',
    'cross',
  ]);

  const ALIASES = Object.freeze({
    N: ['N', 'north'],
    E: ['E', 'east'],
    S: ['S', 'south'],
    W: ['W', 'west'],
  });

  function assertMask(mask) {
    if (!Number.isInteger(mask) || mask < 0 || mask > 15) {
      throw new TypeError('road topology mask must be an integer from 0 to 15');
    }
    return mask;
  }

  function topologyForMask(mask) {
    return TOPOLOGY_BY_MASK[assertMask(mask)];
  }

  function readDirection(connections, direction) {
    const source = connections || {};
    let seen = false;
    let value = false;
    for (const key of ALIASES[direction]) {
      if (!Object.prototype.hasOwnProperty.call(source, key)) continue;
      const candidate = source[key];
      if (typeof candidate !== 'boolean') {
        throw new TypeError(`road connection ${key} must be boolean when supplied`);
      }
      if (seen && candidate !== value) {
        throw new Error(`conflicting road connection aliases for ${direction}`);
      }
      seen = true;
      value = candidate;
    }
    return value;
  }

  function maskFromConnections(connections) {
    if (connections != null && typeof connections !== 'object') {
      throw new TypeError('road connections must be an object');
    }
    let mask = 0;
    for (const direction of ORDER) {
      if (readDirection(connections || {}, direction)) mask |= DIRECTION_BITS[direction];
    }
    return mask;
  }

  function topologyForConnections(connections) {
    return topologyForMask(maskFromConnections(connections));
  }

  function describeMask(mask) {
    assertMask(mask);
    const connections = ORDER.filter(direction => (mask & DIRECTION_BITS[direction]) !== 0);
    return {
      mask,
      topology: topologyForMask(mask),
      connections,
      degree: connections.length,
    };
  }

  return {
    DIRECTION_BITS,
    TOPOLOGY_BY_MASK,
    maskFromConnections,
    topologyForMask,
    topologyForConnections,
    describeMask,
  };
});
