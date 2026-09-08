// SAKE CLASH iPhone engine, pinned to 9e391336f4b4dceee217289cc1100e5a1d55885a.
// LP-only copy: 30-second duration; React card component removed from art.js.
// Original game and its storage are not changed. See SOURCE.md.
import { W, H, AREAS, clamp } from './model.js';
import { COLORS, glyph } from './art.js';
import { preview, ray } from './preview.js';
let cached = null;
let magnifier = null;
export function draw(canvas, g, cursor, selected, reduced, showLens = false) {
    const ctx = canvas.getContext('2d');
    if (!ctx || canvas.clientWidth <= 0)
        return;
    const width = canvas.clientWidth, ratio = Math.min(devicePixelRatio || 1, 2), height = (width * H) / W;
    if (canvas.width !== Math.round(width * ratio) ||
        canvas.height !== Math.round(height * ratio)) {
        canvas.width = Math.round(width * ratio);
        canvas.height = Math.round(height * ratio);
    }
    const unit = width / W;
    ctx.setTransform(unit * ratio, 0, 0, unit * ratio, 0, 0);
    ctx.clearRect(0, 0, W, H);
    for (let y = 0; y < H; y++)
        for (let x = 0; x < W; x++) {
            const side = g.tiles[y * W + x];
            ctx.fillStyle = COLORS[side].tile;
            ctx.fillRect(x, y, 1, 1);
            ctx.strokeStyle = side === 1 ? '#246f5933' : '#963d2730';
            ctx.lineWidth = 0.035;
            ctx.strokeRect(x, y, 1, 1);
        }
    // A crisp changing frontier makes terrain ownership visible without reading the meter.
    ctx.lineWidth = 0.09;
    ctx.strokeStyle = '#fff5ddbb';
    ctx.beginPath();
    for (let y = 0; y < H; y++)
        for (let x = 0; x < W; x++) {
            const i = y * W + x;
            if (x < W - 1 && g.tiles[i] !== g.tiles[i + 1]) {
                ctx.moveTo(x + 1, y);
                ctx.lineTo(x + 1, y + 1);
            }
            if (y < H - 1 && g.tiles[i] !== g.tiles[i + W]) {
                ctx.moveTo(x, y + 1);
                ctx.lineTo(x + 1, y + 1);
            }
        }
    ctx.stroke();
    for (const f of g.fx) {
        if (reduced)
            continue;
        ctx.globalAlpha = (f.life / f.max) * 0.5;
        ctx.strokeStyle = COLORS[f.side].light;
        ctx.lineWidth = 0.18;
        ctx.beginPath();
        ctx.arc(f.x, f.y, f.radius * (1.3 - (f.life / f.max) * 0.3), 0, Math.PI * 2);
        ctx.stroke();
        ctx.globalAlpha = 1;
    }
    for (const u of g.units) {
        ctx.save();
        ctx.translate(u.x, u.y);
        // Different team marks remain readable without the hue distinction.
        ctx.fillStyle = COLORS[u.side].light;
        ctx.strokeStyle = COLORS[u.side].dark;
        ctx.lineWidth = .12;
        ctx.beginPath();
        if (u.side === 1)
            ctx.arc(0, .15, .88, 0, Math.PI * 2);
        else {
            ctx.moveTo(0, -.85);
            ctx.lineTo(1, .15);
            ctx.lineTo(0, 1.15);
            ctx.lineTo(-1, .15);
            ctx.closePath();
        }
        ctx.fill();
        ctx.stroke();
        glyph(ctx, u.kind, u.side, u.angle);
        ctx.restore();
        ctx.fillStyle = '#173f3580';
        ctx.fillRect(u.x - .6, u.y - 1.1, 1.2, .14);
        ctx.fillStyle = '#fff8dc';
        ctx.fillRect(u.x - .6, u.y - 1.1, 1.2 * Math.max(0, u.hp / u.maxHp), .14);
    }
    for (const b of g.shots) {
        const c = COLORS[b.side];
        ctx.strokeStyle = c.edge;
        ctx.lineWidth = 0.17;
        ctx.fillStyle = c.light;
        ctx.beginPath();
        ctx.arc(b.x, b.y, b.radius * 0.32, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        if (!reduced) {
            ctx.strokeStyle = c.light + '99';
            ctx.lineWidth = 0.13;
            ctx.beginPath();
            ctx.moveTo(b.x, b.y);
            ctx.lineTo(b.x - b.vx * 0.045, b.y - b.vy * 0.045);
            ctx.stroke();
        }
    }
    if (cursor && selected !== null && g.status === 'playing') {
        const key = `${Math.floor(g.tick / 3)}:${selected}:${g.hand[selected]}:${cursor.x}:${cursor.y}`;
        if (!cached || cached.match !== g || cached.key !== key)
            cached = { match: g, key, value: preview(g, selected, cursor) };
        const info = cached.value, kind = g.hand[selected];
        const color = info.error ? '#8c2e26' : '#fff9dc';
        const circle = (radius, dash) => {
            ctx.strokeStyle = color;
            ctx.lineWidth = .16;
            ctx.setLineDash(dash ? [.3, .18] : []);
            ctx.beginPath();
            ctx.arc(cursor.x, cursor.y, radius, 0, Math.PI * 2);
            ctx.stroke();
            ctx.setLineDash([]);
        };
        if (kind === 'kai') {
            circle(AREAS.kaiPaint, false);
            circle(AREAS.kaiDamage, true);
        }
        else if (kind === 'sugidama')
            circle(AREAS.support, false);
        else if (info.error)
            circle(1.2, true);
        if (!info.error) {
            for (const m of info.moves)
                arrow(ctx, [m.from, m.to], true);
            for (const b of info.shots)
                arrow(ctx, ray(b), false);
            ctx.globalAlpha = .85;
            if (info.units.length)
                for (const u of info.units) {
                    ctx.save();
                    ctx.translate(u.x, u.y);
                    glyph(ctx, kind, 1, u.angle);
                    ctx.restore();
                }
            else {
                ctx.save();
                ctx.translate(cursor.x, cursor.y);
                glyph(ctx, kind);
                ctx.restore();
            }
            ctx.globalAlpha = 1;
        }
        else {
            ctx.strokeStyle = color;
            ctx.lineWidth = .2;
            ctx.beginPath();
            ctx.moveTo(cursor.x - .55, cursor.y - .55);
            ctx.lineTo(cursor.x + .55, cursor.y + .55);
            ctx.moveTo(cursor.x + .55, cursor.y - .55);
            ctx.lineTo(cursor.x - .55, cursor.y + .55);
            ctx.stroke();
        }
        // An exact touch location: only the magnified VIEW is offset, never the deployment.
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(cursor.x, cursor.y, .12, 0, Math.PI * 2);
        ctx.fill();
        if (showLens)
            lens(ctx, canvas, cursor, !info.error, unit, ratio);
        canvas.dataset.previewValid = String(!info.error);
    }
    else
        delete canvas.dataset.previewValid;
}
function arrow(ctx, points, moving) {
    if (points.length < 2)
        return;
    ctx.save();
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.setLineDash(moving ? [.35, .23] : []);
    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    for (const p of points.slice(1))
        ctx.lineTo(p.x, p.y);
    ctx.strokeStyle = '#213a32a0';
    ctx.lineWidth = .26;
    ctx.stroke();
    ctx.strokeStyle = moving ? '#fff9dc' : '#ffd063';
    ctx.lineWidth = .12;
    ctx.stroke();
    ctx.setLineDash([]);
    const a = points[points.length - 2], b = points[points.length - 1];
    const direction = Math.atan2(b.y - a.y, b.x - a.x);
    ctx.translate(b.x, b.y);
    ctx.rotate(direction);
    ctx.fillStyle = moving ? '#fff9dc' : '#ffd063';
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(-.55, -.27);
    ctx.lineTo(-.55, .27);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
}
function lens(ctx, board, p, valid, unit, ratio) {
    if (!magnifier)
        magnifier = document.createElement('canvas');
    magnifier.width = 180;
    magnifier.height = 128;
    const copy = magnifier.getContext('2d');
    if (!copy)
        return;
    const sourceW = 7, sourceH = 5;
    const sx = clamp(p.x - sourceW / 2, 0, W - sourceW), sy = clamp(p.y - sourceH / 2, 0, H - sourceH);
    copy.drawImage(board, sx * unit * ratio, sy * unit * ratio, sourceW * unit * ratio, sourceH * unit * ratio, 0, 0, 180, 128);
    const w = Math.min(112 / unit, W * .47), h = 86 / unit, gap = 36 / unit;
    const x = clamp(p.x - w / 2, .3, W - w - .3);
    let y = p.y - gap - h;
    if (y < .3)
        y = p.y + gap;
    y = clamp(y, .3, Math.max(.3, H - h - .3));
    ctx.save();
    ctx.strokeStyle = valid ? '#fff9dc' : '#8c2e26';
    ctx.lineWidth = .12;
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
    ctx.lineTo(x + w / 2, y < p.y ? y + h : y);
    ctx.stroke();
    ctx.fillStyle = '#fffaf0';
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, .3);
    ctx.fill();
    ctx.stroke();
    ctx.save();
    ctx.beginPath();
    ctx.roundRect(x + .12, y + .12, w - .24, h - .24, .2);
    ctx.clip();
    ctx.drawImage(magnifier, x + .12, y + .12, w - .24, h - 20 / unit);
    ctx.restore();
    ctx.fillStyle = '#213a32';
    ctx.font = `bold ${10 / unit}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillText(valid ? '離して配置 · 初動の予測' : '× ここには置けません', x + w / 2, y + h - 6 / unit);
    ctx.restore();
}
