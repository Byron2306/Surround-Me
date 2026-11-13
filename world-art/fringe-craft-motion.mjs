const clamp01 = value => Math.max(0, Math.min(1, value));

export function lingeringWindup(cornered, greyline) {
    return (cornered ? .24 : .34) * (1 - clamp01(greyline) * .22 + clamp01(-greyline) * .24);
}

export function clearLingeringStrike(x, y, dx, dy, blocked) {
    const steps = Math.ceil(Math.hypot(dx,dy) * 8);
    for (let step = 1; step < steps; step++) {
        if (blocked(x + dx*step/steps, y + dy*step/steps)) return false;
    }
    return true;
}

export function enemyCraftPose(enemy, now) {
    const {type, state, stateTimer = 0} = enemy;
    if (type === 'lingering') {
        if (state === 'strike_windup') {
            return {frame:5, anticipation:clamp01(stateTimer / enemy.strikeDuration)};
        }
        if (state === 'strike_recover') {
            return stateTimer < .105 ? {frame:6, impact:1 - stateTimer / .105} : {frame:7};
        }
        if (state === 'approaching' || state === 'retreating' || state === 'idle') {
            return {frame:Math.floor((enemy.strideDistance ?? 0) / .15) % 4};
        }
        return {frame:4};
    }
    if (type === 'watchful') {
        const elapsed = now - (enemy.fringeShotAt ?? -Infinity);
        if (elapsed < .09) return {frame:2, impact:1 - elapsed / .09};
        if (state === 'warning') {
            return {frame:1, charge:clamp01(1 - enemy.warningTimer / enemy.warningDuration)};
        }
        if (state === 'overcommitted' || (state === 'burst_firing' && elapsed < .19)) return {frame:3};
        if (state === 'burst_firing') return {frame:1};
        return {frame:0};
    }
    return null;
}

export function drawEnemyCraftFrame(ctx, atlas, type, frame, height) {
    const columns = type === 'lingering' ? 4 : 2;
    const cell = 192;
    const scale = height / 156;
    ctx.drawImage(atlas, frame % columns * cell, Math.floor(frame / columns) * cell,
        cell, cell, -85 * scale, 5 - 174 * scale, cell * scale, cell * scale);
}

// Keep the authored Otherworld silhouette while moving its feet, torso and lens.
export function drawEnemyCraftForm(ctx, image, type, pose, width, height) {
    const top = 5 - height;
    const split = Math.round(image.height * .69);
    const lowerHeight = height * (1 - split / image.height);
    const hip = 5 - lowerHeight;
    const step = type === 'lingering' && pose.frame < 4 ? [1,-.45,-1,.45][pose.frame] : 0;
    const thrust = pose.impact ?? 0;
    const coil = pose.anticipation ?? pose.charge ?? 0;
    ctx.save();
    ctx.translate(0, hip);
    ctx.transform(1, 0, step * .07, 1, 0, 0);
    ctx.drawImage(image, 0, split, image.width, image.height - split,
        -width / 2, 0, width, lowerHeight);
    ctx.restore();

    ctx.save();
    ctx.translate(0, hip);
    ctx.rotate(.18 * thrust - .10 * coil - step * .055);
    ctx.drawImage(image, 0, 0, image.width, split + 1,
        -width / 2, top - hip, width, hip - top + height / image.height);
    ctx.restore();
}
