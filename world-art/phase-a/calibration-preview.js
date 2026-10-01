(function () {
  const canvas = document.getElementById('preview-canvas');
  const ctx = canvas.getContext('2d');
  const status = document.getElementById('status');
  const zoom = 2.0625;
  const tileWidth = 64;
  const tileHeight = 32;

  function resize() {
    canvas.width = Math.max(1200, window.innerWidth);
    canvas.height = Math.max(760, window.innerHeight);
  }

  function loadImage(url) {
    return new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error(`failed to load ${url}`));
      image.src = url;
    });
  }

  function iso(x, y) {
    return window.SurroundWorldArtCalibration.worldToIso(x, y, tileWidth, tileHeight);
  }

  function drawIsoGrid(originX, originY, radius = 9) {
    ctx.save();
    ctx.scale(zoom, zoom);
    ctx.strokeStyle = 'rgba(180,190,190,.18)';
    ctx.lineWidth = 1 / zoom;
    for (let x = -radius; x <= radius; x++) {
      for (let y = -radius; y <= radius; y++) {
        const p = iso(x, y);
        const sx = originX / zoom + p.x;
        const sy = originY / zoom + p.y;
        ctx.beginPath();
        ctx.moveTo(sx, sy - tileHeight / 2);
        ctx.lineTo(sx + tileWidth / 2, sy);
        ctx.lineTo(sx, sy + tileHeight / 2);
        ctx.lineTo(sx - tileWidth / 2, sy);
        ctx.closePath();
        ctx.stroke();
      }
    }
    ctx.restore();
  }

  function drawCandidate(image, record, worldX, worldY, originX, originY, alpha = 1) {
    const p = iso(worldX, worldY);
    const fp = record.footprintTiles;
    const width = (fp[0] + fp[1]) * (tileWidth / 2);
    const height = width * (record.runtimePixels[1] / record.runtimePixels[0]);
    ctx.save();
    ctx.scale(zoom, zoom);
    ctx.globalAlpha = alpha;
    const gx = originX / zoom + p.x;
    const gy = originY / zoom + p.y;
    ctx.drawImage(image, gx - width * record.anchor[0], gy - height * record.anchor[1], width, height);
    ctx.restore();
  }

  function drawReferenceStamp(label, worldX, worldY, originX, originY) {
    const p = iso(worldX, worldY);
    ctx.save();
    ctx.scale(zoom, zoom);
    const x = originX / zoom + p.x;
    const y = originY / zoom + p.y;
    ctx.fillStyle = 'rgba(235,170,80,.95)';
    ctx.font = 'bold 9px monospace';
    ctx.fillText(`REFUSED REFERENCE ONLY: ${label}`, x - 110, y + 18);
    ctx.restore();
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
    g.lineTo(cx, top + hh*2);
    g.lineTo(cx - hw, top + hh);
    g.closePath();
    g.stroke();
    return out;
  }

  function drawIntersection(intersection, record, originX, originY) {
    const p = iso(0, 0);
    const width = (record.footprintTiles[0] + record.footprintTiles[1]) * (tileWidth / 2);
    const height = width;
    ctx.save();
    ctx.scale(zoom, zoom);
    const gx = originX / zoom + p.x;
    const gy = originY / zoom + p.y;
    ctx.drawImage(intersection, gx - width / 2, gy - height, width, height);
    ctx.restore();
  }

  function drawAlizaReference(originX, originY) {
    const p = iso(2, 2);
    ctx.save();
    ctx.scale(zoom, zoom);
    const gx = originX / zoom + p.x;
    const gy = originY / zoom + p.y;
    ctx.strokeStyle = 'rgba(235,220,180,.95)';
    ctx.lineWidth = 1.5 / zoom;
    ctx.strokeRect(gx - 14, gy - 80, 28, 80);
    ctx.fillStyle = 'rgba(235,220,180,.9)';
    ctx.font = '10px monospace';
    ctx.fillText('ALIZA 80 logical / 165 screen px', gx + 20, gy - 45);
    ctx.restore();
  }

  function drawMissingSlot(label, worldX, worldY, originX, originY, width = 100, height = 55) {
    const p = iso(worldX, worldY);
    ctx.save();
    ctx.scale(zoom, zoom);
    const x = originX / zoom + p.x;
    const y = originY / zoom + p.y;
    ctx.strokeStyle = 'rgba(220,90,90,.75)';
    ctx.setLineDash([4, 3]);
    ctx.strokeRect(x - width/2, y - height, width, height);
    ctx.setLineDash([]);
    ctx.fillStyle = 'rgba(230,120,120,.95)';
    ctx.font = '9px monospace';
    ctx.fillText(`REFUSE: ${label} MASTER MISSING`, x - width/2 + 2, y - height - 5);
    ctx.restore();
  }

  async function render() {
    resize();
    ctx.fillStyle = '#101112';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const manifest = await fetch('../hd-iso-v1/manifest.json').then(r => {
      if (!r.ok) throw new Error(`manifest ${r.status}`);
      return r.json();
    });
    const byId = id => manifest.assets.find(a => a.id === id);
    const houseRecord = byId('building.house.suburban.01');
    const referenceHouseRecord = byId('reference.house.suburban.lot.01');
    const roadRecord = byId('road.intersection.4way.01');
    const shopRecord = byId('building.shop.corner.01');
    const sedanRecord = byId('vehicle.sedan.01');
    if (!houseRecord || !referenceHouseRecord || !roadRecord || !shopRecord || !sedanRecord) {
      throw new Error('Golden Four/reference manifest records incomplete');
    }

    const [referenceHouse, asphalt] = await Promise.all([
      loadImage(`../../${referenceHouseRecord.source}`),
      loadImage('../../asphalt1.png'),
    ]);
    const intersection = makeIntersectionTexture(asphalt);

    const ox = canvas.width * 0.50;
    const oy = canvas.height * 0.62;
    drawIsoGrid(ox, oy);
    drawIntersection(intersection, roadRecord, ox, oy);

    drawCandidate(referenceHouse, referenceHouseRecord, -5.0, -4.5, ox, oy, 0.58);
    drawReferenceStamp('RECOVERED BAKED LOT', -5.0, -4.5, ox, oy);

    drawMissingSlot('ISOLATED HOUSE', -2.8, -2.0, ox, oy, 108, 65);
    drawMissingSlot('CORNER SHOP', 2.5, -1.4, ox, oy, 100, 65);
    drawMissingSlot('SEDAN', 1.2, 1.2, ox, oy, 101, 30);
    drawAlizaReference(ox, oy);

    status.textContent = `HD-ISO-V1 | house=${houseRecord.status} (old lot=${referenceHouseRecord.status} reference) | intersection=reproducible prototype | shop=${shopRecord.status} | sedan=${sedanRecord.status} | zoom ${zoom}`;
  }

  window.addEventListener('resize', () => render().catch(err => status.textContent = err.message));
  render().catch(err => {
    console.error(err);
    status.textContent = `REFUSE: ${err.message}`;
  });
})();
