# Arcade

Pac-Man, Kong, Space Invaders, Breakout, Chuckie Egg, Lemmings and Asteroids in
one home-screen app for the iPad. Plain HTML/JS, no build step; the whole thing is
cached for offline play.

Open the site, then Share → **Add to Home Screen**. Each game has a ⌂ button top
left (tap twice) to get back to the menu.

## How it's put together

The games are still developed in their own repos, each a sibling folder of this
one. `npm run sync` copies each game in — its page, `style.css`, `src/`, `data/`,
`icons/` — into `games/<id>/`, leaving behind its own manifest and service
worker and adding `shim.js` (the ⌂ button). It then writes `sw.js` from
`tools/sw.template.js` with every file listed and a version hashed from their
contents, so a home-screen app updates whenever anything changes. It warns when
a game's repo has uncommitted changes or is behind GitHub.

After changing a game: commit it in its own repo, then here `npm run sync`,
commit, push.

The game list is `games.js`. To add one: clone it next to this folder, add a
line (its `prefix` is the start of the localStorage keys it writes), sync.

## Scores and progress

The games already namespace their localStorage keys (`pacman.`, `dk.`, ...), and
everything is on one origin, so in the arcade they sit side by side and in
Safari the arcade sees the same scores the separate games saved.

A home-screen app on iPad keeps its own storage, though, so the old Pac-Man
icon's scores can't be read from the Arcade icon. Each game's repo therefore
carries `moved.js` (master copy in `moved/`, installed by
`tools/add-moved-notice.mjs`): the old app shows "this game has moved", with
**Copy my scores**, which puts a transfer code on the clipboard. In the arcade,
**Bring scores across** → **Paste** merges it (`scores.js`): high scores keep the
higher, Lemmings' levels done are combined and the furthest level kept, settings
are taken only if the arcade has none. Pasting the same code twice does nothing.

Not carried across: the DOS Lemmings data files, if they were loaded into the old
app — load them again in the arcade's Lemmings.

## Develop

```
npm run dev     # http://localhost:8080/ (the service worker is skipped on localhost)
npm test
npm run icons   # redraw icons/
```
