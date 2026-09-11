/* Focused lifecycle tests. Mocks verify loading/selection rules, not audible output. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

class Element {
  constructor() { this.listeners = {}; this.attrs = {}; this.dataset = {}; this.open = false; }
  addEventListener(type, fn) { (this.listeners[type] ||= []).push(fn); }
  emit(type, event = {}) { for (const fn of this.listeners[type] || []) fn(event); }
  setAttribute(key, value) { this.attrs[key] = value; }
  getAttribute(key) { return this.attrs[key]; }
  removeAttribute(key) { delete this.attrs[key]; if (key === 'src') this.src = ''; }
  getBoundingClientRect() { return { width: 300, height: 300, top: 100, bottom: 400, left: 0, right: 300 }; }
}

function harness({ ageOpen = true, savedSound = null } = {}) {
  const elements = new Map(['#art-zone', '#water-sound', '#water-sound-text', '#motion', '#age', '#age-yes', '#liquid']
    .map(key => [key, new Element()]));
  const get = key => elements.get(key) || null;
  get('#age').open = ageOpen;
  get('#liquid').dataset.ripples = '0';
  const win = new Element(), doc = new Element();
  doc.readyState = 'loading'; doc.hidden = false; doc.documentElement = { lang: 'ja' };
  doc.querySelector = get;
  win.innerWidth = 390; win.innerHeight = 844;
  const voices = [], plays = [], fetches = [], idle = [];
  let observer, now = 1000;
  doc.createElement = tag => {
    assert.equal(tag, 'audio');
    const voice = new Element();
    voice.pause = () => {}; voice.load = () => {};
    voice.play = () => { plays.push({ voice, src: voice.src }); return Promise.resolve(); };
    voices.push(voice);
    return voice;
  };
  const storage = new Map(savedSound ? [['sat-water-sound-enabled', savedSound]] : []);
  const schedule = fn => { idle.push(fn); return idle.length; };
  const Observer = class {
    constructor(fn) { observer = fn; }
    observe() {}
  };
  win.IntersectionObserver = Observer;
  win.requestIdleCallback = schedule;
  const context = {
    document: doc, window: win, performance: { now: () => now },
    IntersectionObserver: Observer, requestIdleCallback: schedule, setTimeout: schedule,
    fetch: src => { fetches.push(src); return Promise.resolve({ ok: true }); },
    localStorage: { getItem: key => storage.get(key), setItem: (key, value) => storage.set(key, value) },
  };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../../water-sound.js'), 'utf8'), context);
  const flush = async () => {
    await Promise.resolve();
    for (const fn of idle.splice(0)) fn();
    await Promise.resolve();
  };
  const tap = async () => {
    now += 200;
    const zone = get('#art-zone'), canvas = get('#liquid');
    zone.emit('pointerdown', { isPrimary: true, pointerId: 1, clientX: 100, clientY: 100 });
    canvas.dataset.ripples = String(Number(canvas.dataset.ripples) + 1);
    zone.emit('pointerup', { pointerId: 1, clientX: 100, clientY: 100 });
    await flush();
  };
  return { get, win, doc, voices, plays, fetches, flush, tap,
    visible: value => observer([{ isIntersecting: value }]),
    load: () => { doc.readyState = 'complete'; win.emit('load'); },
    closeAge: () => { get('#age').open = false; get('#age').emit('close'); },
    toggle: () => get('#water-sound').emit('click'),
    hidden: value => { doc.hidden = value; doc.emit('visibilitychange'); },
  };
}

(async () => {
  const h = harness();
  h.visible(true); h.load(); await h.flush();
  assert.equal(h.fetches.length, 0, 'No audio requests behind the age dialog');
  h.closeAge(); await h.flush();
  assert.equal(h.fetches.length, 2, 'Warm only the first two upcoming sounds');
  assert.equal(h.plays.length, 0, 'Warming must never play audio');
  const firstTwo = h.fetches.slice();
  await h.tap();
  assert.equal(h.plays[0].src, firstTwo[0], 'Peeking must preserve the first warmed sound');
  assert.equal(h.fetches.length, 3, 'After playing, warm only the newly upcoming sound');
  await h.tap();
  assert.equal(h.plays[1].src, firstTwo[1], 'Peeking must preserve the second warmed sound');
  for (let i = 0; i < 22; i += 1) await h.tap();
  assert.equal(h.voices.length, 2, 'Reuse only two audio voices');
  for (let i = 0; i < h.plays.length; i += 1) {
    assert.equal(h.plays[i].voice, h.voices[i % 2], 'Alternate the reusable voices');
    if (i) assert.notEqual(h.plays[i].src, h.plays[i - 1].src, 'No adjacent repeats across shuffle bags');
  }
  for (let i = 0; i < 24; i += 8) assert.equal(new Set(h.plays.slice(i, i + 8).map(play => play.src)).size, 8);
  assert.equal(h.fetches.length, 8, 'Never warm the same clip twice after a successful fetch');
  h.toggle(); const playCount = h.plays.length; await h.tap();
  assert.equal(h.plays.length, playCount, 'OFF must suppress gesture playback');

  const offscreen = harness({ ageOpen: false });
  offscreen.load(); offscreen.visible(false); await offscreen.flush();
  assert.equal(offscreen.fetches.length, 0, 'Offscreen water does not warm audio');
  offscreen.visible(true); offscreen.visible(false); await offscreen.flush();
  assert.equal(offscreen.fetches.length, 0, 'Recheck visibility when idle work runs');
  offscreen.visible(true); await offscreen.flush();
  assert.equal(offscreen.fetches.length, 2, 'Entering the viewport resumes warming');

  const background = harness({ ageOpen: false });
  background.visible(true); background.load(); background.hidden(true); await background.flush();
  assert.equal(background.fetches.length, 0, 'Recheck foreground state when idle work runs');
  background.hidden(false); await background.flush();
  assert.equal(background.fetches.length, 2, 'Foreground return resumes warming');

  const restore = harness({ ageOpen: false });
  restore.visible(true); restore.load(); restore.win.emit('pagehide'); await restore.flush();
  assert.equal(restore.fetches.length, 0, 'Pagehide suppresses pending warming');
  restore.win.emit('pageshow'); await restore.flush();
  assert.equal(restore.fetches.length, 2, 'Pageshow resumes warming');

  const off = harness({ ageOpen: false, savedSound: 'off' });
  off.visible(true); off.load(); await off.flush();
  assert.equal(off.fetches.length, 0, 'Persisted OFF must not warm');
  off.toggle(); off.toggle(); await off.flush();
  assert.equal(off.fetches.length, 0, 'Recheck OFF when idle work runs');
  off.toggle(); await off.flush();
  assert.equal(off.fetches.length, 2, 'Explicit ON resumes warming');
  assert.equal(off.plays.length, 0, 'ON does not autoplay');

  const unloaded = harness({ ageOpen: false });
  unloaded.visible(true); await unloaded.flush();
  assert.equal(unloaded.fetches.length, 0, 'Do not warm before window load');
  unloaded.load(); await unloaded.flush();
  assert.equal(unloaded.fetches.length, 2);
  console.log('water sound loading: ok (mock lifecycle and shuffle tests)');
})().catch(error => { console.error(error); process.exitCode = 1; });
