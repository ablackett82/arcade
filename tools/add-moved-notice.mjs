#!/usr/bin/env node
// One-off, safe to re-run: puts the "moved into the Arcade" notice into each
// game's own repo, so the old home-screen apps tell their players and can copy
// their scores across. Per repo:
//   - moved.js copied in from moved/moved.js
//   - index.html loads it (sync.mjs strips that tag again from the arcade's copy)
//   - sw.js caches it, with VERSION bumped so installed apps update, and its
//     clean-up narrowed to the game's own caches — it used to delete every cache
//     on the site, which would include the arcade's
// Nothing is committed; review with git diff in each repo.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { GAMES } from '../games.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const moved = fs.readFileSync(path.join(ROOT, 'moved', 'moved.js'), 'utf8');

for (const g of GAMES) {
  const repo = path.join(path.dirname(ROOT), g.repo);
  const out = [];
  fs.writeFileSync(path.join(repo, 'moved.js'), moved);

  const pagePath = path.join(repo, 'index.html');
  let page = fs.readFileSync(pagePath, 'utf8');
  if (!page.includes('src="moved.js"')) {
    page = page.replace(/<\/body>/, `  <script src="moved.js" data-prefix="${g.prefix}" data-name="${g.name}"></script>\n</body>`);
    fs.writeFileSync(pagePath, page);
    out.push('index.html');
  }

  const swPath = path.join(repo, 'sw.js');
  let sw = fs.readFileSync(swPath, 'utf8');
  const before = sw;
  if (!sw.includes("'moved.js'")) {
    sw = sw.replace(/const VERSION = 'v(\d+)';/, (_, n) => `const VERSION = 'v${Number(n) + 1}';`);
    sw = sw.replace("'./', 'index.html',", "'./', 'index.html', 'moved.js',");
  }
  sw = sw.replace('keys.filter((k) => k !== CACHE)', 'keys.filter((k) => k.startsWith(CACHE.slice(0, -VERSION.length)) && k !== CACHE)');
  if (sw !== before) {
    if (!sw.includes("'moved.js'") || !sw.includes('CACHE.slice(0, -VERSION.length)')) throw new Error(`${g.repo}/sw.js: not the expected shape, edit by hand`);
    fs.writeFileSync(swPath, sw);
    out.push('sw.js ' + sw.match(/const VERSION = '([^']+)'/)[1]);
  }
  console.log(`${g.repo.padEnd(15)} ${out.length ? out.join(', ') : 'already done'}`);
}
