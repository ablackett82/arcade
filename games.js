// The games in the arcade. Shared by the launcher (browser) and tools/sync.mjs (node).
//   id      folder under games/ and the launcher's link
//   repo    the game's own repo, a sibling folder of this one, where it is developed
//   prefix  the start of every localStorage key the game writes; the games already
//           namespace their keys, so they share one origin without clashing
export const GAMES = [
  { id: 'pacman',      name: 'Pac-Man',        year: 1980, repo: 'pacman',         prefix: 'pacman.' },
  { id: 'kong',        name: 'Kong',           year: 1981, repo: 'donkey-kong',    prefix: 'dk.' },
  { id: 'invaders',    name: 'Space Invaders', year: 1978, repo: 'space-invaders', prefix: 'invaders.' },
  { id: 'breakout',    name: 'Breakout',       year: 1976, repo: 'breakout',       prefix: 'breakout.' },
  { id: 'chuckie-egg', name: 'Chuckie Egg',    year: 1983, repo: 'chuckie-egg',    prefix: 'chuckie.' },
  { id: 'lemmings',    name: 'Lemmings',       year: 1991, repo: 'lemmings',       prefix: 'lemmings.' },
  { id: 'asteroids',   name: 'Asteroids',      year: 1979, repo: 'asteroids',      prefix: 'asteroids.' },
  { id: 'hedgehog',    name: 'Hedgehog Crossing', year: 2026, repo: 'frogger',     prefix: 'hedgehog.' },
];
