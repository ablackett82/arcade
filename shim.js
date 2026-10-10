// Added to every game's page by tools/sync.mjs: a way back to the arcade from a
// home-screen app, which has no browser back button. Top left, which every game
// leaves free (their own buttons are top right). Two taps — the first only arms
// it — so a stray touch mid-game doesn't throw the game away.
(() => {
  const css = `
    #arcade-home { position: fixed; z-index: 1000; top: calc(env(safe-area-inset-top, 0px) + 8px); left: calc(env(safe-area-inset-left, 0px) + 8px);
      height: 36px; min-width: 36px; padding: 0 10px; border-radius: 18px; border: 2px solid rgba(255,255,255,0.35);
      background: rgba(0,0,0,0.5); color: rgba(255,255,255,0.7); font: bold 15px ui-monospace, Menlo, Consolas, monospace;
      display: flex; align-items: center; gap: 6px; touch-action: manipulation; -webkit-tap-highlight-color: transparent; cursor: pointer; }
    #arcade-home.armed { border-color: #ffe640; color: #ffe640; background: rgba(0,0,0,0.85); }
    #arcade-home .label { display: none; }
    #arcade-home.armed .label { display: inline; }`;
  const style = document.createElement('style');
  style.textContent = css;
  document.head.appendChild(style);

  const b = document.createElement('button');
  b.id = 'arcade-home';
  b.type = 'button';
  b.setAttribute('aria-label', 'Back to the Arcade');
  b.innerHTML = '<span aria-hidden="true">&#8962;</span><span class="label">Arcade? Tap again</span>';
  let armed = 0;
  // keep the touch away from the game underneath
  for (const ev of ['pointerdown', 'pointerup', 'touchstart', 'touchend', 'mousedown']) b.addEventListener(ev, (e) => e.stopPropagation());
  b.addEventListener('click', (e) => {
    e.preventDefault(); e.stopPropagation();
    if (armed) { location.href = '../../'; return; }
    b.classList.add('armed');
    armed = setTimeout(() => { b.classList.remove('armed'); armed = 0; }, 3000);
  });
  const add = () => document.body.appendChild(b);
  if (document.body) add(); else addEventListener('DOMContentLoaded', add);
})();
