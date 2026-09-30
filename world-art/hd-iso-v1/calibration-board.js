(function (root, factory) {
  const api = factory(root && root.SurroundWorldArtCalibration);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.SurroundWorldArtCalibrationBoard = api;
})(typeof window !== 'undefined' ? window : globalThis, function (calibration) {
  function drawCalibrationBoard(ctx, camera, state = {}) {
    if (!ctx || !calibration) return;
    const tileWidth = state.tileWidth || 64;
    const tileHeight = state.tileHeight || 32;
    const radius = state.radius || 6;
    const cam = camera || { x: 0, y: 0, zoom: 1 };

    ctx.save();
    ctx.lineWidth = 1 / (cam.zoom || 1);
    ctx.strokeStyle = 'rgba(210,210,210,0.26)';
    for (let x = -radius; x <= radius; x++) {
      for (let y = -radius; y <= radius; y++) {
        const p = calibration.worldToIso(x, y, tileWidth, tileHeight);
        const sx = p.x + (cam.x || 0);
        const sy = p.y + (cam.y || 0);
        ctx.beginPath();
        ctx.moveTo(sx, sy - tileHeight / 2);
        ctx.lineTo(sx + tileWidth / 2, sy);
        ctx.lineTo(sx, sy + tileHeight / 2);
        ctx.lineTo(sx - tileWidth / 2, sy);
        ctx.closePath();
        ctx.stroke();
      }
    }

    const origin = calibration.worldToIso(0, 0, tileWidth, tileHeight);
    const ox = origin.x + (cam.x || 0);
    const oy = origin.y + (cam.y || 0);
    ctx.strokeStyle = 'rgba(255,220,120,0.9)';
    ctx.beginPath();
    ctx.moveTo(ox - 12, oy); ctx.lineTo(ox + 12, oy);
    ctx.moveTo(ox, oy - 12); ctx.lineTo(ox, oy + 12);
    ctx.stroke();

    ctx.fillStyle = 'rgba(255,255,255,0.86)';
    ctx.font = '10px monospace';
    ctx.fillText('HD-ISO-V1 origin', ox + 8, oy - 8);
    ctx.fillText('door ref: 2.0m', ox + 40, oy - 48);
    ctx.fillText('car ref: 4.5m', ox + 40, oy - 34);
    if (Number.isFinite(state.alizaScreenHeightPx)) {
      ctx.fillText(`Aliza: ${state.alizaScreenHeightPx.toFixed(1)}px screen`, ox + 40, oy - 20);
    }
    ctx.restore();
  }

  return { drawCalibrationBoard };
});
