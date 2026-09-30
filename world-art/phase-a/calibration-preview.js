(function () {
  const canvas = document.getElementById('preview-canvas');
  const ctx = canvas.getContext('2d');
  const status = document.getElementById('status');
  const zoom = 2.0625;
  const tileWidth = 64;
  const tileHeight = 32;

  function resize() {
    canvas.width = Math.max(960, window.innerWidth);
    canvas.height = Math.max(640, window.innerHeight);
  }

  function loadImage(url) {
    return new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error(`failed to load ${url}`));
      image.src = url;
    });
  }

  function drawIsoGrid(originX, originY, radius = 8) {
    ctx.save();
    ctx.scale(zoom, zoom);
    ctx.strokeStyle = 'rgba(180,190,190,.22)';
    ctx.lineWidth = 1 / zoom;
    for (let x = -radius; x <= radius; x++) {
      for (let y = -radius; y <= radius; y++) {
        const p = window.SurroundWorldArtCalibration.worldToIso(x, y, tileWidth, tileHeight);
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

  function drawCandidate(image, record, originX, originY) {
    const p = window.SurroundWorldArtCalibration.worldToIso(-2, -2, tileWidth, tileHeight);
    const fp = record.footprintTiles;
    const width = (fp[0] + fp[1]) * (tileWidth / 2);
    const height = width * (record.runtimePixels[1] / record.runtimePixels[0]);
    ctx.save();
    ctx.scale(zoom, zoom);
    const gx = originX / zoom + p.x;
    const gy = originY / zoom + p.y;
    ctx.drawImage(image, gx - width * record.anchor[0], gy - height * record.anchor[1], width, height);
    ctx.restore();
  }

  function drawAlizaReference(originX, originY) {
    const p = window.SurroundWorldArtCalibration.worldToIso(2, 2, tileWidth, tileHeight);
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

  async function render() {
    resize();
    ctx.fillStyle = '#101112';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    const manifest = await fetch('../hd-iso-v1/manifest.json').then(r => {
      if (!r.ok) throw new Error(`manifest ${r.status}`);
      return r.json();
    });
    const record = manifest.assets.find(a => a.id === 'building.house.suburban.01');
    if (!record) throw new Error('candidate house missing from manifest');
    const image = await loadImage(`../../${record.source}`);
    const ox = canvas.width * 0.5;
    const oy = canvas.height * 0.58;
    drawIsoGrid(ox, oy);
    drawCandidate(image, record, ox, oy);
    drawAlizaReference(ox, oy);
    status.textContent = `${record.id} | ${record.status} | ${record.masterPixels.join('×')} master | ${record.footprintTiles.join('×')} tiles | zoom ${zoom}`;
  }

  window.addEventListener('resize', () => render().catch(err => status.textContent = err.message));
  render().catch(err => {
    console.error(err);
    status.textContent = `REFUSE: ${err.message}`;
  });
})();
