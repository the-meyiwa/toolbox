/* ============================================================
   TOOLBOX — Landing page motion

   The landing page speaks Mind's language. The question sits at the
   centre and the areas of Toolbox orbit it:

   - On arrival the title rises word by word, the search settles, the
     orbit rings draw in, and each area leaves the centre for its place
     on the orbit while its tether draws out to it.
   - Below the hero, chips, the Assistant card, stat tiles (counting
     up), task cards and files arrive in a cascade as they scroll in.
   - Choosing an area on the orbit glides down to its card and lights it.
   - A soft light follows the pointer over cards, and tiles lean toward it.

   It replays (quicker) each time you come back to Home. Only transform,
   opacity and clip-path move; reduced motion shows everything at once.
   ============================================================ */

import { RevealMotion, pointerLight, countUp } from './lib/reveal-motion.js';

const reduced = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
const narrow = () => typeof matchMedia === 'function' && matchMedia('(max-width: 760px)').matches;
const GLIDE = 'cubic-bezier(.16, 1, .3, 1)';

const UNITS = [
  ['.lp-title', 'title'],
  ['.lp-badge', 'pop'],
  ['.lp-kicker, .lp-sub', 'fade'],
  ['.lp-search', 'up'],
  ['.home-quick', 'widget'],
  ['.lp-head', 'panel'],
  ['.lp-stat', 'up'],
  ['.lp-scroll-hint', 'fade'],
  ['.lp-section-head', 'up'],
  ['.lp-card', 'card'],
  ['.lp-file', 'card'],
  ['.lp-empty', 'up'],
];
const ATOMIC = '.lp-card, .lp-file, .lp-stat, .lp-head, .lp-search, .home-quick, .lp-section-head';

export function initHomeScrollNarrative() {
  const home = document.getElementById('home-view');
  if (!home) return;
  const motion = new RevealMotion(home, { units: UNITS, atomic: ATOMIC, titles: '.lp-title', skip: '.lp-orbit, .home-hero-dropdown', hold: { title: 1700 } });
  let played = false;

  /** Areas leave the centre for their place on the orbit; tethers draw out to them. */
  const emerge = (slow) => {
    const orbit = home.querySelector('.lp-orbit');
    const rings = home.querySelector('.lp-space');
    const lines = [...home.querySelectorAll('.lp-tethers line')];
    const tiles = [...home.querySelectorAll('.lp-tile')];
    if (!orbit) return;
    if (reduced() || typeof Element.prototype.animate !== 'function') {
      rings?.classList.add('is-drawn'); lines.forEach(l => l.classList.add('drawn'));
      tiles.forEach(t => t.querySelectorAll('[data-count]').forEach(countUp));
      return;
    }
    rings?.classList.remove('is-drawn'); lines.forEach(l => l.classList.remove('drawn'));
    requestAnimationFrame(() => rings?.classList.add('is-drawn'));
    const o = orbit.getBoundingClientRect();
    const cx = o.left + o.width / 2, cy = o.top + o.height / 2;
    tiles.forEach((tile, i) => {
      const delay = (slow ? 380 : 120) + i * (slow ? 70 : 35);
      if (!narrow()) {
        const r = tile.getBoundingClientRect();
        tile.animate([
          { opacity: 0, transform: `translate(${cx - (r.left + r.width / 2)}px, ${cy - (r.top + r.height / 2)}px) scale(.35)` },
          { opacity: 1, transform: 'none' },
        ], { duration: slow ? 950 : 620, delay, easing: GLIDE, fill: 'backwards' });
      } else {
        tile.animate([{ opacity: 0, transform: 'translateY(14px) scale(.96)' }, { opacity: 1, transform: 'none' }], { duration: 520, delay: 200 + i * 40, easing: GLIDE, fill: 'backwards' });
      }
      setTimeout(() => { lines[i]?.classList.add('drawn'); tile.querySelectorAll('[data-count]').forEach(countUp); }, delay + 120);
    });
  };

  const play = () => {
    if (home.classList.contains('hidden')) return;
    const first = !played;
    played = true;
    motion.reset();
    // Start from a clean slate: anything still mid-reveal (or arrived on an earlier visit)
    // is unmarked, so this pass marks and reveals all of it again.
    home.querySelectorAll('.rv-u, .rv-arrived').forEach((el) => {
      el.classList.remove('rv-u', 'is-in', 'is-quick', 'rv-arrived');
      el.style.removeProperty('--rv-d');
      delete el.dataset.rv; delete el.dataset.rvQuick;
    });
    motion.enter(home, { mode: first ? 'full' : 'quick' });
    emerge(first);
  };

  // Home is shown and hidden by toggling .hidden; play each time it goes from hidden to shown.
  let shown = false;
  const check = () => {
    const now = !home.classList.contains('hidden');
    if (now && !shown) requestAnimationFrame(play);
    shown = now;
  };
  new MutationObserver(check).observe(home, { attributes: true, attributeFilter: ['class'] });
  check();

  // Soft light over cards and tiles; tiles and cards lean toward the pointer.
  pointerLight(home, '.lp-tile, .lp-card, .lp-file, .lp-stat, .lp-head', '.lp-tile, .lp-card');

  const smooth = reduced() ? 'auto' : 'smooth';
  home.addEventListener('click', (e) => {
    const hint = e.target.closest('a[href^="#home-slide-"]');
    if (hint) {
      e.preventDefault();
      document.getElementById(hint.getAttribute('href').slice(1))?.scrollIntoView({ behavior: smooth, block: 'start' });
      return;
    }
    // An area on the orbit: glide to its card and light it up.
    const tile = e.target.closest('.lp-tile');
    if (!tile) return;
    e.preventDefault();
    const card = document.getElementById(`home-task-${tile.dataset.task}`);
    if (!card) return;
    if (!reduced()) tile.animate?.([{ transform: 'scale(1)' }, { transform: 'scale(.94)' }, { transform: 'scale(1)' }], { duration: 260, easing: GLIDE });
    card.scrollIntoView({ behavior: smooth, block: 'center' });
    card.classList.remove('is-spotlit');
    void card.offsetWidth;
    card.classList.add('is-spotlit');
    setTimeout(() => card.querySelector('.lp-tool')?.focus({ preventScroll: true }), reduced() ? 0 : 600);
  });
}
