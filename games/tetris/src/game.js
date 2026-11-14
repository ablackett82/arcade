// Tetris: a falling-block puzzle game drawn on a 160x144 pixel screen.
import DATA from './data.js';

export const W = 160;
export const H = 144;
const COLS = 10;
const ROWS = 18;
const FX = 16; // playfield x in pixels
const KINDS = ['I', 'O', 'T', 'S', 'Z', 'J', 'L'];
const GRAVITY = [53, 49, 45, 41, 37, 33, 28, 22, 17, 11, 10, 9, 8, 7, 6, 6, 5, 5, 4, 4, 3];
const LINE_SCORE = [0, 40, 100, 300, 1200];
const DAS_FIRST = 16;
const DAS_NEXT = 6;

export const BUTTONS = ['up', 'down', 'left', 'right', 'a', 'b', 'start', 'select'];

function hexToRgb(h) {
  return [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
}

function rotateCells(kind, cells, r) {
  let pts = cells.map((c) => [c[0], c[1]]);
  if (kind === 'O') return pts;
  for (let i = 0; i < ((r % 4) + 4) % 4; i++) {
    pts = kind === 'I' ? pts.map(([x, y]) => [3 - y, x]) : pts.map(([x, y]) => [2 - y, x]);
  }
  return pts;
}

const SHAPES = {};
for (const k of KINDS) SHAPES[k] = [0, 1, 2, 3].map((r) => rotateCells(k, DATA.pieces[k], r));

export class Tetris {
  constructor(hooks = {}) {
    this.hooks = hooks; // { sfx(name), music(name|null), onScore(score) }
    this.canvas = document.createElement('canvas');
    this.canvas.width = W;
    this.canvas.height = H;
    this.ctx = this.canvas.getContext('2d');
    this.img = this.ctx.createImageData(W, H);
    this.paletteName = 'olive';
    this.options = { ghost: false, hardDrop: true };
    this.cheats = { slow: false, bars: false, noGarbage: false };
    this.held = {};
    this.prev = {};
    this.rep = { left: 0, right: 0, down: 0 };
    this.setPalette('olive');
    this.highScores = this.loadHigh();
    this.toTitle();
  }

  // ------------------------------------------------------------ setup
  setPalette(name) {
    if (!DATA.palettes[name]) name = 'olive';
    this.paletteName = name;
    this.pal = DATA.palettes[name].map(hexToRgb);
    this.tileCache = {};
  }

  loadHigh() {
    try {
      return JSON.parse(localStorage.getItem('tetris.highscores')) || { A: [], B: [] };
    } catch {
      return { A: [], B: [] };
    }
  }

  saveHigh() {
    try {
      localStorage.setItem('tetris.highscores', JSON.stringify(this.highScores));
      localStorage.setItem('tetris.highscore', String(Math.max(0, ...Object.values(this.highScores).flat()))); // shown on the arcade's front screen
    } catch {}
  }

  toTitle() {
    this.screen = 'title';
    this.t = 0;
    this.menu = this.menu || { cursor: 0, type: 'A', level: 0, height: 0, music: 1 };
    this.hooks.music?.(null);
  }

  toMenu() {
    this.screen = 'menu';
    this.t = 0;
    this.hooks.music?.(this.menu.music ? `tune${this.menu.music}` : null);
  }

  newBag() {
    const bag = KINDS.slice();
    for (let i = bag.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [bag[i], bag[j]] = [bag[j], bag[i]];
    }
    return bag;
  }

  nextKind() {
    if (this.cheats.bars) return 'I';
    if (!this.bag || !this.bag.length) this.bag = this.newBag();
    return this.bag.pop();
  }

  startGame() {
    const m = this.menu;
    this.type = m.type;
    this.startLevel = m.level;
    this.level = m.level;
    this.lines = 0;
    this.score = 0;
    this.goal = m.type === 'B' ? 25 : 0;
    this.board = Array.from({ length: ROWS }, () => Array(COLS).fill(null));
    if (m.type === 'B' && m.height > 0 && !this.cheats.noGarbage) {
      const rows = m.height * 2;
      for (let r = ROWS - rows; r < ROWS; r++) {
        for (let c = 0; c < COLS; c++) if (Math.random() < 0.55) this.board[r][c] = 'G';
        const hole = Math.floor(Math.random() * COLS);
        this.board[r][hole] = null;
      }
    }
    this.bag = null;
    this.next = this.nextKind();
    this.spawn();
    this.screen = 'play';
    this.paused = false;
    this.clearing = null;
    this.t = 0;
    this.hooks.music?.(m.music ? `tune${m.music}` : null);
  }

  spawn() {
    this.piece = { kind: this.next, r: 0, x: 3, y: -1 };
    this.next = this.nextKind();
    this.fall = 0;
    this.softRows = 0;
    this.lockFlash = 0;
    if (this.collides(this.piece.kind, this.piece.r, this.piece.x, this.piece.y)) {
      this.gameOver();
    }
  }

  gravity() {
    const g = GRAVITY[Math.min(this.level, GRAVITY.length - 1)];
    return this.cheats.slow ? g * 3 : g;
  }

  cells(kind, r, x, y) {
    return SHAPES[kind][((r % 4) + 4) % 4].map(([cx, cy]) => [x + cx, y + cy]);
  }

  collides(kind, r, x, y) {
    for (const [cx, cy] of this.cells(kind, r, x, y)) {
      if (cx < 0 || cx >= COLS || cy >= ROWS) return true;
      if (cy >= 0 && this.board[cy][cx]) return true;
    }
    return false;
  }

  // ------------------------------------------------------------ input helpers
  pressed(b) {
    return this.held[b] && !this.prev[b];
  }

  repeat(b) {
    if (!this.held[b]) {
      this.rep[b] = 0;
      return false;
    }
    this.rep[b]++;
    if (this.rep[b] === 1) return true;
    if (this.rep[b] >= DAS_FIRST && (this.rep[b] - DAS_FIRST) % DAS_NEXT === 0) return true;
    return false;
  }

  // ------------------------------------------------------------ update (one 60 Hz frame)
  step(held) {
    this.held = { ...held };
    this.t++;
    switch (this.screen) {
      case 'title':
        if (this.pressed('start') || this.pressed('a')) {
          this.hooks.sfx?.('select');
          this.toMenu();
        }
        break;
      case 'menu':
        this.stepMenu();
        break;
      case 'play':
        this.stepPlay();
        break;
      case 'over':
      case 'win':
        if (this.t > 40 && (this.pressed('start') || this.pressed('a'))) {
          this.hooks.sfx?.('select');
          this.toMenu();
        }
        break;
    }
    this.prev = { ...this.held };
  }

  stepMenu() {
    const m = this.menu;
    const rows = m.type === 'B' ? ['type', 'level', 'height', 'music'] : ['type', 'level', 'music'];
    if (m.cursor >= rows.length) m.cursor = rows.length - 1;
    if (this.pressed('up')) { m.cursor = (m.cursor + rows.length - 1) % rows.length; this.hooks.sfx?.('move'); }
    if (this.pressed('down') || this.pressed('select')) { m.cursor = (m.cursor + 1) % rows.length; this.hooks.sfx?.('move'); }
    const dir = this.pressed('right') ? 1 : this.pressed('left') ? -1 : 0;
    if (dir) {
      const row = rows[m.cursor];
      if (row === 'type') m.type = m.type === 'A' ? 'B' : 'A';
      if (row === 'level') m.level = (m.level + dir + 10) % 10;
      if (row === 'height') m.height = (m.height + dir + 6) % 6;
      if (row === 'music') {
        m.music = (m.music + dir + 3) % 3;
        this.hooks.music?.(m.music ? `tune${m.music}` : null);
      }
      this.hooks.sfx?.('move');
    }
    if (this.pressed('start') || this.pressed('a')) {
      this.hooks.sfx?.('select');
      this.startGame();
    }
    if (this.pressed('b')) this.toTitle();
  }

  stepPlay() {
    if (this.pressed('start')) {
      this.paused = !this.paused;
      this.hooks.sfx?.('pause');
      this.hooks.pause?.(this.paused);
      return;
    }
    if (this.paused) return;

    if (this.clearing) {
      this.clearing.t++;
      if (this.clearing.t >= 28) {
        const rows = this.clearing.rows;
        this.board = this.board.filter((_, i) => !rows.includes(i));
        while (this.board.length < ROWS) this.board.unshift(Array(COLS).fill(null));
        this.clearing = null;
        if (this.type === 'B' && this.lines >= this.goal) return this.win();
        this.spawn();
      }
      return;
    }
    if (this.entryDelay > 0) {
      this.entryDelay--;
      return;
    }

    const p = this.piece;
    if (this.pressed('a')) this.tryRotate(1);
    if (this.pressed('b')) this.tryRotate(-1);
    if (this.repeat('left') && !this.held.right) this.tryMove(-1);
    if (this.repeat('right') && !this.held.left) this.tryMove(1);

    if (this.options.hardDrop && this.pressed('up')) {
      let d = 0;
      while (!this.collides(p.kind, p.r, p.x, p.y + 1)) { p.y++; d++; }
      this.score += d * 2;
      this.hooks.sfx?.('drop');
      return this.lock();
    }

    let drop = false;
    if (this.held.down) {
      this.rep.down++;
      if (this.rep.down % 2 === 1) {
        drop = true;
        this.softRows++;
      }
    } else {
      this.rep.down = 0;
      this.softRows = 0;
    }
    this.fall++;
    if (this.fall >= this.gravity()) drop = true;
    if (drop) {
      this.fall = 0;
      if (this.collides(p.kind, p.r, p.x, p.y + 1)) {
        this.lock();
      } else {
        p.y++;
        if (this.held.down) this.score += 1;
      }
    }
  }

  tryMove(dx) {
    const p = this.piece;
    if (!this.collides(p.kind, p.r, p.x + dx, p.y)) {
      p.x += dx;
      this.hooks.sfx?.('move');
    }
  }

  tryRotate(dir) {
    const p = this.piece;
    const r = p.r + dir;
    for (const kick of [0, -1, 1, -2, 2]) {
      if (Math.abs(kick) === 2 && p.kind !== 'I') continue;
      if (!this.collides(p.kind, r, p.x + kick, p.y)) {
        p.r = (r + 4) % 4;
        p.x += kick;
        this.hooks.sfx?.('rotate');
        return;
      }
    }
  }

  lock() {
    const p = this.piece;
    let above = false;
    for (const [cx, cy] of this.cells(p.kind, p.r, p.x, p.y)) {
      if (cy < 0) above = true;
      else this.board[cy][cx] = p.kind;
    }
    this.hooks.sfx?.('lock');
    if (above) return this.gameOver();
    const full = [];
    this.board.forEach((row, i) => { if (row.every(Boolean)) full.push(i); });
    if (full.length) {
      const before = this.level;
      this.lines += full.length;
      this.score += LINE_SCORE[full.length] * (this.level + 1);
      if (this.type === 'A') this.level = Math.max(this.startLevel, Math.floor(this.lines / 10));
      this.clearing = { rows: full, t: 0 };
      this.hooks.sfx?.(full.length === 4 ? 'quad' : 'clear');
      if (this.level > before) setTimeout(() => this.hooks.sfx?.('level'), 450);
      this.piece = null;
    } else {
      this.entryDelay = 2;
      this.spawn();
    }
    this.hooks.onScore?.(this.score);
  }

  recordHigh() {
    const list = this.highScores[this.type] || (this.highScores[this.type] = []);
    list.push(this.score);
    list.sort((a, b) => b - a);
    list.length = Math.min(list.length, 3);
    this.saveHigh();
  }

  gameOver() {
    this.screen = 'over';
    this.t = 0;
    this.piece = null;
    this.recordHigh();
    this.hooks.music?.(null);
    this.hooks.sfx?.('over');
  }

  win() {
    this.score += 1000 * (this.startLevel + 1) + 500 * this.menu.height;
    this.screen = 'win';
    this.t = 0;
    this.piece = null;
    this.recordHigh();
    this.hooks.music?.(null);
    this.hooks.sfx?.('win');
  }

  // ------------------------------------------------------------ save states
  snapshot() {
    return JSON.parse(JSON.stringify({
      screen: this.screen, type: this.type, level: this.level, startLevel: this.startLevel,
      lines: this.lines, score: this.score, goal: this.goal, board: this.board, piece: this.piece,
      next: this.next, bag: this.bag, menu: this.menu, fall: this.fall, t: this.t, paused: this.paused,
    }));
  }

  restore(s) {
    Object.assign(this, JSON.parse(JSON.stringify(s)));
    this.clearing = null;
    this.entryDelay = 0;
    if (this.screen === 'play' && !this.piece) this.spawn();
    this.hooks.music?.(this.screen === 'play' || this.screen === 'menu' ? (this.menu.music ? `tune${this.menu.music}` : null) : null);
  }

  // ------------------------------------------------------------ drawing
  px(x, y, c) {
    if (x < 0 || y < 0 || x >= W || y >= H) return;
    const i = (y * W + x) * 4;
    const d = this.img.data;
    const col = this.pal[c];
    d[i] = col[0]; d[i + 1] = col[1]; d[i + 2] = col[2]; d[i + 3] = 255;
  }

  rect(x, y, w, h, c) {
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) this.px(x + i, y + j, c);
  }

  tile(name, x, y, invert = false) {
    const rows = DATA.tiles[name];
    for (let j = 0; j < 8; j++) {
      const row = rows[j];
      for (let i = 0; i < 8; i++) {
        const v = row.charCodeAt(i) - 48;
        this.px(x + i, y + j, invert ? 3 - v : v);
      }
    }
  }

  text(s, x, y, c = 3, scale = 1) {
    let cx = x;
    for (const ch of String(s).toUpperCase()) {
      const g = DATA.font[ch] || DATA.font[' '];
      for (let j = 0; j < 7; j++) {
        for (let i = 0; i < 5; i++) {
          if (g[j][i] === '#') this.rect(cx + i * scale, y + j * scale, scale, scale, c);
        }
      }
      cx += 6 * scale;
    }
    return cx;
  }

  textW(s, scale = 1) {
    return String(s).length * 6 * scale - scale;
  }

  center(s, y, c = 3, scale = 1, x0 = 0, w = W) {
    this.text(s, x0 + Math.floor((w - this.textW(s, scale)) / 2), y, c, scale);
  }

  box(x, y, w, h) {
    this.rect(x, y, w, h, 3);
    this.rect(x + 1, y + 1, w - 2, h - 2, 0);
  }

  render() {
    this.rect(0, 0, W, H, 0);
    if (this.screen === 'title') this.drawTitle();
    else if (this.screen === 'menu') this.drawMenu();
    else this.drawPlay();
    this.ctx.putImageData(this.img, 0, 0);
  }

  drawTitle() {
    for (let x = 0; x < W; x += 8) { this.tile('W', x, 0); this.tile('W', x, H - 8); }
    // skyline of stacked blocks
    const heights = [2, 3, 1, 3, 2, 3, 1, 2, 3, 2, 3, 1, 2, 1, 2, 3, 1, 2, 3, 1];
    heights.forEach((h, i) => {
      for (let k = 0; k < h; k++) {
        if ((i * 7 + k * 3) % 5 === 0) continue;
        this.tile(KINDS[(i + k) % 7], i * 8, H - 16 - k * 8);
      }
    });
    // title
    this.rect(14, 18, 132, 38, 3);
    this.rect(16, 20, 128, 34, 0);
    this.center('TETRIS', 25 + 1, 1, 2);
    this.center('TETRIS', 25, 3, 2);
    this.center('FALLING BLOCKS', 44, 2);
    // falling demo piece
    const k = KINDS[Math.floor(this.t / 90) % 7];
    const fy = 58 + ((this.t % 90) / 90) * 10;
    for (const [cx, cy] of SHAPES[k][Math.floor(this.t / 30) % 4]) this.tile(k, 64 + cx * 8, Math.floor(fy) + cy * 8);
    if (Math.floor(this.t / 30) % 2 === 0) {
      this.rect(36, 96, 88, 11, 0);
      this.center('PRESS START', 98, 3);
    }
  }

  drawMenu() {
    const m = this.menu;
    for (let y = 0; y < H; y += 8) { this.tile('W', 0, y); this.tile('W', W - 8, y); }
    this.box(12, 6, 136, 18);
    this.center('GAME SETUP', 11, 3);
    const rows = m.type === 'B' ? ['type', 'level', 'height', 'music'] : ['type', 'level', 'music'];
    const label = { type: 'TYPE', level: 'LEVEL', height: 'HEIGHT', music: 'MUSIC' };
    const val = {
      type: m.type === 'A' ? 'A MARATHON' : 'B CLEAR 25',
      level: String(m.level),
      height: String(m.height),
      music: m.music ? `TUNE ${m.music}` : 'OFF',
    };
    this.box(12, 28, 136, 12 + rows.length * 14);
    rows.forEach((r, i) => {
      const y = 34 + i * 14;
      const sel = i === m.cursor;
      if (sel) this.rect(14, y - 3, 132, 13, 1);
      this.text(label[r], 20, y, 3);
      const v = val[r];
      const vx = 142 - this.textW(v) - 8;
      if (sel && Math.floor(this.t / 16) % 2 === 0) { this.text('<', vx - 8, y, 3); this.text('>', 138, y, 3); }
      this.text(v, vx, y, 3);
    });
    const hs = this.highScores[m.type] || [];
    const hy = 46 + rows.length * 14;
    this.box(12, hy, 136, 34);
    this.text('TOP', 20, hy + 5, 3);
    [0, 1, 2].forEach((i) => {
      const s = hs[i] != null ? String(hs[i]) : '-';
      this.text(`${i + 1}.`, 60, hy + 5 + i * 9, 2);
      this.text(s, 140 - this.textW(s), hy + 5 + i * 9, 3);
    });
    if (Math.floor(this.t / 30) % 2 === 0) this.center('START TO PLAY', H - 12, 3);
  }

  drawPlay() {
    // background + walls
    for (let y = 0; y < H; y += 8) {
      this.tile('B', 0, y);
      this.tile('W', 8, y);
      this.tile('W', FX + COLS * 8, y);
    }
    // board
    const flash = this.clearing && Math.floor(this.clearing.t / 4) % 2 === 0;
    for (let r = 0; r < ROWS; r++) {
      const clearingRow = this.clearing && this.clearing.rows.includes(r);
      for (let c = 0; c < COLS; c++) {
        const k = this.board?.[r]?.[c];
        if (clearingRow) {
          if (this.clearing.t >= 24 || flash) this.rect(FX + c * 8, r * 8, 8, 8, this.clearing.t >= 24 ? 0 : 3);
          else if (k) this.tile(k, FX + c * 8, r * 8);
        } else if (k) this.tile(k, FX + c * 8, r * 8);
      }
    }
    // game-over curtain
    if (this.screen === 'over') {
      const n = Math.min(ROWS, Math.floor(this.t / 3));
      for (let r = ROWS - 1; r >= ROWS - n; r--) for (let c = 0; c < COLS; c++) this.tile('G', FX + c * 8, r * 8);
    }
    // ghost + piece
    const p = this.piece;
    if (p && this.screen === 'play' && !this.paused) {
      if (this.options.ghost) {
        let gy = p.y;
        while (!this.collides(p.kind, p.r, p.x, gy + 1)) gy++;
        if (gy !== p.y) {
          for (const [cx, cy] of this.cells(p.kind, p.r, p.x, gy)) {
            if (cy < 0) continue;
            const x = FX + cx * 8, y = cy * 8;
            this.rect(x, y, 8, 1, 2); this.rect(x, y + 7, 8, 1, 2); this.rect(x, y, 1, 8, 2); this.rect(x + 7, y, 1, 8, 2);
          }
        }
      }
      for (const [cx, cy] of this.cells(p.kind, p.r, p.x, p.y)) if (cy >= 0) this.tile(p.kind, FX + cx * 8, cy * 8);
    }
    // side panel
    const sx = FX + COLS * 8 + 8;
    const pw = W - sx - 2;
    const panel = (y, label, value) => {
      this.box(sx, y, pw, 22);
      this.center(label, y + 3, 3, 1, sx, pw);
      const v = String(value);
      this.text(v, sx + pw - 3 - this.textW(v), y + 12, 3);
    };
    panel(4, 'SCORE', this.score ?? 0);
    panel(30, 'LEVEL', this.level ?? 0);
    if (this.type === 'B') panel(56, 'LEFT', Math.max(0, (this.goal || 0) - (this.lines || 0)));
    else panel(56, 'LINES', this.lines ?? 0);
    this.box(sx + 4, 86, pw - 8, 34);
    this.center('NEXT', 90, 3, 1, sx + 4, pw - 8);
    if (this.next) {
      const cells = SHAPES[this.next][0];
      const minX = Math.min(...cells.map((c) => c[0])), maxX = Math.max(...cells.map((c) => c[0]));
      const minY = Math.min(...cells.map((c) => c[1]));
      const w = (maxX - minX + 1) * 8;
      const ox = sx + 4 + Math.floor((pw - 8 - w) / 2);
      for (const [cx, cy] of cells) this.tile(this.next, ox + (cx - minX) * 8, 100 + (cy - minY) * 8);
    }
    this.text(this.type === 'B' ? 'B-TYPE' : 'A-TYPE', sx + 2, 126, 2);

    if (this.paused && this.screen === 'play') {
      this.rect(FX, 0, COLS * 8, H, 0);
      this.box(FX + 6, 56, COLS * 8 - 12, 28);
      this.center('PAUSE', 61, 3, 1, FX, COLS * 8);
      this.center('START', 72, 2, 1, FX, COLS * 8);
    }
    if (this.screen === 'over' && this.t > 60) {
      this.box(FX + 4, 40, COLS * 8 - 8, 52);
      this.center('GAME', 46, 3, 2, FX, COLS * 8);
      this.center('OVER', 63, 3, 2, FX, COLS * 8);
      if (Math.floor(this.t / 30) % 2 === 0) this.center('TRY AGAIN', 82, 2, 1, FX, COLS * 8);
    }
    if (this.screen === 'win') {
      this.rect(FX, 0, COLS * 8, H, 0);
      // a little celebration: blocks rising
      for (let i = 0; i < 6; i++) {
        const k = KINDS[(i + Math.floor(this.t / 20)) % 7];
        const y = H - ((this.t * (1 + (i % 3)) + i * 30) % (H + 16));
        this.tile(k, FX + 4 + i * 12, y);
      }
      this.box(FX + 4, 44, COLS * 8 - 8, 44);
      this.center('CLEAR!', 50, 3, 2, FX, COLS * 8);
      this.center('BONUS', 68, 2, 1, FX, COLS * 8);
      this.center('ADDED', 77, 2, 1, FX, COLS * 8);
    }
  }
}
