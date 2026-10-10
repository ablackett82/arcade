import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseCode, makeCode, importData, summary, mergeValue } from '../scores.js';
import { GAMES } from '../games.js';

class Store {
  constructor(o = {}) { this.m = new Map(Object.entries(o)); }
  getItem(k) { return this.m.has(k) ? this.m.get(k) : null; }
  setItem(k, v) { this.m.set(k, String(v)); }
}

test('a code survives the round trip, and is found inside other pasted text', () => {
  const data = { 'pacman.highscore': '12340', 'pacman.touch': '{"mode":"swipe"}' };
  const code = makeCode('pacman', data);
  assert.deepEqual(parseCode(code).data, data);
  assert.deepEqual(parseCode(`Here are my scores: ${code}\n`).data, data);
  assert.equal(parseCode('hello'), null);
  assert.equal(parseCode('ARCADE1:not-base64!!'), null);
});

test('the code the old games write (moved.js) is read here', async () => {
  const fs = await import('node:fs');
  const src = fs.readFileSync(new URL('../moved/moved.js', import.meta.url), 'utf8');
  const store = new Store({ 'chuckie.highscore': '5000', 'chuckie.cheat': '0', 'other.thing': 'x' });
  // run moved.js's encoder against a fake localStorage
  const encode = new Function('localStorage', 'PREFIX', `${src.match(/\/\/ <encode>([\s\S]*?)\/\/ <\/encode>/)[1]}; return transferCode(PREFIX);`);
  store.length = store.m.size; store.key = (i) => [...store.m.keys()][i];
  const code = encode(store, 'chuckie.');
  assert.deepEqual(parseCode(code), { from: 'chuckie.', data: { 'chuckie.highscore': '5000', 'chuckie.cheat': '0' } });
});

test('high scores keep the higher one', () => {
  const s = new Store({ 'pacman.highscore': '5000', 'dk.highscore': '9000' });
  const r = importData({ data: { 'pacman.highscore': '7000', 'dk.highscore': '8000' } }, s);
  assert.equal(s.getItem('pacman.highscore'), '7000');
  assert.equal(s.getItem('dk.highscore'), '9000');
  assert.equal(r.changed, 1);
  assert.deepEqual(r.games.sort(), ['Kong', 'Pac-Man']);
});

test('Lemmings: levels done are combined, and the furthest level is kept', () => {
  const s = new Store({ 'lemmings.done': '[0,1,2]', 'lemmings.level': '3' });
  importData({ data: { 'lemmings.done': '[1,4]', 'lemmings.level': '5', 'lemmings.done.dos': '[0]' } }, s);
  assert.equal(s.getItem('lemmings.done'), '[0,1,2,4]');
  assert.equal(s.getItem('lemmings.level'), '5');
  assert.equal(s.getItem('lemmings.done.dos'), '[0]');
  assert.equal(summary(GAMES.find((g) => g.id === 'lemmings'), s), '5 levels done');
});

test('settings: taken when the arcade has none, otherwise the arcade keeps its own', () => {
  const s = new Store({ 'breakout.players': '2' });
  importData({ data: { 'breakout.players': '1', 'breakout.balls': '5' } }, s);
  assert.equal(s.getItem('breakout.players'), '2');
  assert.equal(s.getItem('breakout.balls'), '5');
});

test("keys that aren't one of the arcade's games are refused", () => {
  const s = new Store();
  const r = importData({ data: { 'evil.key': 'x', 'pacman.highscore': 100, 'nlt-progress': '{}' } }, s);
  assert.equal(s.m.size, 0); // the number isn't a string either
  assert.equal(r.games.length, 0);
  assert.equal(r.changed, 0);
});

test('importing the same code twice changes nothing the second time', () => {
  const s = new Store();
  const obj = { data: { 'invaders.highscore': '1500', 'lemmings.done': '[0]' } };
  assert.equal(importData(obj, s).changed, 2);
  assert.equal(importData(obj, s).changed, 0);
});

test('a broken stored value never loses an imported score', () => {
  assert.equal(mergeValue('pacman.highscore', 'garbage', '100'), '100');
  assert.equal(mergeValue('lemmings.done', 'garbage', '[1]'), '[1]');
  assert.equal(mergeValue('lemmings.done', '[2]', 'garbage'), '[2]');
});

test('summary shows the high score, or nothing for a game not yet played', () => {
  const s = new Store({ 'breakout.highscore': '432', 'lemmings.done': '[3]' });
  assert.equal(summary(GAMES.find((g) => g.id === 'lemmings'), s), '1 level done'); // with no .dos key at all
  assert.equal(summary(GAMES.find((g) => g.id === 'breakout'), s), 'High score 432');
  assert.equal(summary(GAMES.find((g) => g.id === 'pacman'), s), '');
});

test('every game has its own key prefix, and none is a prefix of another', () => {
  for (const a of GAMES) for (const b of GAMES) if (a !== b) assert.ok(!a.prefix.startsWith(b.prefix), `${a.id} / ${b.id}`);
});
