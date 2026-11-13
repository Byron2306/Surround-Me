import { atlasFrames, muzzlePivots } from './aliza-frames.mjs?v=continuous-run-1';

export const ALIZA_GUN_DURATION = 0.18;
const cycle = value => value - Math.floor(value);
const clamp = value => Math.min(1, Math.max(0, value));


// The Verge projects (x-y, x+y) at a 2:1 tile aspect.
export function alizaDirection(dx, dy, fallback = 4) {
    if (Math.hypot(dx, dy) < 1e-8) return fallback;
    const octant = Math.round(Math.atan2(dx + dy, 2 * (dx - dy)) / (Math.PI / 4));
    return (octant + 10) % 8;
}

export function alizaWorldDirection(direction) {
    const angle = (direction - 2) * Math.PI / 4;
    const x = Math.cos(angle) / 2;
    const y = Math.sin(angle);
    return [x + y, y - x];
}

export function createAlizaMotion() {
    return { action: 'stand', direction: 4, phase: 0, stance: 0 };
}

export function advanceAlizaMotion(motion, dx, dy, dt, crouched, restrained) {
    motion.stance = clamp(motion.stance + dt / (crouched ? 0.17 : -0.14));
    const distance = Math.hypot(dx, dy);
    const moved = distance > Math.max(1e-6, dt * 0.12);
    if (moved) motion.direction = alizaDirection(dx, dy, motion.direction);

    if (motion.stance > 0 && !(moved && crouched && motion.stance === 1)) {
        motion.action = 'crouch';
        return;
    }
    if (!moved) {
        motion.action = 'stand';
        return;
    }
    const action = crouched ? 'crouchWalk' : restrained && motion.direction === 4 ? 'walk' : 'run';
    const stride = action === 'crouchWalk' ? 0.88 : action === 'walk' ? 1.65 : 1.60;
    motion.phase = cycle((motion.action === action ? motion.phase : 0) + distance / stride);
    motion.action = action;
}

export function alizaPose(player) {
    const { action, direction, phase, stance } = player._alizaMotion;
    if (player.dashTimer > 0 && player._alizaDashDuration > 0) {
        return {
            action: 'dash',
            direction: alizaDirection(player.dashDirX, player.dashDirY, direction),
            progress: 1 - player.dashTimer / player._alizaDashDuration,
        };
    }
    if (player._gunSpriteTimer > 0) {
        return { action: 'gunfire', direction: player._alizaGunDirection, progress: 1 - player._gunSpriteTimer / ALIZA_GUN_DURATION };
    }
    if (player.state === 'attacking' && player._alizaKnifeDuration > 0) {
        return {
            action: 'knife',
            direction: player._alizaKnifeDirection,
            progress: 1 - player.attackTimer / player._alizaKnifeDuration,
        };
    }
    return { action, direction, progress: action === 'crouch' ? stance : phase };
}

const directions = ['n', 'ne', 'e', 'se', 's', 'se', 'e', 'ne'];
const crouchWalkTiming = [0.18, 0.45, 0.68, 1];
const clips = {
    stand: [[0], [1]],
    dash: [[4, 5, 6, 7], [0.14, 0.34, 0.78, 1]],
    crouch: [[0, 4, 14], [0.20, 0.63, 1]],
    crouchWalk: [[15, 14, 4, 14], crouchWalkTiming],
    knife: [[12, 13, 0], [0.31, 0.71, 1]],
    gunfire: [[9, 10, 11], [0.37, 0.69, 1]],
};

export function alizaFrame({ action, direction, progress }) {
    const heading = directions[direction];
    if (!heading || !Number.isFinite(progress)) return null;
    const mirrored = direction >= 5;
    if (action === 'run') {
        const cell = `run-${heading}-${Math.floor(cycle(progress) * 16)}`;
        return { cell, mirrored };
    }
    let [cells, timing] = clips[action] ?? [];
    let prefix = heading;
    if (action === 'walk' && direction === 4) {
        prefix = 'walk';
        cells = [0, 5, 6, 3, 4, 1, 2, 7];
        timing = [0.10, 0.23, 0.38, 0.50, 0.60, 0.73, 0.88, 1];
    }
    if (heading === 'se') {
        if (action === 'stand') cells = [15];
        if (action === 'dash') cells = [0, 1, 2, 3];
        if (action === 'crouch') cells = [12, 13, 14];
        if (action === 'knife') cells = [10, 11, 15];
        if (action === 'gunfire') cells = [5, 6, 7];
    }
    if (action === 'crouchWalk' && ['ne', 'e', 'se'].includes(heading)) {
        prefix = heading + '-low';
        cells = [0, 1, 2, 3];
    }
    if (!cells) return null;
    const loop = action === 'walk' || action === 'crouchWalk';
    const p = loop ? cycle(progress) : clamp(progress);
    const index = timing.findIndex(end => p < end);
    const cell = prefix + '-' + cells[index < 0 ? cells.length - 1 : index];
    return atlasFrames[cell] ? { cell, mirrored } : null;
}

export function loadAlizaAtlas() {
    const image = new Image();
    image.src = new URL('./aliza-frames-v2.png', import.meta.url).href;
    return image.decode().then(() => image);
}

export function drawAlizaFrame(ctx, image, frame, x, y, standingHeight, breath = 1, flash = 0) {
    const [sx, sy, w, h, pivotX, pivotY] = atlasFrames[frame.cell];
    const scale = standingHeight / 120;
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(frame.mirrored ? -scale : scale, scale * breath);
    ctx.drawImage(image, sx, sy, w, h, -pivotX, -pivotY, w, h);
    const muzzle = muzzlePivots[frame.cell];
    if (muzzle && flash > 0) {
        const [mx, my] = muzzle;
        const radius = 8 + flash * 8;
        const glow = ctx.createRadialGradient(mx, my, 0, mx, my, radius);
        glow.addColorStop(0, `rgba(255,244,210,${flash})`);
        glow.addColorStop(0.25, `rgba(255,178,86,${flash * 0.82})`);
        glow.addColorStop(1, 'rgba(255,116,36,0)');
        ctx.fillStyle = glow;
        ctx.fillRect(mx - radius, my - radius, 2 * radius, 2 * radius);
    }
    ctx.restore();
}
