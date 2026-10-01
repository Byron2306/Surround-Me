(function () {
  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');
  const hud = document.getElementById('hud');
  const calibration = window.SurroundWorldArtCalibration;
  const renderer = window.SurroundWorldArtRenderer;
  const sceneApi = window.SurroundPhaseAScene;
  const playerApi = window.SurroundPhaseAPlayer;

  const TILE_W = 64;
  const TILE_H = 32;
  const ZOOM = 2.0625;
  const keys = new Set();
  let state = null;

  function resize() {
    canvas.width = Math.max(960, window.innerWidth);
    canvas.height = Math.max(640, window.innerHeight);
  }

  function loadImage(url) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error(`failed to load ${url}`));
      img.src = url;
    });
  }

  function makeDiagnosticRegistry(manifest) {
    const records = new Map(manifest.assets.map(record => [record.id, record]));
    const images = new Map();
    return {
      get(id) { return records.get(id) || null; },
      require(id) {
        const record = records.get(id);
        if (!record) throw new Error(`diagnostic asset not found: ${id}`);
        return record;
      },
      attachImage(id, image) { images.set(id, image); return image; },
      imageFor(id) { return images.get(id) || null; },
    };
  }

  function makeIntersectionTexture(asphalt) {
    const out = document.createElement('canvas');
    out.width = 2048;
    out.height = 2048;
    const g = out.getContext('2d');
    const cx = 1024;
    const top = 1024;
    const hw = 1024;
    const hh = 512;

    g.save();
    g.beginPath();
    g.moveTo(cx, top);
    g.lineTo(cx + hw, top + hh);
    g.lineTo(cx, top + hh * 2);
    g.lineTo(cx - hw, top + hh);
    g.closePath();
    g.clip();
    g.globalAlpha = 0.93;
    g.drawImage(asphalt, 0, top, 2048, 1024);
    g.globalAlpha = 1;

    const toIso = (u, v) => [
      cx + (u - v) * (hw / 2),
      top + hh + (u + v) * (hh / 2),
    ];
    function segment(a, b, alpha) {
      const p0 = toIso(a[0], a[1]);
      const p1 = toIso(b[0], b[1]);
      g.strokeStyle = `rgba(202,183,82,${alpha})`;
      g.lineWidth = 8;
      g.beginPath();
      g.moveTo(p0[0], p0[1]);
      g.lineTo(p1[0], p1[1]);
      g.stroke();
    }
    [
      [[-1,-.085],[-.26,-.085],.58], [[.26,-.085],[1,-.085],.58],
      [[-1,.085],[-.26,.085],.40], [[.26,.085],[1,.085],.40],
      [[-.085,-1],[-.085,-.26],.58], [[-.085,.26],[-.085,1],.58],
      [[.085,-1],[.085,-.26],.40], [[.085,.26],[.085,1],.40],
    ].forEach(row => segment(row[0], row[1], row[2]));

    let seed = 23022026;
    const rand = () => {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      return seed / 4294967296;
    };
    for (let i = 0; i < 48; i++) {
      const u = rand() * 1.72 - .86;
      const v = rand() * 1.72 - .86;
      const len = .07 + rand() * .16;
      const angle = [0, Math.PI/2, Math.PI/4, -Math.PI/4][Math.floor(rand()*4)] + (rand()-.5)*.38;
      g.strokeStyle = 'rgba(12,12,11,.42)';
      g.lineWidth = 2 + Math.floor(rand()*2);
      g.beginPath();
      for (let j = 0; j < 7; j++) {
        const t = j / 6;
        const p = toIso(
          u + Math.cos(angle)*len*t + (rand()-.5)*.018,
          v + Math.sin(angle)*len*t + (rand()-.5)*.018
        );
        if (j === 0) g.moveTo(p[0], p[1]); else g.lineTo(p[0], p[1]);
      }
      g.stroke();
    }
    for (let i = 0; i < 7; i++) {
      const p = toIso(rand()*1.35-.675, rand()*1.35-.675);
      const rx = 32 + rand()*52;
      const ry = 12 + rand()*24;
      g.fillStyle = 'rgba(5,5,5,.34)';
      g.beginPath();
      g.ellipse(p[0], p[1], rx, ry, 0, 0, Math.PI*2);
      g.fill();
    }
    g.restore();
    g.strokeStyle = 'rgba(7,7,7,.32)';
    g.lineWidth = 3;
    g.beginPath();
    g.moveTo(cx, top);
    g.lineTo(cx + hw, top + hh);
    g.lineTo(cx, top + hh * 2);
    g.lineTo(cx - hw, top + hh);
    g.closePath();
    g.stroke();
    return out;
  }

  function iso(x, y) {
    return calibration.worldToIso(x, y, TILE_W, TILE_H);
  }

  function cameraForPlayer() {
    const p = iso(state.player.x, state.player.y);
    return { x: -p.x, y: -p.y, zoom: ZOOM };
  }

  function drawGrid(camera, radius = 14) {
    ctx.strokeStyle = 'rgba(205,215,215,.10)';
    ctx.lineWidth = 1 / ZOOM;
    for (let x = -radius; x <= radius; x++) {
      for (let y = -radius; y <= radius; y++) {
        const p = iso(x, y);
        const sx = p.x + camera.x;
        const sy = p.y + camera.y;
        ctx.beginPath();
        ctx.moveTo(sx, sy - TILE_H/2);
        ctx.lineTo(sx + TILE_W/2, sy);
        ctx.lineTo(sx, sy + TILE_H/2);
        ctx.lineTo(sx - TILE_W/2, sy);
        ctx.closePath();
        ctx.stroke();
      }
    }
  }

  function drawGround(camera) {
    const record = state.registry.require('road.intersection.4way.01');
    const p = iso(0, 0);
    const width = (record.footprintTiles[0] + record.footprintTiles[1]) * (TILE_W / 2);
    const height = width;
    ctx.drawImage(
      state.intersection,
      p.x + camera.x - width * record.anchor[0],
      p.y + camera.y - height * record.anchor[1],
      width,
      height
    );
  }

  function drawDiagnosticObject(object, camera) {
    const record = state.registry.require(object.assetId);
    const image = state.registry.imageFor(object.assetId);
    if (image) {
      renderer.drawWorldArtObject(ctx, object, camera, state.registry);
      return;
    }

    const p = iso(object.worldX, object.worldY);
    const fp = record.footprintTiles;
    const width = (fp[0] + fp[1]) * (TILE_W / 2);
    const height = object.assetId.startsWith('building.') ? 70 : 28;
    const x = p.x + camera.x;
    const y = p.y + camera.y;
    ctx.save();
    ctx.strokeStyle = 'rgba(225,85,85,.9)';
    ctx.fillStyle = 'rgba(130,35,35,.12)';
    ctx.setLineDash([4,3]);
    ctx.strokeRect(x - width/2, y - height, width, height);
    ctx.fillRect(x - width/2, y - height, width, height);
    ctx.setLineDash([]);
    ctx.fillStyle = 'rgba(245,135,135,.95)';
    ctx.font = '8px ui-monospace,monospace';
    ctx.fillText(`REFUSE ${object.assetId}`, x - width/2, y - height - 5);
    ctx.restore();
  }

  function drawPlayer() {
    const image = state.aliza;
    const height = playerApi.PLAYER_LOGICAL_HEIGHT;
    const width = height * (image.width / image.height);
    ctx.drawImage(image, -width/2, -height, width, height);
    ctx.strokeStyle = 'rgba(235,220,170,.55)';
    ctx.lineWidth = 1 / ZOOM;
    ctx.beginPath();
    ctx.ellipse(0, 0, .25*TILE_W/2, .25*TILE_H/2, 0, 0, Math.PI*2);
    ctx.stroke();
  }

  function playerDepth() {
    return (state.player.x + state.player.y) * (TILE_H / 2);
  }

  function drawFrame() {
    ctx.setTransform(1,0,0,1,0,0);
    ctx.fillStyle = '#0a0c0d';
    ctx.fillRect(0,0,canvas.width,canvas.height);

    const camera = cameraForPlayer();
    ctx.save();
    ctx.translate(canvas.width/2, canvas.height*.58);
    ctx.scale(ZOOM, ZOOM);
    drawGrid(camera);
    drawGround(camera);

    const drawables = state.scene.objects.map(object => ({ type:'object', depth: renderer.projectedDepth(object), object }));
    drawables.push({ type:'player', depth: playerDepth() });
    drawables.sort((a,b) => a.depth - b.depth || (a.type === 'player' ? 1 : -1));

    for (const item of drawables) {
      if (item.type === 'player') drawPlayer();
      else drawDiagnosticObject(item.object, camera);
    }
    ctx.restore();

    hud.innerHTML = `<strong>PHASE A PLAYABLE MURDER CHAMBER</strong><br>` +
      `Aliza x=${state.player.x.toFixed(2)} y=${state.player.y.toFixed(2)} • zoom=${ZOOM} • 64×32 iso<br>` +
      `house=candidate • road=reproducible prototype • shop=REFUSE missing master • sedan=REFUSE missing master<br>` +
      `${state.scene.collisionRects.length} blocking footprints active • production registry remains approval-gated`;
  }

  function inputState() {
    return {
      north: keys.has('w') || keys.has('arrowup'),
      south: keys.has('s') || keys.has('arrowdown'),
      west: keys.has('a') || keys.has('arrowleft'),
      east: keys.has('d') || keys.has('arrowright'),
    };
  }

  function resetPlayer() {
    state.player = { x: state.scene.spawn.x, y: state.scene.spawn.y };
  }

  async function boot() {
    resize();
    const [manifest, sceneData, asphalt, house, aliza] = await Promise.all([
      fetch('../hd-iso-v1/manifest.json').then(r => r.json()),
      fetch('./one-perfect-block.json').then(r => r.json()),
      loadImage('../../asphalt1.png'),
      loadImage('../hd-iso-v1/masters/building_house_suburban_01.png'),
      loadImage('../../Aliza1.png'),
    ]);

    const registry = makeDiagnosticRegistry(manifest);
    registry.attachImage('building.house.suburban.01', house);
    const loadedScene = sceneApi.loadPhaseABlock(sceneData, registry);
    state = {
      manifest,
      registry,
      sceneData,
      scene: loadedScene,
      bounds: sceneData.bounds,
      intersection: makeIntersectionTexture(asphalt),
      aliza,
      player: { x: loadedScene.spawn.x, y: loadedScene.spawn.y },
      lastTime: performance.now(),
    };

    requestAnimationFrame(loop);
  }

  function loop(now) {
    if (!state) return;
    const dt = Math.min(.05, Math.max(0, (now - state.lastTime) / 1000));
    state.lastTime = now;
    state.player = playerApi.stepPlayer(
      state.player,
      inputState(),
      dt,
      state.scene.collisionRects,
      {
        speedTilesPerSecond: 4,
        radiusTiles: .25,
        bounds: state.bounds,
      }
    );
    drawFrame();
    requestAnimationFrame(loop);
  }

  window.addEventListener('keydown', event => {
    const key = event.key.toLowerCase();
    if (['w','a','s','d','arrowup','arrowdown','arrowleft','arrowright'].includes(key)) event.preventDefault();
    if (key === 'r' && state) resetPlayer();
    keys.add(key);
  });
  window.addEventListener('keyup', event => keys.delete(event.key.toLowerCase()));
  window.addEventListener('blur', () => keys.clear());
  window.addEventListener('resize', resize);

  boot().catch(error => {
    console.error(error);
    hud.textContent = `REFUSE: ${error.message}`;
  });
})();
