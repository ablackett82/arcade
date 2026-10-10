// Scores and progress: reading them for the launcher, and bringing them across
// from the games' old home-screen apps.
//
// On iPad each home-screen app keeps its own storage, so the arcade cannot see
// what the old Pac-Man icon saved even though both live on the same site. The old
// apps' "Copy my scores" button (moved.js in each game's repo) puts a transfer
// code on the clipboard; the arcade's "Bring scores across" pastes it here.
//
// A code is  ARCADE1:<base64 of JSON { from, data: { key: value } }>  where the
// keys and values are the old app's localStorage entries, untouched.

import { GAMES } from './games.js';

const TAG = 'ARCADE1:';

/** Pull the transfer code out of whatever was pasted (it may come with other text). */
export function parseCode(text) {
  const m = String(text ?? '').match(/ARCADE1:([A-Za-z0-9+/=_-]+)/);
  if (!m) return null;
  try {
    const json = new TextDecoder().decode(Uint8Array.from(atob(m[1].replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0)));
    const obj = JSON.parse(json);
    if (!obj || typeof obj.data !== 'object') return null;
    return obj;
  } catch { return null; }
}

/** Make a code (the old apps do the same in moved.js; this one is for tests). */
export function makeCode(from, data) {
  const bytes = new TextEncoder().encode(JSON.stringify({ from, data }));
  return TAG + btoa(String.fromCharCode(...bytes));
}

function gameFor(key) { return GAMES.find((g) => key.startsWith(g.prefix)); }

function num(v) { const n = Number(v); return Number.isFinite(n) ? n : null; }
function json(v, d) { try { return JSON.parse(v) ?? d; } catch { return d; } }

/**
 * The value to keep when an imported entry meets one already here. Scores and
 * progress keep the better of the two; settings keep the arcade's own.
 */
export function mergeValue(key, mine, theirs) {
  if (mine == null) return theirs;
  if (/\.highscore$/.test(key)) {
    const a = num(mine), b = num(theirs);
    return b != null && (a == null || b > a) ? theirs : mine;
  }
  if (/^lemmings\.done(\.dos)?$/.test(key)) {
    const a = json(mine, []), b = json(theirs, []);
    if (!Array.isArray(b)) return mine;
    if (!Array.isArray(a)) return theirs;
    return JSON.stringify([...new Set([...a, ...b])].sort((x, y) => x - y));
  }
  if (/^lemmings\.level(\.dos)?$/.test(key)) {
    const a = num(json(mine, null)), b = num(json(theirs, null));
    return b != null && (a == null || b > a) ? theirs : mine;
  }
  return mine;
}

/**
 * Merge a parsed code into storage. Only keys belonging to one of the arcade's
 * games are accepted. Returns { games: [names], changed: n }.
 */
export function importData(obj, storage = localStorage) {
  const games = new Set();
  let changed = 0;
  for (const [key, value] of Object.entries(obj.data ?? {})) {
    const g = gameFor(key);
    if (!g || typeof value !== 'string') continue;
    games.add(g.name);
    const mine = storage.getItem(key);
    const next = mergeValue(key, mine, value);
    if (next !== mine) { storage.setItem(key, next); changed++; }
  }
  return { games: [...games], changed };
}

/** The line under a game's tile: its high score, or for Lemmings the levels done. */
export function summary(game, storage = localStorage) {
  try {
    if (game.id === 'lemmings') {
      const n = json(storage.getItem('lemmings.done'), []).length + json(storage.getItem('lemmings.done.dos'), []).length;
      return n ? `${n} level${n === 1 ? '' : 's'} done` : '';
    }
    const hs = num(storage.getItem(game.prefix + 'highscore'));
    return hs ? `High score ${hs}` : '';
  } catch { return ''; }
}
