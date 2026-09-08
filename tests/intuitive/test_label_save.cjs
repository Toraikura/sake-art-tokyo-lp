/* Native share is mocked. These checks do not claim an actual iOS Photos save. */
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { Blob, File } = require('node:buffer');
const source = fs.readFileSync(path.resolve(__dirname, '../../label-save.js'), 'utf8');
const png = n => Buffer.from([137, 80, 78, 71, 13, 10, 26, 10, n, n + 1]);
const tick = () => new Promise(resolve => setImmediate(resolve));

function setup(options = {}) {
  const elements = new Map(), observers = [], requests = [], shares = [], navigation = [];
  let duringClick = false, timerID = 0;
  const timers = new Map();
  class Element {
    constructor(tag = 'div') {
      this.tagName = tag; this.listeners = {}; this.children = []; this.attrs = {};
      this.style = { cssText: '' }; this.open = false; this.textContent = '';
      if (options.noDialog) this.showModal = undefined;
    }
    set id(value) { this._id = value; elements.set(`#${value}`, this); }
    get id() { return this._id; }
    addEventListener(name, handler) { (this.listeners[name] ||= []).push(handler); }
    emit(name, event = {}) { for (const handler of this.listeners[name] || []) handler(event); }
    setAttribute(name, value) { this.attrs[name] = value; }
    appendChild(child) { this.children.push(child); }
    showModal() { this.open = true; }
    close() { this.open = false; this.emit('close'); }
    focus(options) { this.focusOptions = options; }
  }
  const el = id => {
    if (!elements.has(id)) { const value = new Element(); value.id = id.slice(1); }
    return elements.get(id);
  };
  ['#save-label', '#labels', '#toast', '#label-image'].forEach(el);
  const body = new Element('body'); body.style.cssText = 'color: red';
  const html = new Element('html'); html.style.scrollBehavior = 'smooth';
  const win = new Element('window'); win.scrollY = 987;
  win.scrollTo = (_, y) => { win.scrollY = y; };
  class Observer {
    constructor(callback, config) { this.callback = callback; this.config = config; observers.push(this); }
    observe(node) { this.node = node; }
    disconnect() { this.disconnected = true; }
  }
  win.IntersectionObserver = Observer;
  const nav = {
    userAgent: options.desktop ? 'Macintosh' : 'iPhone',
    platform: options.ipad || options.desktop ? 'MacIntel' : 'iPhone',
    maxTouchPoints: options.ipad ? 5 : options.desktop ? 0 : 1,
    canShare: data => { assert.equal(data.files.length, 1); return options.canShare !== false; },
    share: data => {
      assert.equal(duringClick, true, 'share must run synchronously inside the click handler');
      shares.push(data);
      if (options.syncError) throw Object.assign(new Error('share failed'), { name: options.syncError });
      return options.share ? options.share(data) : Promise.resolve();
    }
  };
  if (options.ipad) nav.userAgent = 'Macintosh';
  if (options.unsupported) { delete nav.share; delete nav.canShare; }
  const location = { href: 'https://sakearttokyo.com/', origin: 'https://sakearttokyo.com',
    assign: url => navigation.push(url) };
  function select(n) {
    el('#save-label').href = `https://sakearttokyo.com/assets/sat-00${n}-label.png`;
    el('#save-label').download = `SAT_00${n}.png`;
    el('#label-image').alt = `Label ${n}`;
    win.emit('sat:label', { detail: { id: `sat-00${n}` } });
  }
  select(1);
  const context = {
    window: win, navigator: nav, location, URL, File, Uint8Array, AbortController,
    document: { body, documentElement: html, querySelector: id => elements.get(id) || null,
      createElement: tag => new Element(tag) },
    IntersectionObserver: Observer,
    setTimeout: fn => { timers.set(++timerID, fn); return timerID; },
    clearTimeout: id => timers.delete(id),
    fetch: (url, init) => {
      const item = { url, init }; requests.push(item);
      return options.fetch ? options.fetch(item) : Promise.resolve({ ok: true,
        blob: () => Promise.resolve(new Blob([png(Number(url.match(/sat-00(\d)/)[1]))], { type: 'image/png' })) });
    }
  };
  vm.runInNewContext(source, context);
  return { el, win, body, html, observers, requests, shares, navigation, timers, select,
    near: () => observers[0]?.callback([{ isIntersecting: true }]),
    tap: () => {
      const event = { defaultPrevented: false, preventDefault() { this.defaultPrevented = true; } };
      duringClick = true;
      try { el('#save-label').emit('click', event); } finally { duringClick = false; }
      return event;
    }
  };
}

(async () => {
  const desktop = setup({ desktop: true });
  assert.equal(desktop.tap().defaultPrevented, false);
  assert.equal(desktop.requests.length, 0);
  assert.equal(desktop.shares.length, 0);
  assert.equal(desktop.el('#save-label').download, 'SAT_001.png');

  const ios = setup();
  assert.equal(ios.requests.length, 0, 'Do not fetch PNGs while the section is distant');
  ios.near(); await tick();
  assert.equal(ios.requests.length, 1);
  assert.equal(ios.tap().defaultPrevented, true);
  assert.equal(ios.shares.length, 1);
  assert.equal(ios.shares[0].files[0].name, 'SAT_001.png');
  assert.equal(ios.shares[0].files[0].type, 'image/png');
  assert.deepEqual(Buffer.from(await ios.shares[0].files[0].arrayBuffer()), png(1));
  await tick();
  assert.equal(ios.el('#toast').textContent, '', 'Resolving a share does not prove Photos saved it');
  ios.select(2); await tick(); ios.tap();
  assert.equal(ios.shares.at(-1).files[0].name, 'SAT_002.png');
  assert.deepEqual(Buffer.from(await ios.shares.at(-1).files[0].arrayBuffer()), png(2));
  await tick(); ios.select(1); ios.tap();
  assert.equal(ios.requests.length, 2, 'Both originals are cached without refetching');

  const ipad = setup({ ipad: true }); ipad.near(); await tick(); ipad.tap();
  assert.equal(ipad.shares.length, 1, 'Desktop-UA iPad uses photo sharing');

  const deferred = [];
  const slow = setup({ fetch: item => new Promise(resolve => deferred.push({ item, resolve })) });
  slow.near(); assert.equal(slow.tap().defaultPrevented, true);
  assert.equal(slow.shares.length, 0, 'Never share asynchronously after a tap that started loading');
  assert.match(slow.el('#toast').textContent, /準備/);
  slow.select(2);
  deferred[0].resolve({ ok: true, blob: async () => new Blob([png(1)]) }); await tick();
  slow.tap(); assert.equal(slow.shares.length, 0, 'An old selection becoming ready cannot share the wrong image');
  deferred[1].resolve({ ok: true, blob: async () => new Blob([png(2)]) }); await tick();
  assert.equal(slow.shares.length, 0);
  slow.tap(); assert.equal(slow.shares[0].files[0].name, 'SAT_002.png');

  for (const failure of ['AbortError', 'NotAllowedError']) {
    const app = setup({ share: () => Promise.reject(Object.assign(new Error(failure), { name: failure })) });
    app.near(); await tick(); app.tap(); await tick();
    const open = app.el('#label-save-dialog').open;
    assert.equal(open, failure !== 'AbortError', 'Cancel is silent; other sharing errors display the original');
    assert.equal(app.navigation.length, 0, 'No automatic download/navigation after share failure');
    if (open) {
      assert.match(app.el('#label-save-image').src, /sat-001-label\.png$/);
      assert.match(app.el('#label-save-help').textContent, /長押し/);
      app.el('#label-save-dialog').close();
      assert.equal(app.body.style.cssText, 'color: red');
      assert.equal(app.win.scrollY, 987);
      assert.equal(app.el('#save-label').focusOptions.preventScroll, true);
      assert.equal(app.html.style.scrollBehavior, 'smooth');
    }
  }
  const unsupported = setup({ unsupported: true }); unsupported.select(2); unsupported.tap();
  assert.equal(unsupported.requests.length, 0);
  assert.equal(unsupported.el('#label-save-dialog').open, true);
  assert.match(unsupported.el('#label-save-image').src, /sat-002-label\.png$/);
  const rejectedFile = setup({ canShare: false }); rejectedFile.near(); await tick(); rejectedFile.tap();
  assert.equal(rejectedFile.shares.length, 0);
  assert.equal(rejectedFile.el('#label-save-dialog').open, true);
  const synchronous = setup({ syncError: 'NotAllowedError' }); synchronous.near(); await tick(); synchronous.tap();
  assert.equal(synchronous.el('#label-save-dialog').open, true);
  const networkFailure = setup({ fetch: async () => { throw new Error('offline'); } });
  networkFailure.near(); networkFailure.tap(); await tick();
  assert.equal(networkFailure.shares.length, 0);
  assert.equal(networkFailure.el('#label-save-dialog').open, true, 'A requested image load failure shows the original for retry');
  networkFailure.win.emit('pagehide');
  assert.equal(networkFailure.el('#label-save-dialog').open, false);
  assert.equal(networkFailure.body.style.cssText, 'color: red', 'History snapshots cannot retain the fixed body');
  const badPNG = setup({ fetch: async () => ({ ok: true, blob: async () => new Blob(['not a PNG']) }) });
  badPNG.near(); await tick(); badPNG.tap();
  assert.equal(badPNG.shares.length, 0);
  assert.equal(badPNG.el('#label-save-dialog').open, true);
  const raw = setup({ unsupported: true, noDialog: true }); raw.tap();
  assert.deepEqual(raw.navigation, ['https://sakearttokyo.com/assets/sat-001-label.png']);
  const bounded = setup(); bounded.near(); await tick();
  bounded.select(2); await tick(); bounded.select(3); await tick(); bounded.select(1); await tick();
  assert.equal(bounded.requests.length, 4, 'The original-file cache keeps at most two entries');
  bounded.win.emit('pagehide'); bounded.win.emit('pageshow'); await tick();
  assert.equal(bounded.requests.length, 5, 'History restore prepares a fresh file after cleanup');
  console.log('PASS: iOS/iPad original-PNG sharing, synchronous activation, selection races, cancellation, fallbacks, restore and desktop download. Native iOS Photos UI remains NOT TESTED.');
})().catch(error => { console.error(error); process.exitCode = 1; });
