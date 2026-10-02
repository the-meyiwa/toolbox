/* ============================================================
   TOOLBOX — Tools page motion

   Same page, lighter hand:
   - cards in each category cascade in as the category scrolls into
     view (once per render), and search results cascade in nearest
     first as you type;
   - the category bar has one indicator that slides to the chosen
     category, and follows along as you scroll the page;
   - a soft light follows the pointer across a card.
   Reduced motion: everything is simply there.
   ============================================================ */

import { pointerLight } from './lib/reveal-motion.js';

const reduced = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
let io = null;
let spy = null;

/** Called after every grid render. */
export function animateToolGrid(grid, { query = '' } = {}) {
  if (!grid) return;
  io?.disconnect();
  const sections = [...grid.querySelectorAll('.grid-category')];
  if (reduced() || typeof IntersectionObserver !== 'function') { sections.forEach(s => s.classList.add('is-in')); return; }
  grid.classList.toggle('is-searching', !!query);
  if (query) {
    // Results are one ranked list: show them at once, nearest first.
    sections.forEach(s => { s.classList.remove('is-in'); void s.offsetWidth; s.classList.add('is-in'); });
    return;
  }
  io = new IntersectionObserver((entries) => {
    for (const e of entries) {
      if (!e.isIntersecting) continue;
      e.target.classList.add('is-in');
      io.unobserve(e.target);
    }
  }, { rootMargin: '0px 0px -8% 0px', threshold: 0.04 });
  sections.forEach(s => io.observe(s));
}

/** The sliding indicator under the active category chip, and the chip that follows scrolling. */
export function installChipIndicator(bar) {
  if (!bar) return;
  // The bar's chips are re-rendered with the grid; the indicator is re-added and re-placed each time.
  let ind = bar.querySelector('.chip-ind');
  if (!ind) {
    ind = document.createElement('span');
    ind.className = 'chip-ind';
    ind.setAttribute('aria-hidden', 'true');
    bar.prepend(ind);
  }
  const place = (instant = false) => {
    const chip = bar.querySelector('.category-chip.active');
    if (!chip) { ind.style.opacity = '0'; return; }
    if (instant) ind.style.transition = 'none';
    ind.style.opacity = '1';
    ind.style.width = `${chip.offsetWidth}px`;
    ind.style.transform = `translateX(${chip.offsetLeft}px)`;
    if (instant) { void ind.offsetWidth; ind.style.transition = ''; }
  };
  bar._placeIndicator = place;
  requestAnimationFrame(() => place(true));

  if (!bar.dataset.indBound) {
    bar.dataset.indBound = '1';
    bar.addEventListener('click', (e) => {
      if (!e.target.closest('.category-chip')) return;
      bar._lock = Date.now() + 900;
      requestAnimationFrame(() => bar._placeIndicator?.());
    });
    window.addEventListener('resize', () => bar._placeIndicator?.(true));
  }

  // Follow the page: the category in view becomes the active chip (without scrolling the page).
  spy?.disconnect();
  const sections = [...document.querySelectorAll('#tool-grid .grid-category[id^="cat-"]')];
  if (!sections.length || typeof IntersectionObserver !== 'function') return;
  spy = new IntersectionObserver((entries) => {
    if (Date.now() < (bar._lock || 0)) return;
    const visible = entries.filter(e => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
    if (!visible) return;
    const id = visible.target.id.replace(/^cat-/, '');
    const chip = bar.querySelector(`.category-chip[data-cat="${CSS.escape(id)}"]`);
    if (!chip || chip.classList.contains('active')) return;
    bar.querySelectorAll('.category-chip').forEach(c => { c.classList.toggle('active', c === chip); c.setAttribute('aria-pressed', String(c === chip)); });
    place();
    const left = chip.offsetLeft - bar.clientWidth / 2 + chip.offsetWidth / 2;
    bar.scrollTo({ left, behavior: reduced() ? 'auto' : 'smooth' });
  }, { rootMargin: '-120px 0px -65% 0px' });
  sections.forEach(s => spy.observe(s));
}

let lit = false;
export function installToolCardLight(grid) {
  if (lit || !grid) return;
  lit = true;
  pointerLight(grid, '.tool-card', '');
}
