/** SURROUND ME · FRINGE ART KIT V1
 * Opt-in decorative layer. Does not change collision, AI, Greyline or Samsarra.
 * Maintains exact foot-anchor placement and Y-sorting by drawing IN the existing
 * renderable's slot (rather than post-processing over the player).
 */
export function createFringeArtKit({ enabled = false } = {}) {
  const cache = new Map();
  const names = ['house_a','house_b','corner_shop'];
  const states = ['ordinary','restraint','compulsion','samsarra'];
  const props = ['streetlamp','mailbox','dead_tree','fence','dumpster','utility_pole'];
  const decalNames = ['crack','puddle','weeds','grime','rubble','organic'];
  let succeeded = 0, failed = 0;
  // V1.1 POLISH: isolate the experimental sprite families without touching
  // the canonical game renderer or its governed architectural assets.
  const modes = Object.freeze({
    original: [false, false, false],
    detail: [false, false, true],
    props: [false, true, true],
    buildings: [true, false, false],
    full: [true, true, true],
  });
  const params = new URLSearchParams(typeof location === 'undefined' ? '' : location.search);
  let mode = params.get('fringemode') || 'detail';
  if (!(mode in modes)) mode = 'detail';
  let decalOpacity = 0.32;
  function groups() {
    const [buildings, props, decals] = modes[mode];
    return { buildings, props, decals };
  }
  function setMode(next) {
    if (!(next in modes)) return false;
    mode = next;
    return true;
  }
  function setDecalOpacity(value) {
    const number = Number(value);
    if (!Number.isFinite(number)) return false;
    decalOpacity = Math.max(0, Math.min(0.6, number));
    return true;
  }
  function request(path) {
    if (!enabled) return null;
    if (cache.has(path)) return cache.get(path);
    const image = new Image();
    const record = { image, state: 'loading' };
    image.onload = () => {record.state = 'ready'; succeeded++;};
    image.onerror = () => {record.state = 'error'; failed++; console.warn('[FRINGE ART] missing', path);};
    image.src = new URL('art/' + path, import.meta.url).href;
    cache.set(path, record);
    return record;
  }
  function ready(path) {
    const record = request(path);
    return record?.state === 'ready' ? record.image : null;
  }
  function drawAnchored(ctx, image, sx, sy, w, h, anchorX, anchorY) {
    if (!image) return false;
    ctx.drawImage(image, sx - w*anchorX/image.width, sy - h*anchorY/image.height, w, h);
    return true;
  }
  function visualState(event = {}) {
    if (!event || !(event.intensity > 0)) return { name: 'ordinary', mix: 0 };
    return {
      name: event.polarity === 'restraint' ? 'restraint' : event.intensity > 0.87 ? 'samsarra' : 'compulsion',
      mix: Math.max(0, Math.min(1, Number(event.intensity) || 0))
    };
  }
  function drawBuilding(ctx,sx,sy,structure,event) {
    if (!enabled || !groups().buildings || structure?.type === 'governedHouseA') return false;
    // Limited to generic houses with no governed sprite geometry. Storehouse,
    // chapel and other hand-authored structures remain untouched.
    const id = String(structure?.asset || '');
    if (!/^house[123]$/.test(id)) return false;
    const kind = id === 'house3' ? 'corner_shop' : id === 'house2' ? 'house_b' : 'house_a';
    const src = ready(`buildings/variants/${kind}__ordinary.png`);
    if (!src) return false;
    const {name,mix} = visualState(event);
    const w = 205, h = 205;
    ctx.save();
    drawAnchored(ctx,src,sx,sy,w,h,256,460);
    if (mix && name !== 'ordinary') {
      const alt=ready(`buildings/variants/${kind}__${name}.png`);
      if(alt) {ctx.globalAlpha*=mix;drawAnchored(ctx,alt,sx,sy,w,h,256,460);}
    }
    ctx.restore();
    return true;
  }
  function drawProp(ctx,kind,sx,sy,object={}) {
    if(!enabled || !groups().props) return false;
    const map = { fringe_mailbox: 'mailbox', fence: 'fence', bare_tree:'dead_tree',
      deadTree1:'dead_tree', deadTree2:'dead_tree', brokenFence:'fence', lanternPost:'streetlamp', oldSignpost:'mailbox' };
    const target=map[kind];
    if(!target) return false;
    const im=ready(`props/${target}.png`);
    if(!im) return false;
    const heights={mailbox:41,fence:46,dead_tree:118,streetlamp:110};
    let h=heights[target];
    if(target==='dead_tree') h*=Math.max(.7,Math.min(1.45,Number(object.height || object.scale || 1)));
    ctx.save();
    if(object.flip){ctx.translate(sx,0);ctx.scale(-1,1);sx=0;}
    drawAnchored(ctx,im,sx,sy,h,h,128,238);
    ctx.restore();
    return true;
  }
  function drawGroundDecals(ctx,world,cam,player,project,event) {
    if(!enabled || !groups().decals || !world?.tiles || !player) return;
    const px=Math.floor(player.x),py=Math.floor(player.y);
    const vw=ctx.canvas.width, vh=ctx.canvas.height;
    let rendered=0;
    // Deterministic sparse placement, bounded (no per-frame random particles).
    for(let x=Math.max(0,px-22);x<=Math.min(world.tiles.length-1,px+22);x++) {
      for(let y=Math.max(0,py-22);y<=py+22;y++) {
        if(rendered>=35) return;
        const tile=world.tiles[x]?.[y];
        if(!tile || !['road','asphalt','concrete','dirt','deadgrass'].includes(tile.type))continue;
        if(((x*73+y*29+17)%31)!==0)continue;
        const pos=project(x,y), sx=pos.x+cam.x,sy=pos.y+cam.y;
        if(sx < -95 || sx > vw + 95 || sy < -75 || sy > vh + 75)continue;
        const n=(Math.abs(x*19+y*37)%3)+1;
        const which=tile.type==='road'||tile.type==='asphalt' ? (x+y)%2===0?'crack':'grime'
          :tile.type==='concrete'?'crack':'weeds';
        const img=ready(`decals/${which}_${String(n).padStart(2,'0')}.png`);
        if(!img)continue;
        ctx.save();
        const parentAlpha = ctx.globalAlpha;
        ctx.globalAlpha = parentAlpha * decalOpacity;
        ctx.drawImage(img,sx-31,sy-13,62,35);
        if(event?.intensity>.38 && ((x+y)%4===0)){
          const rot=ready(`decals/organic_${String(n).padStart(2,'0')}.png`);
          if(rot){ctx.globalAlpha=parentAlpha*Math.min(0.23,Number(event.intensity)*0.22);ctx.drawImage(rot,sx-31,sy-13,62,35);}
        }
        ctx.restore();rendered++;
      }
    }
  }
  if(enabled) {
    for (const kind of names) for(const side of states)
      request(`buildings/variants/${kind}__${side}.png`);
    for (const kind of props) request(`props/${kind}.png`);
    for (const kind of decalNames) for(let n=1;n<=3;n++)
      request(`decals/${kind}_${String(n).padStart(2,'0')}.png`);
  }
  const status = () => ({
    enabled, loaded:succeeded, failed, total:cache.size,
    ready:succeeded===cache.size && failed===0,
    mode, groups: groups(), decalOpacity,
  });
  // The existing game already publishes __fringeArtKitStatus().
  // These additional controls are independent of the world simulation.
  if (enabled && typeof window !== 'undefined') {
    window.__fringeArtKitControls = Object.freeze({
      setMode, setDecalOpacity, status,
      modes: Object.keys(modes),
    });
  }
  return { enabled, drawBuilding,drawProp,drawGroundDecals, setMode, setDecalOpacity, status };
}
