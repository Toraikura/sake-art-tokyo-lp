// SAKE CLASH iPhone engine, pinned to 9e391336f4b4dceee217289cc1100e5a1d55885a.
// LP-only copy: 30-second duration; React card component removed from art.js.
// Original game and its storage are not changed. See SOURCE.md.
export const COLORS = {
    1: { tile: '#69c5ab', edge: '#137765', dark: '#075d51', light: '#bbf6d4' },
    2: { tile: '#eb9475', edge: '#a3422b', dark: '#843b2c', light: '#ffd4a6' },
};
export const ROLE = {
    tokkuri: '固定・反射', yeast: '移動・3体', koji: '移動・四方',
    sugidama: '固定・支援', awa: '一撃・平行', kai: '一撃・円範囲',
};
/** Single source of shapes for card canvases, placement ghosts and live units. */
export function glyph(ctx, kind, side = 1, angle = -Math.PI / 2) {
    const c = COLORS[side];
    ctx.save();
    ctx.lineWidth = 0.12;
    ctx.strokeStyle = '#213a32';
    ctx.fillStyle = c.dark;
    if (kind === 'tokkuri') {
        ctx.beginPath();
        ctx.roundRect(-.75, -.6, 1.5, 1.35, .3);
        ctx.fill();
        ctx.stroke();
        ctx.rotate(angle);
        ctx.fillStyle = c.edge;
        ctx.beginPath();
        ctx.arc(0, 0, .6, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = c.light;
        ctx.beginPath();
        ctx.roundRect(-.1, -.28, 1.5, .56, .13);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = c.dark;
        ctx.fillRect(1.15, -.26, .22, .52);
    }
    else if (kind === 'sugidama') {
        ctx.beginPath();
        ctx.roundRect(-1, -.65, 2, 1.3, .25);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = c.light;
        ctx.beginPath();
        ctx.arc(0, -.14, .62, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.strokeStyle = c.edge;
        ctx.lineWidth = .2;
        ctx.beginPath();
        ctx.moveTo(-.3, -.14);
        ctx.lineTo(.3, -.14);
        ctx.moveTo(0, -.44);
        ctx.lineTo(0, .16);
        ctx.stroke();
    }
    else if (kind === 'koji') {
        // Functional direction must remain correct even with reduced motion enabled.
        ctx.rotate(angle);
        ctx.beginPath();
        ctx.roundRect(-.8, -.8, 1.6, 1.6, .2);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = c.light;
        ctx.beginPath();
        ctx.arc(0, 0, .48, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        for (let i = 0; i < 4; i++) {
            ctx.rotate(Math.PI / 2);
            ctx.fillStyle = c.edge;
            ctx.fillRect(.6, -.19, .6, .38);
        }
    }
    else if (kind === 'yeast') {
        ctx.fillStyle = c.edge;
        ctx.beginPath();
        ctx.ellipse(0, 0, .48, .62, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = c.light;
        ctx.beginPath();
        ctx.arc(.3, -.42, .22, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = '#fff9e8';
        ctx.beginPath();
        ctx.arc(-.16, -.08, .085, 0, Math.PI * 2);
        ctx.arc(.13, -.08, .085, 0, Math.PI * 2);
        ctx.fill();
    }
    else if (kind === 'awa') {
        ctx.strokeStyle = c.dark;
        ctx.lineWidth = .15;
        for (let i = -1; i <= 1; i++) {
            const x = i * .65;
            ctx.beginPath();
            ctx.moveTo(x, .85);
            ctx.lineTo(x, -.85);
            ctx.moveTo(x - .2, -.5);
            ctx.lineTo(x, -.85);
            ctx.lineTo(x + .2, -.5);
            ctx.stroke();
            ctx.fillStyle = c.light;
            ctx.beginPath();
            ctx.arc(x, .35, .23, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();
        }
    }
    else {
        ctx.strokeStyle = c.edge;
        ctx.setLineDash([.2, .15]);
        ctx.beginPath();
        ctx.arc(0, 0, 1, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.rotate(-.55);
        ctx.fillStyle = c.light;
        ctx.beginPath();
        ctx.roundRect(-.15, -.9, .3, 1.8, .1);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = c.dark;
        ctx.fillRect(-.32, .15, .64, .6);
    }
    ctx.restore();
}
