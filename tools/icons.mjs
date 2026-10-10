#!/usr/bin/env node
// Renders the home-screen icons: icons/icon-180.png (iOS), icon-192.png,
// icon-512.png. A yellow chomper chasing a red ghost along a row of dots, under
// a stripe of the games' colours, on black. Everything sits inside the middle
// 80% so the maskable crop is safe.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Raster } from './png.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const BLACK = [0, 0, 0], YELLOW = [255, 230, 64], RED = [255, 40, 40], WHITE = [255, 255, 255], BLUE = [40, 60, 255], DOT = [255, 184, 151];
const STRIPE = [[255, 48, 48], [255, 150, 30], [255, 230, 64], [40, 230, 70], [60, 230, 255], [255, 111, 216]];

function icon(size) {
  const r = new Raster(size, size);
  r.fill(0, 0, size, size, BLACK);
  const u = size / 32;
  const px = (x, y, c) => r.fill(Math.floor(x * u), Math.floor(y * u), Math.ceil((x + 1) * u) - Math.floor(x * u), Math.ceil((y + 1) * u) - Math.floor(y * u), c);

  // stripe of colours across the top
  STRIPE.forEach((c, i) => { for (let x = 4 + i * 4; x < 8 + i * 4; x++) for (let y = 6; y < 8; y++) px(x, y, c); });

  // the chomper: a disc of radius 5.5 centred (10.5, 17.5), mouth open to the right
  for (let y = 11; y < 24; y++) for (let x = 4; x < 17; x++) {
    const dx = x + 0.5 - 10.5, dy = y + 0.5 - 17.5;
    if (dx * dx + dy * dy > 5.6 * 5.6) continue;
    if (dx > 0 && Math.abs(dy) < dx * 0.75) continue;
    px(x, y, YELLOW);
  }
  // dots
  for (const x of [17, 20]) { px(x, 17, DOT); px(x + 1, 17, DOT); px(x, 18, DOT); px(x + 1, 18, DOT); }

  // the ghost, 7 wide x 8 tall at (21, 13)
  const ghost = [
    '..###..',
    '.#####.',
    '#######',
    '#ww#ww#',
    '#wb#wb#',
    '#######',
    '#######',
    '#.##.##',
  ];
  ghost.forEach((row, j) => [...row].forEach((ch, i) => {
    const c = ch === '#' ? RED : ch === 'w' ? WHITE : ch === 'b' ? BLUE : null;
    if (c) px(21 + i, 13 + j, c);
  }));

  // floor
  for (let x = 4; x < 28; x++) px(x, 25, BLUE);
  return r.encode(1);
}

fs.mkdirSync(path.join(ROOT, 'icons'), { recursive: true });
for (const size of [180, 192, 512]) fs.writeFileSync(path.join(ROOT, `icons/icon-${size}.png`), icon(size));
console.log('wrote icons/icon-{180,192,512}.png');
