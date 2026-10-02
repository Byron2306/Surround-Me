export const HOUSE_A_TRUTH = Object.freeze({
  templateId: 'house.master.a',
  seed: 18427,
  widthM: 7.5,
  depthM: 6.0,
  widthWorld: 3.75,
  depthWorld: 3.0,
  maxHeightM: 4.8,
  doorHeightM: 2.0,
  anchor: Object.freeze([0.5, 1.0]),
  metresPerWorldUnit: 2.0,
});

const VERTICAL_PX_PER_METRE = 8 * Math.sqrt(6);

export function buildHouseATruthGeometry(originX, originY, project) {
  const x0 = originX;
  const y0 = originY;
  const x1 = originX + HOUSE_A_TRUTH.widthWorld;
  const y1 = originY + HOUSE_A_TRUTH.depthWorld;

  const ground = [
    project(x0, y0),
    project(x1, y0),
    project(x1, y1),
    project(x0, y1),
  ];

  const anchorWorld = {
    x: originX + HOUSE_A_TRUTH.widthWorld * HOUSE_A_TRUTH.anchor[0],
    y: originY + HOUSE_A_TRUTH.depthWorld * HOUSE_A_TRUTH.anchor[1],
  };

  return {
    ground,
    anchorWorld,
    anchorScreen: project(anchorWorld.x, anchorWorld.y),
    verticalRisePx: HOUSE_A_TRUTH.maxHeightM * VERTICAL_PX_PER_METRE,
    doorRisePx: HOUSE_A_TRUTH.doorHeightM * VERTICAL_PX_PER_METRE,
  };
}

function strokeLoop(ctx, points) {
  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);
  for (let i = 1; i < points.length; i += 1) ctx.lineTo(points[i].x, points[i].y);
  ctx.closePath();
  ctx.stroke();
}

/**
 * Draw the approved House Master A calibration cage in live-game coordinates.
 * `sx`/`sy` are the screen coordinates of the geometry origin after camera offset.
 * The callback must be the live game's 64x32 worldToScreen transform.
 */
export function drawHouseATruthOverlay(ctx, sx, sy, project) {
  const relativeProject = (wx, wy) => {
    const p = project(wx, wy);
    return { x: sx + p.x, y: sy + p.y };
  };
  const g = buildHouseATruthGeometry(0, 0, relativeProject);
  const top = g.ground.map((p) => ({ x: p.x, y: p.y - g.verticalRisePx }));

  ctx.save();
  ctx.lineWidth = 1.25;
  ctx.font = '9px monospace';
  ctx.textBaseline = 'bottom';

  ctx.fillStyle = 'rgba(40, 220, 255, 0.08)';
  ctx.beginPath();
  ctx.moveTo(g.ground[0].x, g.ground[0].y);
  for (let i = 1; i < g.ground.length; i += 1) ctx.lineTo(g.ground[i].x, g.ground[i].y);
  ctx.closePath();
  ctx.fill();

  ctx.strokeStyle = 'rgba(60, 235, 255, 0.95)';
  strokeLoop(ctx, g.ground);
  strokeLoop(ctx, top);
  for (let i = 0; i < 4; i += 1) {
    ctx.beginPath();
    ctx.moveTo(g.ground[i].x, g.ground[i].y);
    ctx.lineTo(top[i].x, top[i].y);
    ctx.stroke();
  }

  const anchor = g.anchorScreen;
  ctx.strokeStyle = 'rgba(255, 90, 70, 1)';
  ctx.beginPath();
  ctx.moveTo(anchor.x - 5, anchor.y);
  ctx.lineTo(anchor.x + 5, anchor.y);
  ctx.moveTo(anchor.x, anchor.y - 5);
  ctx.lineTo(anchor.x, anchor.y + 5);
  ctx.stroke();

  // 2 m door/human-scale ruler on the front facade (the y=max edge).
  const frontA = g.ground[3];
  const frontB = g.ground[2];
  const doorBase = {
    x: (frontA.x + frontB.x) / 2,
    y: (frontA.y + frontB.y) / 2,
  };
  ctx.strokeStyle = 'rgba(255, 190, 60, 1)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(doorBase.x, doorBase.y);
  ctx.lineTo(doorBase.x, doorBase.y - g.doorRisePx);
  ctx.stroke();

  ctx.fillStyle = 'rgba(235, 250, 255, 0.95)';
  ctx.fillText('HOUSE MASTER A  7.5m x 6.0m', top[0].x, top[0].y - 5);
  ctx.fillText('4.8m envelope', top[3].x + 4, top[3].y);
  ctx.fillText('2.0m', doorBase.x + 4, doorBase.y - g.doorRisePx);
  ctx.fillStyle = 'rgba(255, 100, 80, 1)';
  ctx.fillText('ANCHOR', anchor.x + 7, anchor.y - 3);

  ctx.restore();
}
