/* Protocol/lifecycle unit tests for the unmodified production controller.
 * DOM and transport are mocks. This does NOT replace real iframe HTTP E2E tests.
 */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const crypto = require('node:crypto');
class Element {
  constructor() {
    this.listeners = {}; this.dataset = {}; this.attrs = {}; this.style = { cssText: '' };
    this.hidden = false; this.open = false; this.children = [];
    const classes = new Set();
    this.classList = {add: value => classes.add(value), remove: value => classes.delete(value)};
  }
  addEventListener(name, handler) { (this.listeners[name] ||= []).push(handler); }
  emit(name, payload = {}) { for (const handler of this.listeners[name] || []) handler(payload); }
  setAttribute(name, value) { this.attrs[name] = value; }
  querySelector() { return this.image ||= new Element(); }
  appendChild(child) { this.children.push(child); }
  remove() { this.removed = true; }
  showModal() { this.open = true; }
  close() { this.open = false; }
  focus(options) { this.focused = true; this.focusOptions = options; }
}
const app = path.resolve(__dirname, '../..');
const elements = new Map();
const el = selector => {
  if (!elements.has(selector)) elements.set(selector, new Element());
  return elements.get(selector);
};
const releases = [1, 2].map(n => ({id: `sat-00${n}`, name: `Sake ${n}`, brewery: 'Test',
  image: `./assets/sat-00${n}-label.webp`, download: `./assets/sat-00${n}-label.png`, detail: `./#sat-00${n}`}));
el('#label-releases').textContent = JSON.stringify(releases);
const body = new Element(); body.dataset.mood = 'deep'; body.style.cssText = 'color: black';
const doc = {body, documentElement: new Element(), querySelector: el,
  querySelectorAll: () => [el('#launcher')], createElement: () => {
    const frame = new Element(); frame.contentWindow = {}; return frame;
  }};
const win = new Element(); win.scrollY = 420;
win.scrollTo = (_, y) => { win.scrollY = y; };
win.dispatchEvent = event => { win.emit(event.type, event); };
const navigation = [];
const location = {origin: 'https://sakearttokyo.com',
  href: 'https://sakearttokyo.com/',
  assign: href => navigation.push(href)};
const context = {document: doc, window: win, location, URL, crypto, performance,
  setTimeout, clearTimeout, requestAnimationFrame: fn => fn(),
  matchMedia: () => ({matches: false}),
  CustomEvent: class {constructor(type, options) {this.type = type; this.detail = options.detail;}}};
vm.runInNewContext(fs.readFileSync(path.join(app, 'intuitive.js'), 'utf8'), context);
const launch = () => {
  el('#launcher').emit('click');
  const frame = el('#play-frame-slot').children.at(-1);
  return {frame, session: new URL(frame.src).searchParams.get('session')};
};
const deliver = (active, type, extra = {}, override = {}) => win.emit('message', {
  origin: location.origin, source: active.frame.contentWindow,
  data: {channel: 'sat-quick-v1', session: active.session, type, ...extra}, ...override
});
let active = launch();
assert.equal(el('#play-modal').open, true);
assert.equal(new URL(active.frame.src).origin, location.origin);
assert.equal(new URL(active.frame.src).pathname, '/play/');
assert.equal(new URL(active.frame.src).searchParams.get('bottle'), 'sat-002');
assert.equal(el('#play-loading').hidden, false);
deliver(active, 'ready', {}, {origin: 'https://untrusted.example'});
assert.equal(el('#play-loading').hidden, false);
deliver(active, 'ready', {}, {source: {}});
assert.equal(el('#play-loading').hidden, false);
deliver(active, 'ready', {session: 'stale'});
assert.equal(el('#play-loading').hidden, false);
deliver(active, 'ready');
assert.equal(el('#play-loading').hidden, true);
deliver(active, 'explore');
assert.equal(navigation.length, 0);
deliver(active, 'finished', {outcome: 'won', share: 62, played: 2});
assert.equal(el('#play-modal').dataset.outcome, 'won');
deliver(active, 'ready');
assert.equal(el('#play-modal').dataset.outcome, undefined, 'Replay must reset outcome');
deliver(active, 'explore');
assert.equal(navigation.length, 0, 'Replay cannot use a prior result');
deliver(active, 'finished', {outcome: 'won', share: 200, played: 2});
assert.equal(el('#play-modal').dataset.outcome, undefined);
deliver(active, 'finished', {outcome: 'lost', share: 32, played: 3});
deliver(active, 'explore');
assert.equal(navigation.at(-1), 'https://sakearttokyo.com/#sat-002');
assert.equal(el('#play-modal').open, false);
assert.equal(active.frame.removed, true);
assert.equal(body.style.cssText, 'color: black');
assert.equal(win.scrollY, 420);
assert.equal(el('#launcher').focusOptions.preventScroll, true);
active = launch();
active.frame.emit('error');
assert.equal(el('#retry-play').hidden, false);
el('#retry-play').emit('click');
assert.equal(active.frame.removed, true);
const replacement = el('#play-frame-slot').children.at(-1);
assert.notEqual(replacement, active.frame);
assert.notEqual(new URL(replacement.src).searchParams.get('session'), active.session);
win.emit('pagehide');
assert.equal(el('#play-modal').open, false);
assert.equal(replacement.removed, true);
console.log('PASS: origin/window/session guards, start/result gate, replay reset, validated deep link, retry isolation, pagehide cleanup, scroll/focus restoration (mock DOM/transport unit test).');
