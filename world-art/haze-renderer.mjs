// Ground haze is sampled in projected world coordinates, then composited once.
const GRID_X = 180;
const GRID_Y = 104;
const REFRESH_RATE = 20;
const AMBIENT_BUDGET = 8;
const DRIFT_BUDGET = 4;
const POOL_BUDGET = 4;

export const HAZE_MAX_PATCHES = AMBIENT_BUDGET + DRIFT_BUDGET + POOL_BUDGET;
export const HAZE_MAX_OPACITY = 0.24;
const clamp01 = value => Math.max(0, Math.min(1, value));

export function hazeProfile(g, tier, inHub, density = 1) {
    const restraint = clamp01(-g);
    const compulsion = clamp01(g);
    const pressure = restraint + compulsion;
    const depth = clamp01(tier / 3);
    const presence = inHub ? 0.62 : 1;
    return {
        ambient: presence * (0.130 + 0.027 * pressure + 0.015 * depth),
        drift: 1 - 0.70 * restraint + 0.23 * compulsion,
        local: presence * Math.max(0.75, Math.min(1.55, density)) * (1 + 0.14 * pressure + 0.10 * depth),
        tint: [
            143 - 11 * restraint + 16 * compulsion,
            151 - 10 * restraint - 13 * compulsion,
            151 + 4 * restraint + 21 * compulsion,
        ],
    };
}

function visible(patch, view) {
    return patch.x + patch.rx > view.x && patch.x - patch.rx < view.x + view.width
        && patch.y + patch.ry > view.y && patch.y - patch.ry < view.y + view.height;
}

function closest(patches, view, budget) {
    const cx = view.x + view.width / 2;
    const cy = view.y + view.height / 2;
    const distance = patch => ((patch.x - cx) / view.width) ** 2 + ((patch.y - cy) / view.height) ** 2;
    return patches.filter(patch => visible(patch, view))
        .sort((a, b) => distance(a) - distance(b))
        .slice(0, budget);
}

export function collectHazePatches({ view, pools, drifts, project, time, profile }) {
    const ambient = [];
    // A stable lattice prevents empty camera views between the authored pools.
    for (let i = Math.floor(view.x / GRID_X); i <= Math.ceil((view.x + view.width) / GRID_X); i++) {
        for (let j = Math.floor(view.y / GRID_Y); j <= Math.ceil((view.y + view.height) / GRID_Y); j++) {
            const phase = i * 2.83 + j * 1.61;
            ambient.push({
                x: i * GRID_X + Math.sin(phase + time * 0.13) * 28 * profile.drift,
                y: j * GRID_Y + Math.cos(phase + time * 0.10) * 18 * profile.drift,
                rx: 146 + Math.sin(phase) * 21,
                ry: 59 + Math.cos(phase) * 11,
                opacity: profile.ambient,
            });
        }
    }

    const origin = project(0, 0);
    const unitX = project(1, 0);
    const unitY = project(0, 1);
    const tileX = Math.hypot(unitX.x - origin.x, unitY.x - origin.x);
    const tileY = Math.hypot(unitX.y - origin.y, unitY.y - origin.y);

    const moving = drifts.map(fog => {
        const phase = time * fog.speed + fog.phase;
        const span = fog.size * profile.drift * 0.42;
        const point = project(fog.baseX + Math.sin(phase) * span, fog.baseY + Math.cos(phase * 0.7) * span);
        return {
            ...point,
            rx: fog.size * tileX * 0.53,
            ry: fog.size * tileY * 0.47,
            opacity: (0.070 + fog.opacity * 0.48) * profile.local,
        };
    });

    const local = pools.map(pool => ({
        ...project(pool.x, pool.y),
        rx: pool.radius * tileX,
        ry: pool.radius * tileY,
        opacity: (0.115 + pool.density * 0.48 + 0.012 * Math.sin(time * 0.46 + pool.pulse)) * profile.local,
    }));

    return [
        ...closest(ambient, view, AMBIENT_BUDGET),
        ...closest(moving, view, DRIFT_BUDGET),
        ...closest(local, view, POOL_BUDGET),
    ];
}

export function rasterizeHaze(image, view, patches, tint) {
    const { width, height, data } = image;
    const sx = width / view.width;
    const sy = height / view.height;
    data.fill(0);
    for (const patch of patches) {
        const cx = (patch.x - view.x) * sx;
        const cy = (patch.y - view.y) * sy;
        const rx = patch.rx * sx;
        const ry = patch.ry * sy;
        const left = Math.max(0, Math.floor(cx - rx));
        const right = Math.min(width, Math.ceil(cx + rx));
        const top = Math.max(0, Math.floor(cy - ry));
        const bottom = Math.min(height, Math.ceil(cy + ry));
        const peak = Math.min(HAZE_MAX_OPACITY, patch.opacity) * 255;

        for (let y = top; y < bottom; y++) {
            const v = (y + 0.5 - cy) / ry;
            const remaining = 1 - v * v;
            for (let x = left; x < right; x++) {
                const u = (x + 0.5 - cx) / rx;
                const falloff = remaining - u * u;
                if (falloff <= 0) continue;
                const opacity = Math.round(peak * falloff * (0.16 + 0.84 * falloff));
                const i = (y * width + x) * 4;
                // Use the strongest density at this pixel. Overlapping banks cannot add opacity.
                if (opacity <= data[i + 3]) continue;
                data[i] = tint[0];
                data[i + 1] = tint[1];
                data[i + 2] = tint[2];
                data[i + 3] = opacity;
            }
        }
    }
}

export function createHazeRenderer(makeCanvas) {
    let surface, context, pixels, cache;
    return (ctx, { view, pools, drifts, project, time, g, tier, inHub, density }) => {
        const tick = Math.floor(time * REFRESH_RATE);
        const right = view.x + view.width;
        const bottom = view.y + view.height;
        const rebuild = !cache || tick !== cache.tick || tier !== cache.tier || inHub !== cache.inHub
            || view.width !== cache.width || view.height !== cache.height
            || view.x < cache.field.x || right > cache.field.x + cache.field.width
            || view.y < cache.field.y || bottom > cache.field.y + cache.field.height;

        if (rebuild) {
            const padX = Math.min(56, view.width * 0.15);
            const padY = Math.min(44, view.height * 0.15);
            const field = { x: view.x - padX, y: view.y - padY, width: view.width + padX * 2, height: view.height + padY * 2 };
            const width = Math.min(224, Math.ceil(field.width / 3.5));
            const height = Math.min(144, Math.ceil(field.height / 3.5));
            if (!surface) {
                surface = makeCanvas();
                context = surface.getContext('2d');
            }
            if (!pixels || pixels.width !== width || pixels.height !== height) {
                surface.width = width;
                surface.height = height;
                pixels = context.createImageData(width, height);
            }
            const profile = hazeProfile(g, tier, inHub, density);
            const patches = collectHazePatches({ view: field, pools, drifts, project, time, profile });
            rasterizeHaze(pixels, field, patches, profile.tint);
            context.putImageData(pixels, 0, 0);
            cache = { tick, tier, inHub, field, width: view.width, height: view.height };
        }

        const field = cache.field;
        ctx.drawImage(surface, field.x - view.x, field.y - view.y, field.width, field.height);
    };
}
