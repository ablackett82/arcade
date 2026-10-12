#!/usr/bin/env node
// Copies each game in from its own repo (a sibling folder of this one) into
// games/<id>/, then writes sw.js to cache the lot. Run after changing a game:
//
//   npm run sync
//
// The games are still developed in their own repos; what is here is a copy.
// Per game: the page, its stylesheet, src/, data/ and icons/ are copied. The
// game's own manifest and service worker are left behind — the arcade has one of
// each for everything — and the page gets shim.js, the way back to the arcade.

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { GAMES } from '../games.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SIBLINGS = path.dirname(ROOT);
const COPY = ['index.html', 'style.css', 'src', 'data', 'icons'];
const SKIP = new Set(['.DS_Store']);

function git(dir, ...args) {
  const r = spawnSync('git', ['-C', dir, ...args], { encoding: 'utf8' });
  return r.status === 0 ? r.stdout.trim() : null;
}

function copy(from, to) {
  if (SKIP.has(path.basename(from))) return;
  if (fs.statSync(from).isDirectory()) {
    fs.mkdirSync(to, { recursive: true });
    for (const e of fs.readdirSync(from)) copy(path.join(from, e), path.join(to, e));
  } else fs.copyFileSync(from, to);
}

function patchPage(html, id) {
  const steps = [
    [/\s*<link rel="manifest"[^>]*>/, ''],
    [/\s*<script>\/\/ offline cache[\s\S]*?<\/script>/, ''],
    [/<\/body>/, '  <script src="../../shim.js"></script>\n</body>'],
  ];
  for (const [re, by] of steps) {
    if (!re.test(html)) throw new Error(`${id}/index.html: expected to find ${re} — has the page changed shape?`);
    html = html.replace(re, by);
  }
  // the old app's "this game has moved" notice (tools/add-moved-notice.mjs) has no place here
  return html.replace(/\s*<script src="moved\.js"[^>]*><\/script>/, '');
}

function list(dir, base = dir) {
  return fs.readdirSync(dir).flatMap((e) => {
    const p = path.join(dir, e);
    if (SKIP.has(e)) return [];
    return fs.statSync(p).isDirectory() ? list(p, base) : [path.relative(base, p).split(path.sep).join('/')];
  });
}

const versions = {};
let warnings = 0;
// check every repo is there before touching games/, so a missing one can't leave it half-deleted
const missing = GAMES.filter((g) => !fs.existsSync(path.join(SIBLINGS, g.repo, 'index.html')));
if (missing.length) {
  for (const g of missing) console.error(`${g.name}: no ${path.join(SIBLINGS, g.repo)} — clone https://github.com/ablackett82/${g.repo === 'donkey-kong' ? 'DK' : g.repo} there`);
  process.exit(1);
}
fs.rmSync(path.join(ROOT, 'games'), { recursive: true, force: true });
for (const g of GAMES) {
  const src = path.join(SIBLINGS, g.repo);
  const dest = path.join(ROOT, 'games', g.id);
  fs.mkdirSync(dest, { recursive: true });
  for (const item of COPY) if (fs.existsSync(path.join(src, item))) copy(path.join(src, item), path.join(dest, item));
  const page = path.join(dest, 'index.html');
  fs.writeFileSync(page, patchPage(fs.readFileSync(page, 'utf8'), g.id));

  const commit = git(src, 'rev-parse', '--short', 'HEAD');
  const dirty = git(src, 'status', '--porcelain', '--', ...COPY);
  const behind = git(src, 'rev-list', '--count', 'HEAD..@{u}');
  versions[g.id] = commit + (dirty ? '+changes' : '');
  const notes = [];
  if (dirty) notes.push('has uncommitted changes');
  if (behind && behind !== '0') notes.push(`is ${behind} commit(s) behind GitHub — pull it first?`);
  if (notes.length) warnings++;
  console.log(`${g.name.padEnd(15)} ${versions[g.id].padEnd(16)} ${notes.join('; ')}`);
}
fs.writeFileSync(path.join(ROOT, 'games', 'versions.json'), JSON.stringify(versions, null, 2) + '\n');

// the service worker: every file, and a version that changes whenever any of them does
const shell = ['index.html', 'style.css', 'launcher.js', 'games.js', 'scores.js', 'shim.js', 'manifest.webmanifest',
  ...list(path.join(ROOT, 'icons')).map((f) => `icons/${f}`)];
const files = ['./', ...shell, ...list(path.join(ROOT, 'games')).map((f) => `games/${f}`)];
const hash = crypto.createHash('sha256');
for (const f of files.slice(1)) hash.update(f).update(fs.readFileSync(path.join(ROOT, f)));
const version = hash.digest('hex').slice(0, 10);
const template = fs.readFileSync(path.join(ROOT, 'tools', 'sw.template.js'), 'utf8');
fs.writeFileSync(path.join(ROOT, 'sw.js'), template
  .replace("'__VERSION__'", `'${version}'`)
  .replace("['__FILES__']", JSON.stringify(files, null, 0).replace(/","/g, '", "')));
console.log(`sw.js: ${files.length} files, version ${version}${warnings ? `  (${warnings} warning(s) above)` : ''}`);
