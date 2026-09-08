/* Resize-only SVG geometry: no animation loop, particles, glow, or extra ripples. */
(() => {
  'use strict';
  const scene = document.querySelector('#source-scene');
  const svg = document.querySelector('#source-flow');
  const zone = document.querySelector('#art-zone');
  const media = matchMedia('(prefers-reduced-motion: reduce)');
  // Coordinates refer to the original supplied artwork, then its visible SVG crop.
  const sources = {
    urasato: { crop: [0, 410, 1122, 640], origin: [570, 595], landing: .53 },
    tsuchida: { crop: [150, 720, 820, 470], origin: [469, 967], landing: .7 }
  };
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
      const endX = water.left - bounds.left + water.width * source.landing;
      const endY = water.top - bounds.top + water.height * .39;
      const span = endY - y;
      const path = svg.querySelector(`[data-flow="${id}"]`);
      // Drift sideways from the pictured origin; never a vertical stream from the card edge.
      path.setAttribute('d', `M ${x} ${y} C ${x + 12} ${y + span * .3}, ${endX - 32} ${endY - span * .18}, ${endX} ${endY}`);
      path.dataset.originX = x;
      path.dataset.originY = y;
      const fade = document.querySelector(`#flow-fade-${id}`);
      for (const [key, value] of Object.entries({ x1: x, y1: y, x2: endX, y2: endY })) fade.setAttribute(key, value);
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
