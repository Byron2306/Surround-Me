export const HOUSE_A_TRUTH = Object.freeze({
  templateId: 'house.master.a',
  seed: 18427,
  widthM: 7.5,
  depthM: 6.0,
  widthWorld: 3.75,
  depthWorld: 3.0,
  maxHeightM: 4.8,
  wallHeightM: 2.6856203614167002,
  roofPitchDegrees: 33.59802181853683,
  roofRiseM: 1.9930459389720596,
  eaveOverhangM: 0.3547842106675055,
  doorWidthM: 0.9,
  doorHeightM: 2.0,
  doorLateralPosition: 0.32,
  frontWindows: Object.freeze([
    Object.freeze({
      lateralPosition: 0.86,
      widthM: 0.8995548081318161,
      heightM: 1.2409739296969693,
      sillHeightM: 0.8500700525319953,
    }),
  ]),
  anchor: Object.freeze([0.5, 1.0]),
  metresPerWorldUnit: 2.0,
});

const VERTICAL_PX_PER_METRE = 8 * Math.sqrt(6);

function metresToWorld(metres) {
  return metres / HOUSE_A_TRUTH.metresPerWorldUnit;
}

function elevate(point, metres) {
  return { x: point.x, y: point.y - metres * VERTICAL_PX_PER_METRE };
}

function polygon(ctx, points) {
  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);
  for (let i = 1; i < points.length; i += 1) ctx.lineTo(points[i].x, points[i].y);
  ctx.closePath();
}

function fillAndStroke(ctx, points, fillStyle, strokeStyle = 'rgba(205, 235, 240, 0.72)') {
  polygon(ctx, points);
  ctx.fillStyle = fillStyle;
  ctx.fill();
  ctx.strokeStyle = strokeStyle;
  ctx.stroke();
}

function openingPolygon(project, originX, originY, lateralPosition, widthM, baseHeightM, heightM) {
  const y = originY + HOUSE_A_TRUTH.depthWorld;
  const centreX = originX + HOUSE_A_TRUTH.widthWorld * lateralPosition;
  const halfWidthWorld = metresToWorld(widthM) / 2;
  const baseLeft = project(centreX - halfWidthWorld, y);
  const baseRight = project(centreX + halfWidthWorld, y);
  return [
    elevate(baseLeft, baseHeightM),
    elevate(baseRight, baseHeightM),
    elevate(baseRight, baseHeightM + heightM),
    elevate(baseLeft, baseHeightM + heightM),
  ];
}

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

export function buildHouseAGreyboxGeometry(originX, originY, project) {
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
  const wallTop = ground.map((point) => elevate(point, HOUSE_A_TRUTH.wallHeightM));

  const wallFaces = [
    [ground[0], ground[1], wallTop[1], wallTop[0]],
    [ground[1], ground[2], wallTop[2], wallTop[1]],
    [ground[2], ground[3], wallTop[3], wallTop[2]],
    [ground[3], ground[0], wallTop[0], wallTop[3]],
  ];

  const eaveWorld = metresToWorld(HOUSE_A_TRUTH.eaveOverhangM);
  const roofX0 = x0 - eaveWorld;
  const roofX1 = x1 + eaveWorld;
  const roofBackY = y0 - eaveWorld;
  const roofFrontY = y1 + eaveWorld;
  const ridgeY = (y0 + y1) / 2;
  const roofPlateHeightM = HOUSE_A_TRUTH.wallHeightM;
  const ridgeHeightM = HOUSE_A_TRUTH.wallHeightM + HOUSE_A_TRUTH.roofRiseM;

  const roofBackLeft = elevate(project(roofX0, roofBackY), roofPlateHeightM);
  const roofBackRight = elevate(project(roofX1, roofBackY), roofPlateHeightM);
  const roofFrontLeft = elevate(project(roofX0, roofFrontY), roofPlateHeightM);
  const roofFrontRight = elevate(project(roofX1, roofFrontY), roofPlateHeightM);
  const ridgeLeft = elevate(project(roofX0, ridgeY), ridgeHeightM);
  const ridgeRight = elevate(project(roofX1, ridgeY), ridgeHeightM);

  const roofFaces = [
    [roofBackLeft, roofBackRight, ridgeRight, ridgeLeft],
    [ridgeLeft, ridgeRight, roofFrontRight, roofFrontLeft],
  ];

  const frontDoor = {
    widthM: HOUSE_A_TRUTH.doorWidthM,
    heightM: HOUSE_A_TRUTH.doorHeightM,
    lateralPosition: HOUSE_A_TRUTH.doorLateralPosition,
    polygon: openingPolygon(
      project,
      originX,
      originY,
      HOUSE_A_TRUTH.doorLateralPosition,
      HOUSE_A_TRUTH.doorWidthM,
      0,
      HOUSE_A_TRUTH.doorHeightM,
    ),
  };

  const frontWindows = HOUSE_A_TRUTH.frontWindows.map((window) => ({
    ...window,
    polygon: openingPolygon(
      project,
      originX,
      originY,
      window.lateralPosition,
      window.widthM,
      window.sillHeightM,
      window.heightM,
    ),
  }));

  const anchorWorld = {
    x: originX + HOUSE_A_TRUTH.widthWorld * HOUSE_A_TRUTH.anchor[0],
    y: originY + HOUSE_A_TRUTH.depthWorld * HOUSE_A_TRUTH.anchor[1],
  };

  return {
    ground,
    wallTop,
    wallFaces,
    roofFaces,
    frontDoor,
    frontWindows,
    anchorWorld,
    anchorScreen: project(anchorWorld.x, anchorWorld.y),
    wallHeightM: HOUSE_A_TRUTH.wallHeightM,
    roofPitchDegrees: HOUSE_A_TRUTH.roofPitchDegrees,
    roofRiseM: HOUSE_A_TRUTH.roofRiseM,
    eaveOverhangM: HOUSE_A_TRUTH.eaveOverhangM,
  };
}

/**
 * Draw seed 18427 House Master A as a solid deterministic calibration greybox.
 * sx/sy are the live-game screen coordinates of the geometry origin after camera offset.
 */
export function drawHouseATruthOverlay(ctx, sx, sy, project) {
  const relativeProject = (wx, wy) => {
    const p = project(wx, wy);
    return { x: sx + p.x, y: sy + p.y };
  };
  const g = buildHouseAGreyboxGeometry(0, 0, relativeProject);

  ctx.save();
  ctx.lineWidth = 1.05;
  ctx.lineJoin = 'round';
  ctx.font = '8px monospace';
  ctx.textBaseline = 'bottom';

  // Opaque-enough architectural mass while preserving the live scene beneath it.
  fillAndStroke(ctx, g.wallFaces[0], 'rgba(112, 126, 130, 0.84)');
  fillAndStroke(ctx, g.wallFaces[3], 'rgba(91, 104, 108, 0.88)');
  fillAndStroke(ctx, g.wallFaces[1], 'rgba(101, 115, 119, 0.90)');
  fillAndStroke(ctx, g.wallFaces[2], 'rgba(126, 139, 142, 0.94)');

  // Gable roof, ridge axis X, using seed-18427 pitch and eave overhang.
  fillAndStroke(ctx, g.roofFaces[0], 'rgba(67, 73, 76, 0.96)', 'rgba(220, 238, 240, 0.78)');
  fillAndStroke(ctx, g.roofFaces[1], 'rgba(78, 84, 87, 0.98)', 'rgba(220, 238, 240, 0.78)');

  // Front opening shapes are authoritative dimensions, not decorative guesses.
  fillAndStroke(ctx, g.frontDoor.polygon, 'rgba(38, 31, 28, 0.98)', 'rgba(255, 194, 82, 0.95)');
  for (const window of g.frontWindows) {
    fillAndStroke(ctx, window.polygon, 'rgba(28, 43, 47, 0.96)', 'rgba(160, 218, 230, 0.86)');
  }

  // Preserve a faint footprint/anchor truth layer for calibration.
  polygon(ctx, g.ground);
  ctx.strokeStyle = 'rgba(60, 235, 255, 0.48)';
  ctx.stroke();

  const anchor = g.anchorScreen;
  ctx.strokeStyle = 'rgba(255, 90, 70, 0.95)';
  ctx.beginPath();
  ctx.moveTo(anchor.x - 4, anchor.y);
  ctx.lineTo(anchor.x + 4, anchor.y);
  ctx.moveTo(anchor.x, anchor.y - 4);
  ctx.lineTo(anchor.x, anchor.y + 4);
  ctx.stroke();

  const labelPoint = g.roofFaces[0][0];
  ctx.fillStyle = 'rgba(235, 250, 255, 0.92)';
  ctx.fillText('HOUSE A  seed 18427', labelPoint.x, labelPoint.y - 4);
  ctx.fillText('7.5 x 6.0m  pitch 33.598deg', labelPoint.x, labelPoint.y + 7);

  ctx.restore();
}
