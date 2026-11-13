(function () {
  const canvas = document.getElementById('civil');
  const ctx = canvas.getContext('2d');
  const hud = document.getElementById('hud');
  const tileWidth = 64;
  const tileHeight = 32;
  const zoom = 2.0625;

  function resize() {
    canvas.width = Math.max(1200, window.innerWidth);
    canvas.height = Math.max(760, window.innerHeight);
  }

  function iso(x, y) {
    return window.SurroundWorldArtCalibration.worldToIso(x, y, tileWidth, tileHeight);
  }

  function diamondForRect(centerWorld, sizeM, worldTileSizeM) {
    const halfX = (sizeM[0] / worldTileSizeM) / 2;
    const halfY = (sizeM[1] / worldTileSizeM) / 2;
    const cx = centerWorld[0];
    const cy = centerWorld[1];
    return [
      iso(cx - halfX, cy - halfY),
      iso(cx + halfX, cy - halfY),
      iso(cx + halfX, cy + halfY),
      iso(cx - halfX, cy + halfY),
    ];
  }

  function drawPoly(points, origin, fill, stroke, lineWidth = 1) {
    if (!points.length) return;
    ctx.beginPath();
    ctx.moveTo(origin.x + points[0].x * zoom, origin.y + points[0].y * zoom);
    for (let i = 1; i < points.length; i++) {
      ctx.lineTo(origin.x + points[i].x * zoom, origin.y + points[i].y * zoom);
    }
    ctx.closePath();
    if (fill) { ctx.fillStyle = fill; ctx.fill(); }
    if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = lineWidth; ctx.stroke(); }
  }

  function drawLabel(text, world, origin, color = '#eee') {
    const p = iso(world[0], world[1]);
    ctx.fillStyle = color;
    ctx.font = '12px ui-monospace,monospace';
    ctx.fillText(text, origin.x + p.x * zoom + 6, origin.y + p.y * zoom - 6);
  }

  function drawWorldLine(points, origin, color, width = 2) {
    if (points.length < 2) return;
    ctx.beginPath();
    points.forEach((point, index) => {
      const p = iso(point[0], point[1]);
      const x = origin.x + p.x * zoom;
      const y = origin.y + p.y * zoom;
      if (index === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    });
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.stroke();
  }

  function drawGrid(origin, radius = 13) {
    ctx.strokeStyle = 'rgba(255,255,255,.08)';
    ctx.lineWidth = 1;
    for (let x = -radius; x <= radius; x++) {
      for (let y = -radius; y <= radius; y++) {
        const c = iso(x, y);
        const top = {x:c.x, y:c.y - tileHeight/2};
        const right = {x:c.x + tileWidth/2, y:c.y};
        const bottom = {x:c.x, y:c.y + tileHeight/2};
        const left = {x:c.x - tileWidth/2, y:c.y};
        drawPoly([top,right,bottom,left], origin, null, 'rgba(255,255,255,.07)');
      }
    }
  }

  async function render() {
    resize();
    ctx.fillStyle = '#0e1011';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const layout = await fetch('./street-layout-v1.json').then(r => {
      if (!r.ok) throw new Error(`street layout ${r.status}`);
      return r.json();
    });
    const scene = await fetch('./one-perfect-block.json').then(r => {
      if (!r.ok) throw new Error(`scene ${r.status}`);
      return r.json();
    });

    const origin = {x: canvas.width * .5, y: canvas.height * .46};
    drawGrid(origin);

    const roadDiamond = diamondForRect([0,0], layout.road.intersectionBoxM, layout.worldTileSizeM);
    drawPoly(roadDiamond, origin, 'rgba(62,65,64,.78)', 'rgba(215,195,118,.55)', 2);

    for (const lot of layout.lots) {
      const points = diamondForRect(lot.centerWorld, lot.sizeM, layout.worldTileSizeM);
      const fill = lot.assetId ? 'rgba(104,122,104,.18)' : 'rgba(93,101,111,.12)';
      drawPoly(points, origin, fill, 'rgba(170,190,170,.35)', 1);
      drawLabel(lot.id, lot.centerWorld, origin, '#aab8aa');
    }

    for (const bay of layout.parkingBays) {
      const points = diamondForRect(bay.world, bay.sizeM, layout.worldTileSizeM);
      drawPoly(points, origin, 'rgba(146,123,75,.18)', 'rgba(220,190,120,.55)', 1);
      drawLabel(bay.id, bay.world, origin, '#d5c18f');
    }

    for (const route of layout.pedestrianRoutes) {
      drawWorldLine(route.points, origin, 'rgba(110,190,190,.75)', Math.max(2, route.clearWidthM * .9));
    }

    for (const crossing of layout.crossings) {
      const p = crossing.world;
      drawLabel(crossing.id, p, origin, '#cfcfcf');
      const c = iso(p[0], p[1]);
      ctx.fillStyle = 'rgba(230,230,220,.55)';
      ctx.beginPath();
      ctx.arc(origin.x + c.x * zoom, origin.y + c.y * zoom, 4, 0, Math.PI * 2);
      ctx.fill();
    }

    for (const zone of layout.streetFurnitureZones) {
      const p = iso(zone.world[0], zone.world[1]);
      ctx.strokeStyle = 'rgba(210,120,90,.8)';
      ctx.lineWidth = 2;
      ctx.strokeRect(origin.x + p.x*zoom - 5, origin.y + p.y*zoom - 5, 10, 10);
      drawLabel(zone.id, zone.world, origin, '#d99b83');
    }

    for (const placement of layout.goldenFourPlacements) {
      const p = iso(placement.world[0], placement.world[1]);
      ctx.fillStyle = 'rgba(240,220,160,.95)';
      ctx.beginPath();
      ctx.arc(origin.x + p.x*zoom, origin.y + p.y*zoom, 5, 0, Math.PI*2);
      ctx.fill();
      drawLabel(placement.assetId, placement.world, origin, '#f0dda5');
    }

    const spawn = [scene.spawn.x, scene.spawn.y];
    const sp = iso(spawn[0], spawn[1]);
    ctx.strokeStyle = '#9de0a6';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(origin.x + sp.x*zoom, origin.y + sp.y*zoom, 8, 0, Math.PI*2);
    ctx.stroke();
    drawLabel('ALIZA SPAWN', spawn, origin, '#9de0a6');

    hud.innerHTML = `<strong>PHASE A CIVIL GEOMETRY</strong><br>` +
      `${layout.road.carriagewayWidthM}m carriageway • ${layout.sidewalk.widthM}m sidewalks • ` +
      `${layout.lots.length} lots • ${layout.parkingBays.length} parking bay • ${layout.pedestrianRoutes.length} walk routes<br>` +
      `scene=${scene.status} • art cannot change this geometry without a test update`;
  }

  window.addEventListener('resize', () => render().catch(err => hud.textContent = `REFUSE: ${err.message}`));
  render().catch(err => {
    console.error(err);
    hud.textContent = `REFUSE: ${err.message}`;
  });
})();
