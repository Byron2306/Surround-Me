// The world reads this event. Greyline still owns the player's behaviour and depth.
const ENTER_SECONDS = 1.1;
const RELEASE_SECONDS = .9;
const RISE_SPEED = .85;
const FALL_SPEED = .58;
const STAGE_INTENSITY = [0, .20, .46];
const NEUTRAL = { g: 0, depth: 0, tier: 0, persist: 0 };
const PREVIEW = {
    compulsion: { g: .95, depth: .96, tier: 3, persist: .9 },
    restraint: { g: -.95, depth: .96, tier: 3, persist: .9 },
    release: NEUTRAL,
};

// Holding the edge builds depth on either side. Fixation accelerates the fall.
export function advanceSamsarraDepth(depth, extremity, persist, dt, config) {
    const { samATheta, samFill, samDecay } = config;
    const pressure = Math.max(0, (extremity - samATheta) / (1 - samATheta));
    const fill = samFill * pressure * (.35 + .65 * persist);
    const decay = samDecay * (1 - extremity) * (1 - pressure) ** 2;
    return Math.max(0, Math.min(1, depth + dt * (fill - decay)));
}

export function createSamsarraEvent() {
    let snapshot = { phase: 'ordinary', polarity: null, intensity: 0 };
    let candidate = null;
    let enteredFor = 0;
    let recoveredFor = 0;
    let override = null;

    return {
        get snapshot() { return snapshot; },
        preview(mode) { override = mode; },
        update(live, dt) {
            if (!(dt > 0)) return snapshot;
            const { g, depth, tier, persist } = PREVIEW[override] ?? live;
            const side = g < 0 ? 'restraint' : 'compulsion';
            const atExtreme = tier >= 3 && Math.abs(g) >= .65;
            let { phase, polarity, intensity } = snapshot;
            let target;
            if (phase === 'samsarra' || phase === 'release') {
                const previewRecovery = override !== null && override !== polarity;
                const recovered = depth < .52 && Math.abs(g) < .40 && persist < .45;
                recoveredFor = recovered ? recoveredFor + dt : 0;
                if (previewRecovery || recoveredFor >= RELEASE_SECONDS) phase = 'release';
                else if (phase === 'release' && !recovered) phase = 'samsarra';
                target = phase === 'release' ? 0 : 1;
            } else {
                enteredFor = atExtreme ? (candidate === side ? enteredFor : 0) + dt : 0;
                candidate = atExtreme ? side : null;
                if (enteredFor >= ENTER_SECONDS) {
                    phase = 'samsarra';
                    polarity = candidate;
                    recoveredFor = 0;
                    target = 1;
                } else {
                    const stage = Math.min(2, tier);
                    phase = ['ordinary', 'bleed', 'pressure'][stage];
                    if (stage && Math.abs(g) > .10) polarity = side;
                    target = STAGE_INTENSITY[stage];
                }
            }
            intensity = target > intensity
                ? Math.min(target, intensity + dt * RISE_SPEED)
                : Math.max(target, intensity - dt * FALL_SPEED);
            if (intensity === 0 && target === 0) {
                if (phase === 'release') {
                    phase = 'ordinary';
                    enteredFor = 0;
                    candidate = null;
                }
                polarity = null;
            }
            snapshot = { phase, polarity, intensity };
            return snapshot;
        },
    };
}

export function samsarraEnemyForm(event) {
    return event.intensity >= .62 ? event.polarity : 'ordinary';
}
