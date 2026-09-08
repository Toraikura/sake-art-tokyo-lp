// SAKE CLASH iPhone engine, pinned to 9e391336f4b4dceee217289cc1100e5a1d55885a.
// LP-only copy: 30-second duration; React card component removed from art.js.
// Original game and its storage are not changed. See SOURCE.md.
/** Fictional territory-card game. Names evoke sake; no brewing, microbial or drinking simulation. */
export const W = 24, H = 34, DT = 1 / 30, DURATION = 30;
// Shared geometry: values are unchanged from v1.0.0.
export const AREAS = { kaiPaint: 3, kaiDamage: 3.4, support: 3.1, wall: 0.15 };
export const BREWS = {
    sokujo: {
        name: '速醸型',
        tag: '序盤から安定',
        description: '乳酸サポートを持って開始。補給8・被ダメージ10%軽減。',
    },
    kimoto: {
        name: '生酛型',
        tag: '育てて堅守',
        description: '補給5から開始。乳酸菌の拠点を守り、育成100で被ダメージ35%軽減。',
    },
};
export const CARDS = {
    tokkuri: {
        name: '徳利砲',
        short: '遠射',
        cost: 4,
        hp: 110,
        life: 26,
        description: 'その場から反射する酒しぶきを連射。遠くまで塗る主砲。',
        tag: '固定 / 長射程',
        icon: '砲',
    },
    yeast: {
        name: '酵母隊',
        short: '突撃',
        cost: 3,
        hp: 36,
        life: 17,
        description: '3体で前進。敵を追い、通った床も塗り替える。',
        tag: '移動 / 3体',
        icon: '酵',
    },
    koji: {
        name: '麹のこま',
        short: '回転',
        cost: 5,
        hp: 150,
        life: 23,
        description: '前進しながら四方へ発射。広く塗れる重い一手。',
        tag: '移動 / 全方向',
        icon: '麹',
    },
    sugidama: {
        name: '乳酸菌の拠点',
        short: '育成',
        cost: 2,
        hp: 240,
        life: 19,
        description: '敵弾を受け止め、近くの味方を修復。生酛型の育成も加速。',
        tag: '固定 / 防衛・育成',
        icon: '乳',
    },
    awa: {
        name: '泡の奔流',
        short: '直線',
        cost: 4,
        hp: 0,
        life: 0,
        description: '前方へ泡を放つ。線状に塗り、重なった敵へダメージ。',
        tag: '一撃 / 前線突破',
        icon: '泡',
    },
    kai: {
        name: '櫂入れ',
        short: '範囲',
        cost: 5,
        hp: 0,
        life: 0,
        description: '狙った地点を広く塗り替える。敵陣にも直接使える。',
        tag: '一撃 / 全域に配置可',
        icon: '櫂',
    },
};
export const DECKS = {
    balanced: {
        name: '均衡の蔵',
        description: '6種類を使い分ける。まずはこの手札で。',
        cards: ['tokkuri', 'yeast', 'sugidama', 'kai', 'koji', 'awa'],
    },
    battery: {
        name: '砲の蔵',
        description: '徳利砲2枚と盾。後方から弾幕を重ねる。',
        cards: ['tokkuri', 'sugidama', 'tokkuri', 'kai', 'koji', 'awa'],
    },
    rush: {
        name: '走る蔵',
        description: '酵母隊2枚。足場を広げて前へ展開する。',
        cards: ['yeast', 'yeast', 'koji', 'awa', 'sugidama', 'kai'],
    },
};
export const LEVELS = {
    practice: {
        name: '入門',
        description: '補給がゆっくりな相手。配置とカードの相性を試す。',
        aiEvery: 4.8,
        aiRegen: 0.6,
        thinking: 0.35,
    },
    standard: {
        name: '対等',
        description: '補給もカード性能も同条件。塗られた前線を狙い返す。',
        aiEvery: 2.7,
        aiRegen: 0.95,
        thinking: 0.8,
    },
    expert: {
        name: '熟練',
        description: '同じ補給・性能。攻撃位置と盾の使いどころを読む相手。',
        aiEvery: 1.3,
        aiRegen: 0.95,
        thinking: 1,
    },
};
const other = (s) => (s === 1 ? 2 : 1);
export const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
function random(g) {
    g.rng = (Math.imul(g.rng, 1664525) + 1013904223) >>> 0;
    return g.rng / 4294967296;
}
export function owner(g, x, y) {
    return x < 0 || y < 0 || x >= W || y >= H
        ? 0
        : g.tiles[Math.floor(y) * W + Math.floor(x)];
}
export function share(g) {
    return (g.counts[0] / (W * H)) * 100;
}
export function createMatch(difficulty = 'standard', deck = 'balanced', seed = 260907, brew = 'sokujo') {
    const seedSafe = Number.isFinite(seed)
        ? Math.abs(Math.trunc(seed)) >>> 0 || 260907
        : 260907;
    const cards = [...DECKS[deck].cards], enemy = [...DECKS.balanced.cards];
    return {
        brew,
        culture: brew === 'sokujo' ? 100 : 0,
        cultureReady: brew === 'sokujo',
        status: 'ready',
        difficulty,
        deck,
        seed: seedSafe,
        rng: seedSafe,
        tiles: Array.from({ length: W * H }, (_, i) => Math.floor(i / W) < H / 2 ? 2 : 1),
        units: [],
        shots: [],
        fx: [],
        hand: cards.slice(0, 4),
        queue: cards.slice(4),
        enemyHand: enemy.slice(0, 4),
        enemyQueue: enemy.slice(4),
        energy: brew === 'sokujo' ? 8 : 5,
        enemyEnergy: 7,
        time: DURATION,
        tick: 0,
        serial: 0,
        aiClock: 2.6,
        lock: 0,
        enemyLock: 0,
        counts: [(W * H) / 2, (W * H) / 2],
        peak: 50,
        played: 0,
        used: [],
        destroyed: 0,
        spend: 0,
        hold: 0,
        enemyHold: 0,
        message: 'カードを選び、緑の床へ配置',
        messageLife: 5,
        lastEnemy: '戦況を見ています',
        history: [{ time: 0, share: 50 }],
        lastHistory: 0,
        resultReason: '',
    };
}
export function start(g) {
    if (g.status === 'ready')
        g.status = 'playing';
}
export function pause(g) {
    if (g.status === 'playing')
        g.status = 'paused';
}
export function resume(g) {
    if (g.status === 'paused')
        g.status = 'playing';
}
function notify(g, text) {
    g.message = text;
    g.messageLife = 2.4;
}
export function paint(g, p, radius, side) {
    for (let y = Math.max(0, Math.floor(p.y - radius)); y < Math.min(H, Math.ceil(p.y + radius)); y++)
        for (let x = Math.max(0, Math.floor(p.x - radius)); x < Math.min(W, Math.ceil(p.x + radius)); x++) {
            if (Math.hypot(x + 0.5 - p.x, y + 0.5 - p.y) > radius)
                continue;
            const i = y * W + x;
            if (g.tiles[i] !== side) {
                g.counts[side - 1]++;
                g.counts[other(side) - 1]--;
                g.tiles[i] = side;
            }
        }
}
function effect(g, p, radius, side) {
    g.fx.push({ ...p, radius, side, life: 0.6, max: 0.6 });
}
function spawn(g, kind, p, side) {
    const c = CARDS[kind];
    g.units.push({
        ...p,
        id: ++g.serial,
        kind,
        side,
        hp: c.hp,
        maxHp: c.hp,
        life: c.life,
        fire: 0.1,
        angle: side === 1 ? -Math.PI / 2 : Math.PI / 2,
    });
}
export function canPlace(g, index, x, y, side = 1) {
    if (g.status !== 'playing')
        return 'プレイを開始・再開してください';
    if (!Number.isInteger(index) || index < 0 || index >= 4)
        return 'カードを選んでください';
    if (!Number.isFinite(x) ||
        !Number.isFinite(y) ||
        x < 0.1 ||
        y < 0.1 ||
        x > W - 0.1 ||
        y > H - 0.1)
        return '盤面の中を選んでください';
    const hand = side === 1 ? g.hand : g.enemyHand, kind = hand[index];
    if ((side === 1 ? g.lock : g.enemyLock) > 0)
        return '次の配置まで少し待ってください';
    if ((side === 1 ? g.energy : g.enemyEnergy) < CARDS[kind].cost)
        return '補給が足りません';
    if (kind !== 'kai' && owner(g, x, y) !== side)
        return '自分の色の床に配置してください';
    if (CARDS[kind].hp && g.units.some((u) => dist(u, { x, y }) < 1))
        return 'ユニットから少し離して配置してください';
    if (CARDS[kind].hp && g.units.filter((u) => u.side === side).length > 23)
        return 'ユニット上限です。一撃カードで支援してください';
    return null;
}
export function defense(g, side) {
    return side === 1
        ? g.brew === 'sokujo'
            ? 0.1
            : g.cultureReady
                ? 0.35
                : 0
        : 0.1;
}
function damage(g, u, amount) {
    u.hp -= amount * (1 - defense(g, u.side));
}
function cycle(hand, queue, index) {
    const used = hand[index];
    hand[index] = queue.shift();
    queue.push(used);
}
function shot(g, u, side, angle, speed = 8, damage = 20, radius = 0.62, life = 4, bounces = 2) {
    if (g.shots.length >= 190)
        return;
    g.shots.push({
        ...u,
        id: ++g.serial,
        side,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        damage,
        radius,
        life,
        bounces,
    });
}
export function deploy(g, index, x, y, side = 1) {
    const error = canPlace(g, index, x, y, side);
    if (error) {
        if (side === 1)
            notify(g, error);
        return false;
    }
    const p = { x, y }, hand = side === 1 ? g.hand : g.enemyHand, queue = side === 1 ? g.queue : g.enemyQueue, kind = hand[index], cost = CARDS[kind].cost;
    if (side === 1) {
        g.energy -= cost;
        g.lock = 0.28;
        g.played++;
        if (!g.used.includes(kind))
            g.used.push(kind);
        g.spend += cost;
        if (g.brew === 'kimoto')
            g.culture = Math.min(100, g.culture + 2);
        notify(g, `${CARDS[kind].name}を配置`);
    }
    else {
        g.enemyEnergy -= cost;
        g.enemyLock = 0.28;
        g.lastEnemy = `${CARDS[kind].name}を展開`;
    }
    cycle(hand, queue, index);
    paint(g, p, 0.95, side);
    effect(g, p, 1, side);
    if (kind === 'kai') {
        paint(g, p, AREAS.kaiPaint, side);
        effect(g, p, AREAS.kaiPaint, side);
        for (const u of g.units)
            if (u.side !== side && dist(u, p) < AREAS.kaiDamage)
                damage(g, u, 85);
    }
    else if (kind === 'awa') {
        const dir = side === 1 ? -1 : 1;
        for (let i = 0; i < 7; i++)
            shot(g, { x: clamp(x + (i - 3) * 0.42, 0.2, W - 0.2), y }, side, (dir * Math.PI) / 2, 14, 45, 0.75, 1.4, 0);
    }
    else if (kind === 'yeast')
        for (let i = 0; i < 3; i++)
            spawn(g, kind, {
                x: clamp(x + (i - 1) * 0.7, 0.5, W - 0.5),
                y: y + Math.abs(i - 1) * 0.35,
            }, side);
    else
        spawn(g, kind, p, side);
    return true;
}
function runAI(g) {
    const level = LEVELS[g.difficulty];
    const available = g.enemyHand
        .map((kind, index) => ({ kind, index, cost: CARDS[kind].cost }))
        .filter((c) => c.cost <= g.enemyEnergy);
    if (!available.length)
        return;
    let card = available[Math.floor(random(g) * available.length)];
    if (g.difficulty === 'expert') {
        const attacking = g.units.filter((u) => u.side === 1 && u.y < H * 0.58);
        if (attacking.length >= 2)
            card =
                available.find((c) => c.kind === 'kai') ??
                    available.find((c) => c.kind === 'sugidama') ??
                    card;
        else if (share(g) > 60)
            card =
                available.find((c) => c.kind === 'yeast' || c.kind === 'awa') ?? card;
        else if (g.units.filter((u) => u.side === 2 && u.kind === 'tokkuri').length < 2)
            card = available.find((c) => c.kind === 'tokkuri') ?? card;
    }
    let best = null, bestScore = -Infinity;
    for (let i = 0; i < 32; i++) {
        const x = 1 + random(g) * (W - 2), y = 1 + random(g) * (H - 2), p = { x, y };
        if (canPlace(g, card.index, x, y, 2))
            continue;
        let score = random(g) * 4 * (1 - level.thinking);
        if (card.kind === 'kai')
            score +=
                g.units.filter((u) => u.side === 1 && dist(u, p) < 3).length * 7 +
                    (owner(g, x, y) === 1 ? 5 : 0);
        else {
            score += y * 0.6 * level.thinking;
            const enemyNear = g.units.filter((u) => u.side === 1 && dist(u, p) < 5).length;
            if (card.kind === 'sugidama')
                score +=
                    enemyNear * 4 +
                        g.units.filter((u) => u.side === 2 && dist(u, p) < 3.5).length * 3;
            else if (card.kind === 'tokkuri')
                score -= enemyNear * 3;
            else
                score += enemyNear;
        }
        if (score > bestScore) {
            best = p;
            bestScore = score;
        }
    }
    if (best)
        deploy(g, card.index, best.x, best.y, 2);
}
function nearest(g, u) {
    let target, min = Infinity;
    for (const v of g.units)
        if (v.side !== u.side && v.hp > 0) {
            const d = dist(u, v);
            if (d < min) {
                target = v;
                min = d;
            }
        }
    return { target, d: min };
}
// Also used on a cloned match for the non-mutating initial-action preview.
export function updateUnits(g) {
    for (const u of g.units) {
        if (u.hp <= 0)
            continue;
        u.life -= DT;
        u.fire -= DT;
        const { target, d } = nearest(g, u), forward = u.side === 1 ? -1 : 1;
        if (u.kind === 'yeast' || u.kind === 'koji') {
            let dx = 0, dy = forward;
            if (target && d < 7) {
                dx = (target.x - u.x) / Math.max(0.1, d);
                dy = (target.y - u.y) / Math.max(0.1, d);
            }
            else if (u.y < 1 || u.y > H - 1) {
                let best, range = Infinity;
                for (let k = 0; k < g.tiles.length; k++)
                    if (g.tiles[k] !== u.side) {
                        const p = { x: (k % W) + 0.5, y: Math.floor(k / W) + 0.5 }, r = dist(u, p);
                        if (r < range) {
                            best = p;
                            range = r;
                        }
                    }
                if (best) {
                    dx = (best.x - u.x) / Math.max(0.1, range);
                    dy = (best.y - u.y) / Math.max(0.1, range);
                }
            }
            if (!target || d > 1.1) {
                const speed = u.kind === 'yeast' ? 1.55 : 0.65;
                u.x = clamp(u.x + dx * speed * DT, 0.4, W - 0.4);
                u.y = clamp(u.y + dy * speed * DT, 0.4, H - 0.4);
            }
            paint(g, u, u.kind === 'koji' ? 1.05 : 0.73, u.side);
        }
        if (u.fire <= 0) {
            if (u.kind === 'tokkuri') {
                const aim = target
                    ? Math.atan2(target.y - u.y, target.x - u.x)
                    : (forward * Math.PI) / 2;
                u.angle = aim + Math.sin(g.tick * 0.08 + u.id) * 0.35;
                shot(g, u, u.side, u.angle, 8, 23, 0.7, 4.5, 3);
                u.fire = 0.58;
            }
            else if (u.kind === 'koji') {
                u.angle += 0.6;
                for (let i = 0; i < 4; i++)
                    shot(g, u, u.side, u.angle + (i * Math.PI) / 2, 5.5, 15, 0.65, 2.5, 1);
                u.fire = 1.4;
            }
            else if (u.kind === 'yeast') {
                if (target && d < 4.5)
                    shot(g, u, u.side, Math.atan2(target.y - u.y, target.x - u.x), 9, 15, 0.55, 0.65, 0);
                u.fire = 0.8;
            }
            else if (u.kind === 'sugidama') {
                for (const v of g.units)
                    if (v.side === u.side && dist(v, u) < AREAS.support)
                        v.hp = Math.min(v.maxHp, v.hp + 8);
                paint(g, u, 1.3, u.side);
                u.fire = 1.3;
            }
        }
    }
}
export function finish(g) {
    const diff = g.counts[0] - g.counts[1];
    g.status = diff > 0 ? 'won' : diff < 0 ? 'lost' : 'draw';
    g.resultReason =
        g.time <= 0 ? '時間終了時の陣地で判定' : '85%以上の陣地を3秒保持';
}
export function step(g) {
    if (g.status !== 'playing')
        return;
    g.tick++;
    g.time = Math.max(0, DURATION - g.tick * DT);
    g.energy = Math.min(10, g.energy + 0.95 * DT);
    g.enemyEnergy = Math.min(10, g.enemyEnergy + LEVELS[g.difficulty].aiRegen * DT);
    g.lock = Math.max(0, g.lock - DT);
    g.enemyLock = Math.max(0, g.enemyLock - DT);
    g.messageLife = Math.max(0, g.messageLife - DT);
    g.aiClock -= DT;
    if (g.aiClock <= 0) {
        runAI(g);
        g.aiClock = LEVELS[g.difficulty].aiEvery;
    }
    if (g.brew === 'kimoto' && !g.cultureReady) {
        g.culture = Math.min(100, g.culture +
            DT *
                (0.6 +
                    Math.min(3, g.units.filter((u) => u.side === 1 && u.kind === 'sugidama' && u.hp > 0).length) *
                        1.4));
        if (g.culture >= 100) {
            g.cultureReady = true;
            notify(g, '生酛の守り、完成！ 被ダメージ35%軽減');
            effect(g, { x: W / 2, y: H * 0.75 }, 8, 1);
        }
    }
    updateUnits(g);
    for (const b of g.shots) {
        b.life -= DT;
        const travel = Math.hypot(b.vx, b.vy) * DT, parts = Math.max(1, Math.ceil(travel / 0.25));
        for (let j = 0; j < parts && b.life > 0; j++) {
            b.x += (b.vx * DT) / parts;
            b.y += (b.vy * DT) / parts;
            if (b.x < AREAS.wall || b.x > W - AREAS.wall) {
                b.x = clamp(b.x, AREAS.wall, W - AREAS.wall);
                b.vx *= -1;
                b.bounces--;
            }
            if (b.y < AREAS.wall || b.y > H - AREAS.wall) {
                b.y = clamp(b.y, AREAS.wall, H - AREAS.wall);
                b.vy *= -1;
                b.bounces--;
            }
            if (b.bounces < 0) {
                b.life = 0;
                break;
            }
            paint(g, b, b.radius, b.side);
            const hit = g.units.find((u) => u.side !== b.side &&
                u.hp > 0 &&
                dist(u, b) < (u.kind === 'sugidama' ? 0.95 : 0.6));
            if (hit) {
                damage(g, hit, b.damage);
                b.life = 0;
                effect(g, b, 0.8, b.side);
            }
        }
    }
    g.shots = g.shots.filter((b) => b.life > 0);
    const destroyed = g.units.filter((u) => u.side === 2 && u.hp <= 0).length;
    g.destroyed += destroyed;
    g.units = g.units.filter((u) => u.hp > 0 && u.life > 0);
    for (const f of g.fx)
        f.life -= DT;
    g.fx = g.fx.filter((f) => f.life > 0).slice(-50);
    const territory = share(g);
    g.peak = Math.max(g.peak, territory);
    g.hold = territory >= 85 ? g.hold + DT : 0;
    g.enemyHold = territory <= 15 ? g.enemyHold + DT : 0;
    if (g.tick - g.lastHistory >= 90) {
        g.history.push({ time: DURATION - g.time, share: territory });
        g.lastHistory = g.tick;
    }
    if (g.time <= 0 || g.hold >= 3 || g.enemyHold >= 3) {
        finish(g);
        g.history.push({ time: DURATION - g.time, share: territory });
    }
}
export function score(g) {
    return Math.round(share(g) * 100 + g.destroyed * 75 + (g.status === 'won' ? 1500 : 0));
}
export function medal(g) {
    return g.status === 'won'
        ? share(g) >= 75
            ? 'S'
            : share(g) >= 60
                ? 'A'
                : 'B'
        : g.status === 'draw'
            ? 'DRAW'
            : 'C';
}
