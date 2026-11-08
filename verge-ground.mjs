// Each material is baked once into four 4× isometric tiles. Camera motion
// changes only their placement, so the grain stays fixed to the world.
const materials = {
    deadgrass: [57, 61, 39], dirt: [67, 53, 41], path: [76, 63, 49],
    road: [49, 50, 51], asphalt: [45, 46, 47], concrete: [79, 78, 72],
    sidewalk: [91, 88, 78], hub_stone: [70, 60, 49], hub_edge: [61, 53, 44],
};

export function createGroundAtlas(document, width, height) {
    const atlas = {};
    for (const [kind, rgb] of Object.entries(materials)) {
        atlas[kind] = Array.from({ length: 4 }, (_, variant) => {
            let seed = (variant + 1) * 271 + rgb[0];
            const random = () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296);
            const tile = document.createElement('canvas');
            tile.width = (width + 1) * 4;
            tile.height = (height + 0.5) * 4;
            const ctx = tile.getContext('2d');
            ctx.setTransform(tile.width / 2, tile.height / 2, -tile.width / 2, tile.height / 2, tile.width / 2, 0);
            ctx.beginPath();
            ctx.rect(0, 0, 1, 1);
            ctx.clip();
            ctx.fillStyle = `rgb(${rgb.join(',')})`;
            ctx.fillRect(0, 0, 1, 1);
            for (let i = 0; i < 1250; i++) {
                const size = i < 45 ? 0.018 + random() * 0.08 : 0.003 + random() * 0.014;
                ctx.fillStyle = random() < 0.5 ? 'rgba(13,12,10,.18)' : 'rgba(180,164,128,.17)';
                ctx.fillRect(random(), random(), size, size);
            }

            if (kind === 'deadgrass') {
                for (let i = 0; i < 125; i++) {
                    const x = random(), y = random();
                    ctx.strokeStyle = i % 3 ? 'rgba(121,121,70,.36)' : 'rgba(29,34,21,.66)';
                    ctx.lineWidth = 0.006 + random() * 0.008;
                    ctx.beginPath();
                    ctx.moveTo(x, y);
                    ctx.lineTo(x + random() * 0.025 - 0.013, y - 0.02 - random() * 0.06);
                    ctx.stroke();
                }
            } else if (kind === 'sidewalk' || kind === 'hub_stone' || kind === 'hub_edge') {
                const rows = kind === 'sidewalk' ? 1 : 4;
                ctx.lineWidth = kind === 'sidewalk' ? 0.022 : 0.013;
                ctx.strokeStyle = 'rgba(25,22,19,.54)';
                for (let row = 0; row < rows; row++) {
                    ctx.strokeRect(0, row / rows, 1, 1 / rows);
                    if (rows > 1) ctx.strokeRect(row % 2 ? 0.27 : 0.52, row / rows, 1, 1 / rows);
                }
                ctx.strokeStyle = 'rgba(202,185,155,.21)';
                ctx.strokeRect(0.018, 0.018, 0.964, 0.964);
            } else {
                // Sparse fissures in asphalt and rain-worn grooves in mud.
                ctx.lineWidth = 0.007;
                ctx.strokeStyle = kind === 'road' || kind === 'asphalt' ? 'rgba(13,15,16,.65)' : 'rgba(39,27,19,.36)';
                for (let i = 0; i < 3; i++) {
                    let x = random(), y = random();
                    ctx.beginPath();
                    ctx.moveTo(x, y);
                    for (let j = 0; j < 5; j++) {
                        x += 0.028 + random() * 0.037;
                        y += random() * 0.1 - 0.05;
                        ctx.lineTo(x, y);
                    }
                    ctx.stroke();
                }
            }
            return tile;
        });
    }
    return atlas;
}
