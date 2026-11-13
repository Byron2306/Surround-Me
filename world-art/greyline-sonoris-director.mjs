/**
 * Surround Me / Sonoris Greyline Director v4
 * Four independently controllable, original stems: a constant B-minor motif,
 * neutral air, restraint air, and compulsion machinery. The motif is NEVER
 * replaced by a state-exclusive song; Greyline transforms its presentation.
 *
 * No server/network beyond same-origin static assets. Native Web Audio only.
 * No automatic retries, recursive sources, or use of external CDN.
 */
const clamp = (v, low=0, high=1) => Math.min(high, Math.max(low, Number.isFinite(Number(v)) ? Number(v) : 0));
const FILES = Object.freeze({
  motif: 'neutral_melody.ogg',
  neutralAir: 'neutral_atmosphere.ogg',
  restraintAir: 'restraint_atmosphere.ogg',
  compulsionAir: 'compulsion_atmosphere.ogg',
});

export function greylinePulseBpm(g, samTier=0) {
  const v = clamp(g, -1, 1), tier=clamp(samTier,0,3);
  // No hard 24/96/160 jumps when crossing state thresholds.
  const bpm = v < 0
    ? 96 - 72 * Math.pow(-v, 1.15)
    : 96 + 224 * Math.pow(v, 1.30);
  return clamp(bpm + (v > 0 ? tier*7 : 0), 24, 340);
}

export function greylineStemTargets({g=0, samTier=0, inHub=false, volume=0.95, danger=0}={}) {
  const v = clamp(g,-1,1), left=Math.max(0,-v), right=Math.max(0,v);
  const tier=clamp(samTier,0,3), level=clamp(volume,0,1.2);
  // Hub and Verge both have Sonoris coverage. The hub keeps a quieter, still
  // recognizable motif; Verge adds the full soundscape. Never go back to GM-like
  // arpeggios merely because the player is in the Holdfast.
  const region = level;
  const room = inHub ? 0.65 : 1;
  return {
    motif: region * room * (0.56 - 0.19*left + 0.05*right),
    neutralAir: region * room * (0.36 - 0.17*Math.abs(v)),
    restraintAir: region * (inHub ? 0.10 : 0.43) * Math.pow(left,1.3),
    compulsionAir: region * (inHub ? 0.13 : 1.0) * clamp(0.38*right + 0.12*right*tier/3 + 0.07*clamp(danger)*right,0,0.55),
    cutoffHz: clamp(7200 * (1 - left*0.87 - right*0.17),650,9000),
    playbackRate: clamp(1 - left*0.15 + right*0.13,0.84,1.15),
    compulsionCutoffHz: clamp(1400 + right*2400+tier*500,700,5200),
  };
}

export function createGreylineSonorisDirector(ctx, musicBus, {assetRoot}={}) {
  const root = assetRoot ?? new URL('../audio/greyline/', import.meta.url);
  const buses = {};
  const filters = {};
  const sources = {};
  const state = { ready:false, failed:false, loading:false, error:null };
  const destination = ctx.createGain();
  destination.gain.value = 1;
  const limiter=ctx.createDynamicsCompressor();
  limiter.threshold.value=-10;
  limiter.knee.value=12;
  limiter.ratio.value=5;
  limiter.attack.value=0.008;
  limiter.release.value=0.25;
  destination.connect(limiter);
  limiter.connect(musicBus);

  for (const key of Object.keys(FILES)) {
    const gain=ctx.createGain();gain.gain.value=0;
    const filter=ctx.createBiquadFilter();filter.type='lowpass';
    filter.frequency.value=key==='motif'?7200:key==='compulsionAir'?1400:6000;
    filter.Q.value=0.55;
    filter.connect(gain);gain.connect(destination);
    buses[key]=gain;filters[key]=filter;
  }
  async function load() {
    if (state.ready || state.loading || state.failed) return state.ready;
    state.loading=true;
    const loaded=[];
    try {
      // All-or-nothing load: never suppress the procedural fallback on partial assets.
      for (const [key, filename] of Object.entries(FILES)) {
        const url=new URL(filename,root).href;
        const response=await fetch(url, {cache:'no-store'});
        if (!response.ok) throw new Error(`SONORIS asset ${filename}: HTTP ${response.status}`);
        const audio=await ctx.decodeAudioData(await response.arrayBuffer());
        if (!audio || !(audio.duration>0)) throw new Error(`SONORIS empty audio: ${filename}`);
        loaded.push([key,audio]);
      }
      const when=ctx.currentTime + 0.12;
      for (const [key,audio] of loaded) {
        const source=ctx.createBufferSource();
        source.buffer=audio;source.loop=true;
        source.connect(filters[key]);
        source.start(when);
        sources[key]=source;
      }
      state.ready=true;
      state.error=null;
      return true;
    } catch(error) {
      state.failed=true;
      state.error=String(error?.message||error);
      console.warn('[SONORIS Greyline] fallback to procedural score:',state.error);
      return false;
    } finally {
      state.loading=false;
    }
  }
  function update(inputs) {
    if (!state.ready) return;
    const targets=greylineStemTargets(inputs);
    const now=ctx.currentTime;
    for (const key of Object.keys(FILES)) {
      // AudioParam smoothing is frame-rate independent and avoids gain discontinuities.
      buses[key].gain.setTargetAtTime(targets[key],now,0.24);
    }
    filters.motif.frequency.setTargetAtTime(targets.cutoffHz,now,0.55);
    filters.compulsionAir.frequency.setTargetAtTime(targets.compulsionCutoffHz,now,0.22);
    sources.motif.playbackRate.setTargetAtTime(targets.playbackRate,now,0.9);
  }
  function stop() {
    for (const source of Object.values(sources)) {
      try {source.stop(); source.disconnect();} catch (_) {}
    }
    destination.disconnect();
    state.ready=false;
  }
  return {get ready(){return state.ready},get error(){return state.error},get failed(){return state.failed},load,update,stop};
}
