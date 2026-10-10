// The arcade's front screen: a tile per game, and the importer for scores from
// the old home-screen apps (see scores.js).
import { GAMES } from './games.js';
import { parseCode, importData, summary } from './scores.js';

const nav = document.getElementById('games');

function render() {
  nav.replaceChildren(...GAMES.map((g) => {
    const a = document.createElement('a');
    a.className = 'tile';
    a.href = `games/${g.id}/`;
    a.innerHTML = `<img src="games/${g.id}/icons/icon-192.png" alt=""><span class="name"></span><span class="year">${g.year}</span><span class="score"></span>`;
    a.querySelector('.name').textContent = g.name;
    a.querySelector('.score').textContent = summary(g);
    return a;
  }));
}

const dialog = document.getElementById('import');
const code = document.getElementById('code');
const result = document.getElementById('result');

function bring(text) {
  const obj = parseCode(text);
  if (!obj) { result.textContent = "That isn't a scores code. Tap Copy my scores in the old game first."; return 0; }
  const { games, changed } = importData(obj);
  if (!games.length) { result.textContent = 'There was nothing in that code to bring across.'; return 0; }
  result.textContent = changed
    ? `Brought across: ${games.join(', ')}.`
    : `${games.join(', ')}: already up to date.`;
  render();
  return changed;
}

document.getElementById('bring').addEventListener('click', () => { result.textContent = ''; code.value = ''; dialog.showModal(); });
document.getElementById('close').addEventListener('click', () => dialog.close());
document.getElementById('paste').addEventListener('click', async () => {
  try { bring(await navigator.clipboard.readText()); }
  catch { result.textContent = 'Press and hold in the box below, then tap Paste.'; code.focus(); }
});
code.addEventListener('input', () => { if (parseCode(code.value)) { bring(code.value); code.value = ''; } });

// a code in the link (#import=ARCADE1:...) is taken straight away; it only
// says so when it brought something (from Safari the scores are usually here already)
const h = decodeURIComponent(location.hash);
if (h.includes('ARCADE1:')) {
  if (bring(h)) dialog.showModal();
  history.replaceState(null, '', location.pathname);
}

// in Safari (not yet a home-screen app), say how to make it one
const homeScreen = navigator.standalone === true || matchMedia('(display-mode: fullscreen), (display-mode: standalone)').matches;
if (!homeScreen && 'ontouchend' in document) document.getElementById('install').hidden = false;

// scores change while a game is open; refresh on the way back
addEventListener('pageshow', render);
render();
