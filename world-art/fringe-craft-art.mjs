const ART = new URL('./fringe-craft/', import.meta.url);
const faces = ['ordinary','restraint','compulsion'];

export async function loadFringeCraftArt() {
    const names = ['streetlamp','lingering','watchful', ...faces.map(face => `a01-${face}`)];
    const images = await Promise.all(names.map(async name => {
        const image = new Image();
        image.src = new URL(`${name}.webp`, ART).href;
        try {
            await image.decode();
            return [name,image];
        } catch {
            console.warn(`[Fringe Craft] ${name} unavailable; using base presentation.`);
            return [name,null];
        }
    }));
    return Object.fromEntries(images);
}

function grain(x, y, salt) {
    const n = Math.imul(x * 91 + salt, 374761393) ^ Math.imul(y * 127 - salt, 668265263);
    return ((Math.imul(n ^ n >>> 13, 1274126177) >>> 0) / 4294967296);
}

function ellipse(ctx,x,y,w,h,fill) {
    ctx.fillStyle = fill;
    ctx.beginPath();
    ctx.ellipse(x,y,w,h,0,0,Math.PI*2);
    ctx.fill();
}

function paintGround(ctx, roads, edges, lamp, project, ox, oy, state) {
    const point = (x,y) => {
        const p = project(x,y);
        return [p.x-ox,p.y-oy];
    };
    const ash = state === 'restraint';
    const rot = state === 'compulsion' || state === 'samsarra';
    const lampPos = point(lamp.x,lamp.y);
    const reflectionX = lampPos[0] + 33;
    const reflectionY = lampPos[1] + 8;
    for (const {x,y} of roads) {
        const [sx,sy] = point(x,y);
        const n = grain(x,y,1);
        if (n > .72 || n > .39 && Math.hypot(sx-reflectionX,(sy-reflectionY)*1.8) < 62) {
            const dx = (grain(x,y,17)-.5)*27;
            const dy = (grain(x,y,24)-.5)*11;
            const pool = (1 - Math.min(1,Math.hypot((sx+dx-reflectionX)/104,(sy+dy-reflectionY)/49)));
            const radius = 7 + grain(x,y,30) * 17;
            ctx.save();
            ctx.translate(sx+dx,sy+dy);
            ctx.rotate((grain(x,y,31)-.5)*.68);
            ctx.beginPath();
            for (let i=0;i<14;i++) {
                const angle = i/14*Math.PI*2;
                const edge = .65 + grain(x,y,33+i)*.42;
                const px = Math.cos(angle)*radius*edge;
                const py = Math.sin(angle)*(2.5+n*3)*edge;
                if (i===0) ctx.moveTo(px,py); else ctx.lineTo(px,py);
            }
            ctx.closePath();
            ctx.fillStyle = 'rgba(14,19,22,.28)';
            ctx.fill();
            ctx.clip();
            for (let i=0;i<9;i++) {
                const bandX = (grain(x,y,61+i)-.5)*radius*1.55;
                const bandY = (grain(x,y,82+i)-.5)*7;
                const a = .10 + pool * (.46 + grain(x,y,104+i)*.21);
                const tint = ash ? '164,175,177' : pool<.16 ? '136,150,155' : rot ? '231,115,66' : '221,174,108';
                ellipse(ctx,bandX,bandY,1+grain(x,y,124+i)*6,.29+pool*.45,`rgba(${tint},${a})`);
            }
            ctx.restore();
        }
        if (n < .38 || rot && n < .56) {
            const line = [[x-.48,y+.12],[x-.24,y-.10],[x-.08,y+.07],[x+.13,y-.18],[x+.32,y-.14]];
            ctx.beginPath();
            ctx.moveTo(...point(...line[0]));
            for (const p of line.slice(1)) ctx.lineTo(...point(...p));
            ctx.strokeStyle = '#242725';
            ctx.lineWidth = 1.45;
            ctx.stroke();
            ctx.translate(0,.95);
            ctx.strokeStyle = rot ? 'rgba(178,91,64,.59)' : 'rgba(152,146,128,.41)';
            ctx.lineWidth = .65;
            ctx.stroke();
            ctx.translate(0,-.95);
        }
    }
    const light = ctx.createRadialGradient(reflectionX,reflectionY,0,reflectionX,reflectionY,86);
    light.addColorStop(0, ash ? 'rgba(168,178,177,.08)' : rot ? 'rgba(231,117,54,.29)' : 'rgba(251,194,112,.27)');
    light.addColorStop(.44, ash ? 'rgba(148,154,155,.04)' : 'rgba(173,113,59,.12)');
    light.addColorStop(1,'rgba(116,83,43,0)');
    ctx.save();
    ctx.translate(reflectionX,reflectionY);
    ctx.scale(1,.45);
    ctx.translate(-reflectionX,-reflectionY);
    ellipse(ctx,reflectionX,reflectionY,86,86,light);
    ctx.restore();

    for (const {x,y} of edges) {
        const [sx,sy] = point(x,y);
        const count = 4 + Math.floor(grain(x,y,137)*21);
        for (let i=0;i<count;i++) {
            const dx = (grain(x,y,171+i)-.5)*44;
            const dy = (grain(x,y,221+i)-.5)*15;
            const n = grain(x,y,277+i);
            const colors = ash ? ['#7b7a6f','#4e544e','#5e6055'] : ['#906b42','#574434','#a1804d'];
            ctx.save();
            ctx.translate(sx+dx,sy+dy);
            ctx.rotate((n-.5)*2.4);
            ellipse(ctx,0,.65,1.3+n*1.4,.8,'rgba(14,17,14,.57)');
            ellipse(ctx,0,0,1.25+n*1.4,.65,colors[i%3]);
            ctx.restore();
        }
    }
    const nearest = roads.reduce((best, cell) => !best || Math.hypot(cell.x-lamp.x-1,cell.y-lamp.y+1) <
        Math.hypot(best.x-lamp.x-1,best.y-lamp.y+1) ? cell : best, null);
    if (!nearest) return;
    const [mx,my] = point(nearest.x,nearest.y);
    ellipse(ctx,mx,my,15,7.5,'rgba(23,23,22,.62)');
    ellipse(ctx,mx,my-1,12.2,6,'#776b57');
    ellipse(ctx,mx,my-.3,10.8,5.2,rot ? '#492d28' : '#373936');
    for(let i=-7;i<=7;i+=2) {
        for(let j=-2;j<=2;j+=2) {
            ctx.fillStyle = (i+j)%4 ? '#686051' : '#222624';
            ctx.fillRect(mx+i,my+j-.6,1.4,.75);
        }
    }
    if (state === 'samsarra') {
        for (let i=0;i<11;i++) {
            const t = i/11 * Math.PI*2;
            const bend = t + .37 + grain(i,i,4)*.35;
            ctx.beginPath();
            ctx.moveTo(mx+Math.cos(t)*11,my+Math.sin(t)*5);
            ctx.quadraticCurveTo(mx+Math.cos(bend)*27,my+Math.sin(bend)*14,
                mx+Math.cos(t)*55,my+Math.sin(t)*29);
            ctx.strokeStyle = i%3 ? 'rgba(70,24,27,.63)' : 'rgba(181,71,52,.55)';
            ctx.lineWidth = i%3 ? 2.1 : 1.2;
            ctx.stroke();
        }
    }
}

export function buildFringeDressing(review, project) {
    const cells = review.layout.cells;
    const {x,y} = review.mailbox;
    const byCell = new Map(cells.map(cell => [`${cell.x},${cell.y}`,cell.role]));
    const sites = cells.filter(cell => cell.role === 'curb' && cell.module !== 'curb-driveway' &&
        (byCell.get(`${cell.x+1},${cell.y}`) === 'road' || byCell.get(`${cell.x},${cell.y-1}`) === 'road'));
    sites.sort((a,b) => Math.hypot(a.x-x-1.7,a.y-y-2.2)-Math.hypot(b.x-x-1.7,b.y-y-2.2));
    if (!sites.length) return null;
    const site = sites[0];
    const lamp = {x:site.x, y:site.y};
    const roadToEast = byCell.get(`${site.x+1},${site.y}`) === 'road';
    lamp.x += roadToEast ? -.28 : .22;
    lamp.y += roadToEast ? .22 : .28;
    const roads = cells.filter(cell => cell.role === 'road' && Math.hypot(cell.x-lamp.x,cell.y-lamp.y) < 5.6);
    const edges = cells.filter(cell => (cell.role === 'curb' || cell.role === 'sidewalk') &&
        Math.hypot(cell.x-lamp.x,cell.y-lamp.y) < 5 && grain(cell.x,cell.y,152) > .29 && cell.module !== 'curb-driveway');
    const origin = project(lamp.x,lamp.y);
    const left = Math.floor(origin.x - 300), top = Math.floor(origin.y - 170);
    const layers = {};
    for (const state of [...faces,'samsarra']) {
        const canvas = document.createElement('canvas');
        canvas.width = 600;
        canvas.height = 340;
        paintGround(canvas.getContext('2d'),roads,edges,lamp,project,left,top,state);
        layers[state] = canvas;
    }
    return {lamp,left,top,layers};
}

export function drawFringeDressing(ctx, dressing, cam, event) {
    const {layers,left,top} = dressing;
    const intensity = event.intensity ?? 0;
    const state = event.polarity === 'compulsion' && (event.phase === 'samsarra' || event.phase === 'release')
        ? 'samsarra' : event.polarity;
    const variant = layers[state];
    const alpha = variant ? intensity : 0;
    ctx.save();
    if (alpha < 1) {
        ctx.globalAlpha = 1-alpha;
        ctx.drawImage(layers.ordinary,left+cam.x,top+cam.y);
    }
    if (alpha > 0) {
        ctx.globalAlpha = alpha;
        ctx.drawImage(variant,left+cam.x,top+cam.y);
    }
    ctx.restore();
}

export function drawFringeLamp(ctx, image, sx, sy, event) {
    if (!image) return;
    ctx.save();
    ellipse(ctx,sx,sy+2,9,3,'rgba(17,18,17,.38)');
    if (event.polarity === 'restraint') ctx.filter = `saturate(${1-event.intensity*.85}) brightness(${1-event.intensity*.22})`;
    ctx.drawImage(image,sx-10,sy-126,51,128);
    ctx.restore();
}
