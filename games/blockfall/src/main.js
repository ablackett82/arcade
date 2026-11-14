// Page glue: canvas sizing, keyboard, touch pad, game controller, 60 Hz loop.
import { Blockfall, BUTTONS } from './game.js';
import { Sound } from './audio.js';

const $ = (s) => document.querySelector(s);
const KEYS = {
  ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right',
  z: 'a', x: 'b', Enter: 'start', ' ': 'start', Shift: 'select', Backspace: 'select',
};

const sound = new Sound();
const game = new Blockfall({ sfx: (n) => sound.sfx(n), music: (n) => sound.music(n) });
const screenEl = $('#screen');
screenEl.appendChild(game.canvas);

// whole-number pixel scale keeps the tiles sharp
function fit() {
  const w = screenEl.clientWidth, h = screenEl.clientHeight;
  const dpr = window.devicePixelRatio || 1;
  let s = Math.min(w / 160, h / 144);
  const dev = Math.floor(s * dpr);
  if (dev >= 1) s = dev / dpr;
  game.canvas.style.width = `${Math.floor(160 * s)}px`;
  game.canvas.style.height = `${Math.floor(144 * s)}px`;
}
new ResizeObserver(fit).observe(screenEl);

if (navigator.maxTouchPoints > 0 && matchMedia('(pointer: coarse)').matches) document.body.classList.add('touch');

// input: keyboard, touch and controller are merged into one set of held buttons
const held = Object.fromEntries(BUTTONS.map((b) => [b, false]));
const src = { key: {}, touch: {}, pad: {} };
const recompute = () => { for (const b of BUTTONS) held[b] = !!(src.key[b] || src.touch[b] || src.pad[b]); };
const keyButton = (e) => KEYS[e.key.length === 1 ? e.key.toLowerCase() : e.key];

addEventListener('keydown', (e) => {
  const b = keyButton(e);
  if (!b) return;
  e.preventDefault();
  sound.ensure();
  src.key[b] = true; recompute();
});
addEventListener('keyup', (e) => {
  const b = keyButton(e);
  if (b) { src.key[b] = false; recompute(); }
});
addEventListener('blur', () => { src.key = {}; src.touch = {}; recompute(); });

// each finger follows the button under it, so you can slide between buttons
const pad = $('#pad');
const fingers = new Map();
function touchUpdate() {
  src.touch = {};
  for (const b of fingers.values()) if (b) src.touch[b] = true;
  pad.querySelectorAll('.k').forEach((k) => k.classList.toggle('down-on', !!src.touch[k.dataset.b]));
  recompute();
}
const under = (x, y) => document.elementFromPoint(x, y)?.closest?.('[data-b]')?.dataset.b ?? null;
pad.addEventListener('pointerdown', (e) => {
  e.preventDefault();
  sound.ensure();
  pad.setPointerCapture?.(e.pointerId);
  fingers.set(e.pointerId, under(e.clientX, e.clientY));
  touchUpdate();
});
pad.addEventListener('pointermove', (e) => {
  if (!fingers.has(e.pointerId)) return;
  const b = under(e.clientX, e.clientY);
  if (b !== fingers.get(e.pointerId)) { fingers.set(e.pointerId, b); touchUpdate(); }
});
const lift = (e) => { fingers.delete(e.pointerId); touchUpdate(); };
pad.addEventListener('pointerup', lift);
pad.addEventListener('pointercancel', lift);
pad.addEventListener('contextmenu', (e) => e.preventDefault());

// tapping the screen counts as START on the title, menu and game-over screens
screenEl.addEventListener('pointerdown', () => {
  sound.ensure();
  if (game.screen === 'play') return;
  src.touch.start = true; recompute();
  setTimeout(() => { src.touch.start = false; recompute(); }, 80);
});

function pollPad() {
  const on = {};
  for (const p of navigator.getGamepads?.() ?? []) {
    if (!p) continue;
    const btn = (i) => p.buttons[i]?.pressed;
    const ax = p.axes || [];
    if (btn(12) || ax[1] < -0.6) on.up = true;
    if (btn(13) || ax[1] > 0.6) on.down = true;
    if (btn(14) || ax[0] < -0.6) on.left = true;
    if (btn(15) || ax[0] > 0.6) on.right = true;
    if (btn(0)) on.a = true;
    if (btn(1) || btn(2)) on.b = true;
    if (btn(9)) on.start = true;
    if (btn(8)) on.select = true;
  }
  src.pad = on;
  recompute();
}

// fixed 60 steps a second whatever the screen's refresh rate
const STEP = 1000 / 60;
let last = 0, acc = 0;
function frame(now) {
  requestAnimationFrame(frame);
  pollPad();
  acc += Math.min(250, now - (last || now));
  last = now;
  let n = 0;
  while (acc >= STEP && n < 5) { game.step(held); acc -= STEP; n++; }
  if (n) game.render();
}
requestAnimationFrame(frame);

// pause when you leave, and keep the tune quiet while away
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    if (game.screen === 'play' && !game.paused) game.paused = true;
    sound.music(null);
  } else if (game.screen === 'menu' || (game.screen === 'play' && !game.paused)) {
    game.hooks.music(game.menu.music ? `tune${game.menu.music}` : null);
  }
});
game.render();
fit();
