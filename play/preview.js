// SAKE CLASH iPhone engine, pinned to 9e391336f4b4dceee217289cc1100e5a1d55885a.
// LP-only copy: 30-second duration; React card component removed from art.js.
// Original game and its storage are not changed. See SOURCE.md.
import { AREAS, W, H, canPlace, deploy, updateUnits } from './model.js';
/** Initial action, not a prediction of a whole fight. Only the cloned new units fire.
 * Positions/shot parameters come from deploy/updateUnits, never a second ruleset.
 * Existing units may move; their attacks and the CPU's next decision are not forecast.
 */
export function preview(g, index, p) {
    const error = canPlace(g, index, p.x, p.y);
    if (error)
        return { error, units: [], moves: [], shots: [] };
    const copy = structuredClone(g);
    copy.fx = [];
    for (const u of copy.units)
        u.fire = Infinity;
    deploy(copy, index, p.x, p.y);
    const added = copy.units.filter((u) => u.id > g.serial);
    const origins = added.map((u) => ({ ...u }));
    const moves = [];
    // Four 30 Hz steps reach the existing 0.1s first-fire timer (including float rounding).
    for (let i = 0; i < 4; i++) {
        copy.tick++;
        updateUnits(copy);
        if (i === 0)
            added.forEach((u, k) => {
                const from = origins[k];
                const dx = u.x - from.x, dy = u.y - from.y, length = Math.hypot(dx, dy);
                if (length > 0)
                    moves.push({ from, to: { x: from.x + dx / length * 2, y: from.y + dy / length * 2 } });
            });
    }
    return {
        error: null,
        units: origins.map((u, i) => ({ ...u, angle: added[i].angle })),
        moves,
        shots: copy.shots.filter((b) => b.id > g.serial),
    };
}
/** Indicative ray to one wall reflection at most; finite range, no promised hits.
 * The real collision solver remains authoritative. */
export function ray(b) {
    let x = b.x, y = b.y, vx = b.vx, vy = b.vy;
    let left = b.life;
    const points = [{ x, y }];
    for (let n = 0; n < (b.bounces > 0 ? 2 : 1) && left > 0; n++) {
        const tx = Math.abs(vx) < 1e-9 ? Infinity : ((vx > 0 ? W - AREAS.wall : AREAS.wall) - x) / vx;
        const ty = Math.abs(vy) < 1e-9 ? Infinity : ((vy > 0 ? H - AREAS.wall : AREAS.wall) - y) / vy;
        const t = Math.max(0, Math.min(left, tx, ty));
        x += vx * t;
        y += vy * t;
        points.push({ x, y });
        left -= t;
        if (t >= tx - 1e-8)
            vx *= -1;
        if (t >= ty - 1e-8)
            vy *= -1;
        if (t === 0)
            break;
    }
    return points;
}
