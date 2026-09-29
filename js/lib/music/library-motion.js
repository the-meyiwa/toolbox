/* ============================================================
   TOOLBOX — Music Theory Library: motion

   Every piece of content in the library has an entrance. When a
   view is drawn, each block (headings, paragraphs, list items,
   table rows, cards, chips, buttons, glossary entries, figures)
   is marked as a unit with a kind of movement; an observer then
   reveals the units as they come into view, one after another.
   The instruments reveal their parts: piano keys cascade in and
   the marked keys light up, staff lines draw and notes drop onto
   them, frets and strings draw and the dots pop, the circle of
   fifths fans out, beat cells and rhythm lanes fill in.

   css/music-library.css turns the classes into movement. Only
   transform and opacity move; nothing loops. Reduced motion
   shows everything at once.
   ============================================================ */

const reduced = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

/* [selector, kind]. First match wins. Kinds are styled as .mtl-rv[data-rv="kind"]. */
const UNITS = [
  ['.mtl-hero h2, .mtl-topic-head h2', 'title'],
  ['.mtl-crumbs', 'fade'],
  ['.mtl-lvl', 'pop'],
  ['.mtl-h3, .mtl-isec > h3, .mtl-related > h3, .mtl-isec > h4, .mtl-road h4, .mtl-facts h4, .mtl-circle-info h4', 'rule'],
  ['.mtl-card', 'card'],
  ['.mtl-row', 'row'],
  ['.mtl-gloss > div', 'row'],
  ['.mtl-table tbody tr', 'row'],
  ['.mtl-table thead tr', 'fade'],
  ['.mtl-road > li', 'stage'],
  ['.mtl-facts > div', 'flip'],
  ['.mtl-tip', 'tip'],
  ['.mtl-demo', 'panel'],
  ['.mtl-deep', 'panel'],
  ['.mtl-stats > div', 'pop'],
  ['svg.ms-staff, svg.mk-piano, svg.mk-fret, .mtl-circle, .mtl-beats, .mtl-poly, .mtl-bell, .mtl-grid8', 'widget'],
  ['.mtl-chip, .mtl-btn, .mtl-play, .mtl-pchord, .mtl-ear-btn, .mtl-az a, .mtl-seg, .mtl-select, .mtl-tempo, .mtl-free, .mtl-score', 'pop'],
  ['li', 'li'],
  ['.mtl-hero-art', 'art'],
  ['.mtl-staffline', 'rule'],
  ['p, figcaption, .mtl-answer', 'up'],
];
// Units never nest inside these: they move as one piece.
const ATOMIC = '.mtl-card, .mtl-row, .mtl-gloss > div, tr, .mtl-facts > div, .mtl-tip, .mtl-chip, .mtl-btn, .mtl-play, .mtl-pchord, .mtl-ear-btn, .mtl-seg, .mtl-az, .mtl-answer, figcaption, .mtl-crumbs, summary, .mtl-stats > div, .mtl-tempo, .mtl-free, p';
const SELECTOR = UNITS.map(([s]) => s).join(', ');

const escapeText = (t) => t.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c]);

/** Headline words rise out of their own masks (like the About page). */
function splitWords(el) {
  if (el.dataset.split) return;
  el.dataset.split = '1';
  let i = 0;
  const walk = (node) => [...node.childNodes].map((n) => {
    if (n.nodeType === 3) return n.textContent.split(/(\s+)/).filter(Boolean).map((w) => (/^\s+$/.test(w) ? ' ' : `<span class="mtl-w"><span style="--wi:${i++}">${escapeText(w)}</span></span>`)).join('');
    if (n.nodeType !== 1) return '';
    const cls = n.getAttribute('class');
    return `<span${cls ? ` class="${cls}"` : ''}>${walk(n)}</span>`;
  }).join('');
  el.setAttribute('aria-label', el.textContent.replace(/\s+/g, ' ').trim());
  el.innerHTML = walk(el);
  [...el.children].forEach((c) => c.setAttribute('aria-hidden', 'true'));
}

function kindOf(el) {
  for (const [sel, kind] of UNITS) if (el.matches(sel)) return kind;
  return 'up';
}

/** Numbers count up the first time they are seen. */
function countUp(el) {
  const to = Number(el.dataset.count) || 0;
  const start = performance.now(), dur = 1200;
  const tick = (now) => {
    const t = Math.min(1, (now - start) / dur);
    el.textContent = Math.round(to * (1 - Math.pow(1 - t, 4))).toLocaleString();
    if (t < 1) requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}

export class LibraryMotion {
  constructor(root) {
    this.root = root;
    this.io = null;
    this.timers = new Set();
  }

  get off() { return reduced(); }

  /** Marks every unit in `scope` and starts revealing. mode: 'forward' | 'back' | 'tab' | 'search' | 'demo'. */
  enter(scope, { mode = 'tab' } = {}) {
    if (this.off || !scope) return;
    if (mode !== 'demo') {
      scope.dataset.enter = mode;
      const clear = () => { delete scope.dataset.enter; };
      scope.addEventListener('animationend', clear, { once: true });
      this.later(clear, 900);
    }
    scope.querySelectorAll('.mtl-hero h2, .mtl-topic-head h2').forEach(splitWords);
    const units = [];
    scope.querySelectorAll(SELECTOR).forEach((el) => {
      if (el.classList.contains('mtl-rv') || el.closest('.mtl-head, .mtl-tabs')) return;
      const parent = el.parentElement?.closest(ATOMIC);
      if (parent && scope.contains(parent) && parent !== el) return;
      el.classList.add('mtl-rv');
      el.dataset.rv = kindOf(el);
      units.push(el);
    });
    const quick = mode === 'search' || mode === 'demo';
    // HTML-built widgets (beat dots, bell cells, groove grid, rhythm lanes) cascade by index.
    units.forEach((u) => { if (u.dataset.rv === 'widget' && !(u instanceof SVGElement)) u.querySelectorAll(':scope > *, .mtl-grid8-row > *, .mtl-lane > span').forEach((c, i) => c.style.setProperty('--k', i)); });
    // A redrawn demo is already on screen: reveal now, before the next paint, so nothing blinks.
    if (mode === 'demo' || typeof IntersectionObserver === 'undefined') { units.forEach((u, i) => this.show(u, i, quick)); return; }
    this.io ??= new IntersectionObserver((entries) => {
      const shown = entries.filter((e) => e.isIntersecting).map((e) => e.target)
        .sort((a, b) => (a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1));
      shown.forEach((el, i) => { this.io.unobserve(el); this.show(el, i, el.dataset.quick === '1'); });
    }, { rootMargin: '0px 0px -6% 0px' });
    units.forEach((u) => { if (quick) u.dataset.quick = '1'; this.io.observe(u); });
  }

  /** Reveals one unit, `order` places in the current wave. */
  show(el, order, quick = false) {
    const step = quick ? 22 : 45;
    const delay = Math.min(order, quick ? 10 : 12) * step;
    el.style.setProperty('--rv-d', `${delay}ms`);
    el.classList.add('is-in');
    if (quick) el.classList.add('is-quick');
    el.querySelectorAll?.('[data-count]').forEach(countUp);
    if (el.matches('[data-count]')) countUp(el);
    // Hand the element back to its normal styles (hover, press) once it has arrived.
    this.later(() => {
      el.classList.remove('mtl-rv', 'is-in', 'is-quick');
      el.style.removeProperty('--rv-d');
      delete el.dataset.rv; delete el.dataset.quick;
      el.classList.add('mtl-arrived');
    }, delay + ({ widget: 2400, panel: 2000, art: 3000 }[el.dataset.rv] || 1200));
  }

  /** Plays the entrances again inside `el` (an "In depth" section opening). */
  replay(el) {
    if (this.off || !el) return;
    el.querySelectorAll('.mtl-arrived').forEach((x) => x.classList.remove('mtl-arrived'));
    this.enter(el, { mode: 'demo' });
  }

  /** A demo was redrawn after a change: its new parts arrive quickly. */
  repaint(demo) {
    if (this.off || !demo) return;
    this.enter(demo, { mode: 'demo' });
  }

  later(fn, ms) {
    const t = setTimeout(() => { this.timers.delete(t); fn(); }, ms);
    this.timers.add(t);
  }

  /** Lights an element briefly (a key, a note, a cell) as its sound plays. */
  flash(el, ms = 260) {
    if (!el) return;
    el.classList.remove('is-sounding');
    void el.getBoundingClientRect?.();
    el.classList.add('is-sounding');
    this.later(() => el.classList.remove('is-sounding'), ms);
  }

  reset() {
    this.io?.disconnect();
    this.io = null;
    this.timers.forEach(clearTimeout);
    this.timers.clear();
  }
}

/** Slides the pill behind the selected button of a group (tabs, Beginner/Expert). */
export function movePill(group, selector = '[aria-selected="true"], [aria-pressed="true"]') {
  if (!group) return;
  let pill = group.querySelector(':scope > .mtl-pill');
  const fresh = !pill;
  if (fresh) { pill = document.createElement('span'); pill.className = 'mtl-pill'; pill.setAttribute('aria-hidden', 'true'); pill.style.transition = 'none'; group.prepend(pill); }
  const on = group.querySelector(selector);
  if (!on) { pill.style.opacity = '0'; return; }
  pill.style.opacity = '1';
  pill.style.width = `${on.offsetWidth}px`;
  pill.style.height = `${on.offsetHeight}px`;
  pill.style.transform = `translate(${on.offsetLeft}px, ${on.offsetTop}px)`;
  if (fresh) requestAnimationFrame(() => requestAnimationFrame(() => { pill.style.transition = ''; }));
}

/** A soft light follows the pointer over cards and demos, and cards lean toward it. */
export function pointerLight(root) {
  if (reduced() || typeof matchMedia !== 'function' || !matchMedia('(hover: hover) and (pointer: fine)').matches) return () => {};
  let raf = 0, ev = null;
  const move = (e) => {
    ev = e;
    if (raf) return;
    raf = requestAnimationFrame(() => {
      raf = 0;
      const el = ev.target.closest?.('.mtl-card, .mtl-demo, .mtl-hero');
      if (!el || !root.contains(el)) return;
      const r = el.getBoundingClientRect();
      const x = (ev.clientX - r.left) / r.width, y = (ev.clientY - r.top) / r.height;
      el.style.setProperty('--gx', `${(x * 100).toFixed(1)}%`);
      el.style.setProperty('--gy', `${(y * 100).toFixed(1)}%`);
      if (el.classList.contains('mtl-card')) {
        el.style.setProperty('--rx', `${((0.5 - y) * 7).toFixed(2)}deg`);
        el.style.setProperty('--ry', `${((x - 0.5) * 9).toFixed(2)}deg`);
      }
    });
  };
  const leave = (e) => {
    const el = e.target.closest?.('.mtl-card');
    if (el && !el.contains(e.relatedTarget)) { el.style.setProperty('--rx', '0deg'); el.style.setProperty('--ry', '0deg'); }
  };
  root.addEventListener('pointermove', move, { passive: true });
  root.addEventListener('pointerout', leave, { passive: true });
  return () => { root.removeEventListener('pointermove', move); root.removeEventListener('pointerout', leave); cancelAnimationFrame(raf); };
}
