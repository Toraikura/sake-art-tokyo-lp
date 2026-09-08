/* Resize-only translucent water ribbons; the existing surface keeps its renderer. */
(() => {
  'use strict';
  const scene = document.querySelector('#source-scene');
  const svg = document.querySelector('#source-flow');
  const zone = document.querySelector('#art-zone');
  const media = matchMedia('(prefers-reduced-motion: reduce)');
  // Coordinates refer to the original supplied artwork, then its visible SVG crop.
  const sources = {
    urasato: { crop: [0, 340, 1122, 640], origin: [570, 595], direction: 1 },
    tsuchida: { crop: [0, 430, 1122, 640], origin: [469, 967], direction: -1 }
  };
  // Filled, variable-width membranes have no continuous stroked outline.
  // Each edge spreads independently as it approaches the horizontal surface.
  function ribbon(point, width, offset = () => 0) {
    const left = [], right = [];
    for (let i = 0; i <= 48; i++) {
      const t = i / 48, p = point(t);
      const before = point(Math.max(0, t - .002)), after = point(Math.min(1, t + .002));
      const dx = after.x - before.x, dy = after.y - before.y;
      const length = Math.hypot(dx, dy) || 1;
      const nx = -dy / length, ny = dx / length, shift = offset(t), radius = width(t);
      left.push(`${p.x + nx * (shift + radius)},${p.y + ny * (shift + radius)}`);
      right.push(`${p.x + nx * (shift - radius)},${p.y + ny * (shift - radius)}`);
    }
    return `M ${left.join(' L ')} L ${right.reverse().join(' L ')} Z`;
  }
  function layout() {
    const bounds = scene.getBoundingClientRect(), water = zone.getBoundingClientRect();
    if (!bounds.width || !bounds.height) return;
    svg.setAttribute('viewBox', `0 0 ${bounds.width} ${bounds.height}`);
    for (const [id, source] of Object.entries(sources)) {
      const art = scene.querySelector(`[data-source="${id}"] .source-art`).getBoundingClientRect();
      const [cx, cy, cw, ch] = source.crop;
      const scale = Math.max(art.width / cw, art.height / ch);
      const x = art.left - bounds.left + (art.width - cw * scale) / 2 + (source.origin[0] - cx) * scale;
      const y = art.top - bounds.top + (art.height - ch * scale) / 2 + (source.origin[1] - cy) * scale;
      const direction = source.direction;
      const endX = Math.max(water.width * .14, Math.min(water.width * .9,
        x + direction * Math.min(164, water.width * .27)));
      const endY = water.top - bounds.top + water.height * .4;
      const span = endY - y;
      const path = svg.querySelector(`[data-flow="${id}"]`);
      const point = t => {
        const s = 1 - t;
        return {
          x: s ** 3 * x + 3 * s * s * t * (x + direction * 14)
            + 3 * s * t * t * (endX - direction * 54) + t ** 3 * endX,
          y: s ** 3 * y + 3 * s * s * t * (y + span * .88)
            + 3 * s * t * t * (endY - 9) + t ** 3 * endY
        };
      };
      const size = Math.min(1, water.width / 440);
      const spread = t => Math.sin(Math.PI * t);
      path.setAttribute('d', ribbon(point, t => spread(t) * (.55 + 2 * t) * size));
      svg.querySelector(`[data-flow-veil="${id}"]`).setAttribute('d',
        ribbon(point, t => spread(t) * (1.2 + 10 * t) * size));
      for (const [part, sign] of [['near', 1], ['far', -1]]) {
        svg.querySelector(`[data-flow-wisp="${id}-${part}"]`).setAttribute('d', ribbon(point,
          t => spread(t) * (.25 + .65 * t) * size,
          t => sign * Math.max(0, t - .16) * spread(t)
            * (part === 'near' ? 15 : 25) * size + Math.sin(t * 9) * t * size));
      }
      path.dataset.originX = x;
      path.dataset.originY = y;
      for (const prefix of ['flow-fade', 'flow-veil', 'flow-near', 'flow-far']) {
        const fade = document.querySelector(`#${prefix}-${id}`);
        for (const [key, value] of Object.entries({ x1: x, y1: y, x2: endX, y2: endY })) fade.setAttribute(key, value);
      }
    }
  }
  function select() {
    scene.dataset.source = document.body.dataset.mood === 'deep' ? 'tsuchida' : 'urasato';
  }
  function motion() {
    scene.classList.toggle('source-still', media.matches || document.querySelector('#motion').getAttribute('aria-pressed') === 'true');
  }
  window.addEventListener('sat:mood', select);
  document.querySelector('#motion').addEventListener('click', motion);
  media.addEventListener('change', motion);
  if ('ResizeObserver' in window) new ResizeObserver(layout).observe(scene);
  else window.addEventListener('resize', layout);
  window.addEventListener('pageshow', layout);
  select(); motion(); layout();
})();
