/* Progressive water-drop audio for the home-page water surface.
   Two reusable voices, a shuffle bag, no autoplay, no telemetry and no dependency.
   Audio is warmed only after window load / idle; a direct user gesture always remains the playback trigger. */
(function () {
  'use strict';

  const zone = document.querySelector('#art-zone');
  const toggle = document.querySelector('#water-sound');
  const toggleText = document.querySelector('#water-sound-text');
  const motion = document.querySelector('#motion');
  if (!zone || !toggle || !toggleText) return;

  const english = document.documentElement.lang === 'en';
  const STORAGE_KEY = 'sat-water-sound-enabled';
  const THROTTLE_MS = 125;
  const AUDIO_ROOT = '/assets/audio/water/';
  const tracks = [
    { file: 'water-drop-pochan.mp3', volume: 0.20 },
    { file: 'water-drop-01.mp3', volume: 0.40 },
    { file: 'water-drop-03.mp3', volume: 0.32 },
    { file: 'water-drop-05.mp3', volume: 0.40 },
    { file: 'water-drop-mid-reverb.mp3', volume: 0.30 },
    { file: 'water-drop-low-reverb.mp3', volume: 0.27 },
    { file: 'water-drop-high-reverb.mp3', volume: 0.33 },
    { file: 'water-drop-short.mp3', volume: 0.28 }
  ].map(track => ({ ...track, src: `${AUDIO_ROOT}${track.file}` }));

  let enabled = true;
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === 'off') enabled = false;
    else if (saved === 'on') enabled = true;
  } catch (_) {}

  let bag = [];
  let lastTrack = -1;
  let lastPlayedAt = -Infinity;
  let voiceCursor = 0;
  let gesture = null;
  let active = true;

  const voices = Array.from({ length: 2 }, () => {
    const audio = document.createElement('audio');
    audio.preload = 'none';
    audio.setAttribute('aria-hidden', 'true');
    return audio;
  });

  function renderToggle() {
    toggle.setAttribute('aria-pressed', String(enabled));
    toggleText.textContent = enabled ? 'SOUND ON' : 'SOUND OFF';
    toggle.setAttribute('aria-label', english
      ? (enabled ? 'Turn water-drop sound off' : 'Turn water-drop sound on')
      : (enabled ? '水滴音をオフにする' : '水滴音をオンにする'));
  }

  function shuffledIndexes() {
    const next = tracks.map((_, index) => index);
    for (let i = next.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [next[i], next[j]] = [next[j], next[i]];
    }
    if (next.length > 1 && next[0] === lastTrack) {
      [next[0], next[1]] = [next[1], next[0]];
    }
    return next;
  }

  function takeTrack() {
    if (!bag.length) bag = shuffledIndexes();
    const index = bag.shift();
    lastTrack = index;
    return tracks[index];
  }

  function rippleCount() {
    const canvas = document.querySelector('#liquid');
    return Number(canvas?.dataset.ripples || 0);
  }

  function motionAllowsRipple() {
    return !motion || motion.getAttribute('aria-pressed') !== 'true';
  }

  function playDrop() {
    const now = performance.now();
    if (!active || !enabled || !motionAllowsRipple() || now - lastPlayedAt < THROTTLE_MS) return;
    lastPlayedAt = now;

    const track = takeTrack();
    const voice = voices[voiceCursor];
    voiceCursor = (voiceCursor + 1) % voices.length;

    try {
      voice.pause();
      voice.src = track.src;
      voice.volume = track.volume;
      voice.currentTime = 0;
      const result = voice.play();
      if (result && typeof result.catch === 'function') result.catch(() => {});
    } catch (_) {
      /* Sound is progressive enhancement. Ripple behavior must never fail with it. */
    }
  }

  function maybePlayAfterRipple(before) {
    if (rippleCount() > before) playDrop();
  }

  zone.addEventListener('pointerdown', event => {
    if (event.isPrimary === false) return;
    gesture = {
      id: event.pointerId,
      x: event.clientX,
      y: event.clientY,
      moved: false,
      ripples: rippleCount()
    };
  }, { passive: true });

  zone.addEventListener('pointermove', event => {
    if (!gesture || gesture.id !== event.pointerId) return;
    if (Math.hypot(event.clientX - gesture.x, event.clientY - gesture.y) > 12) gesture.moved = true;
  }, { passive: true });

  zone.addEventListener('pointerup', event => {
    if (!gesture || gesture.id !== event.pointerId) return;
    const current = gesture;
    gesture = null;
    if (!current.moved && Math.hypot(event.clientX - current.x, event.clientY - current.y) < 12) {
      maybePlayAfterRipple(current.ripples);
    }
  }, { passive: true });

  zone.addEventListener('pointercancel', () => { gesture = null; }, { passive: true });
  zone.addEventListener('pointerleave', event => {
    if (gesture && gesture.id === event.pointerId) gesture = null;
  }, { passive: true });

  zone.addEventListener('keydown', event => {
    if ((event.key === ' ' || event.key === 'Enter') && !event.repeat) {
      /* site.js is registered first and increments data-ripples in the same key event. */
      const before = Number(zone.dataset.soundRippleCount || rippleCount());
      maybePlayAfterRipple(before);
      zone.dataset.soundRippleCount = String(rippleCount());
    }
  });

  toggle.addEventListener('click', () => {
    enabled = !enabled;
    try { localStorage.setItem(STORAGE_KEY, enabled ? 'on' : 'off'); } catch (_) {}
    if (!enabled) voices.forEach(voice => {
      try { voice.pause(); voice.currentTime = 0; } catch (_) {}
    });
    renderToggle();
  });

  function warmAudio() {
    tracks.forEach(track => {
      fetch(track.src, { cache: 'force-cache', credentials: 'same-origin' }).catch(() => {});
    });
  }

  window.addEventListener('load', () => {
    const warm = () => { if (active) warmAudio(); };
    if ('requestIdleCallback' in window) requestIdleCallback(warm, { timeout: 2500 });
    else setTimeout(warm, 1200);
  }, { once: true });

  window.addEventListener('pagehide', () => {
    active = false;
    gesture = null;
    voices.forEach(voice => {
      try { voice.pause(); voice.removeAttribute('src'); voice.load(); } catch (_) {}
    });
  });
  window.addEventListener('pageshow', () => { active = true; });

  renderToggle();
})();
