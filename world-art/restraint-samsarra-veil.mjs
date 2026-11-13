// Restraint's full Samsarra is not a pale reward state. It is perceptual
// withdrawal: grey, dim, deafened in colour, with a narrow but navigable window.
// Source-only visual overlay; no new textures, shaders, frame buffers, or loops.
// Keep the game's HUD and hit telegraphs readable by drawing before the HUD.
export const RESTRAINT_SAMSARRA_VEIL = Object.freeze({
    startIntensity: 0.20,       // fade in with entry, fade out with release
    fullIntensity: 1.0,
    saturationRemoval: 0.87,   // 0=colour preserved; 1=near-monochrome
    charcoalOpacity: 0.34,    // dull, cold foreground wash
    centreDim: 0.18,          // the remaining field of vision isn't bright
    edgeDim: 0.93,            // near-blind at the far periphery
    innerRadius: 0.12,        // portion of shorter screen dimension
    outerRadius: 0.57,
});

const clamp01 = n => Math.max(0, Math.min(1, Number.isFinite(n) ? n : 0));
const smoothstep = n => n * n * (3 - 2 * n);

export function restraintSamsarraVisualProfile(event) {
    // The other polarity must never inherit the blindfold, even at intensity=1.
    if (!event || event.polarity !== 'restraint' ||
        !['samsarra', 'release'].includes(event.phase)) {
        return { strength: 0, saturationRemoval: 0, charcoalOpacity: 0,
            centreDim: 0, edgeDim: 0 };
    }
    const p = RESTRAINT_SAMSARRA_VEIL;
    const t = clamp01((clamp01(event.intensity) - p.startIntensity) /
        (p.fullIntensity - p.startIntensity));
    const strength = smoothstep(t);
    return {
        strength,
        saturationRemoval: p.saturationRemoval * strength,
        charcoalOpacity: p.charcoalOpacity * strength,
        centreDim: p.centreDim * strength,
        edgeDim: p.edgeDim * strength,
    };
}

export function drawRestraintSamsarraVeil(ctx, event, width, height) {
    const p = restraintSamsarraVisualProfile(event);
    if (p.strength <= 0 || width <= 0 || height <= 0) return false;

    ctx.save();
    // Defensive: always use screen coordinates; never inherit camera zoom.
    ctx.setTransform(1, 0, 0, 1, 0, 0);

    // Desaturate the *world*, not the HUD. Canvas composite mode `saturation`
    // uses the zero saturation of the grey source while preserving luminance.
    // The charcoal veil still reads as dull/grey if this blend mode is unsupported.
    ctx.globalCompositeOperation = 'saturation';
    ctx.globalAlpha = p.saturationRemoval;
    ctx.fillStyle = '#808080';
    ctx.fillRect(0, 0, width, height);

    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;
    ctx.fillStyle = `rgba(30,32,36,${p.charcoalOpacity})`;
    ctx.fillRect(0, 0, width, height);

    // At the extreme, most of the street vanishes into a near-black periphery.
    // Keep a dim central circle for locomotion / fairness; avoid an opaque mask.
    const radius = Math.min(width, height);
    const inner = radius * RESTRAINT_SAMSARRA_VEIL.innerRadius;
    const outer = radius * RESTRAINT_SAMSARRA_VEIL.outerRadius;
    const mask = ctx.createRadialGradient(
        width * 0.5, height * 0.5, inner,
        width * 0.5, height * 0.5, outer);
    mask.addColorStop(0, `rgba(5,7,10,${p.centreDim})`);
    mask.addColorStop(0.24, `rgba(6,8,11,${p.centreDim + (p.edgeDim-p.centreDim)*0.22})`);
    mask.addColorStop(0.68, `rgba(4,5,8,${p.centreDim + (p.edgeDim-p.centreDim)*0.79})`);
    mask.addColorStop(1, `rgba(3,4,6,${p.edgeDim})`);
    ctx.fillStyle = mask;
    ctx.fillRect(0, 0, width, height);
    ctx.restore();
    return true;
}
