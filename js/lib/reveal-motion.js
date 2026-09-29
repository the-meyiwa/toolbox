/* ============================================================
   TOOLBOX — Reveal motion

   The Music Theory Library's entrance engine, made reusable. A tool
   describes its content as [selector, kind] pairs; when a view is
   drawn, every matching block is marked as a unit and revealed as
   it comes into view, one after another. Headlines rise word by
   word, numbers count up, bars and rings fill once their unit has
   arrived. css/motion.css styles the kinds (.rv-u[data-rv="…"]).

   Only transform, opacity and clip-path move; nothing loops.
   Reduced motion shows everything at once, already filled.
   ============================================================ */

const reduced = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
const escapeText = (t) => t.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c]);

/** Wraps each word of a headline in its own mask so the words can rise in turn. */
export function splitWords(el) {
  if (el.dataset.split) return;
  el.dataset.split = '1';
  let i = 0;
  const walk = (node) => [...node.childNodes].map((n) => {
    if (n.nodeType === 3) return n.textContent.split(/(\s+)/).filter(Boolean).map((w) => (/^\s+$/.test(w) ? ' ' : `<span class="rv-w"><span style="--wi:${i++}">${escapeText(w)}</span></span>`)).join('');
    if (n.nodeType !== 1) return '';
    const cls = n.getAttribute('class');
    return `<span${cls ? ` class="${cls}"` : ''}>${walk(n)}</span>`;
  }).join('');
  el.setAttribute('aria-label', el.textContent.replace(/\s+/g, ' ').trim());
  el.innerHTML = walk(el);
  [...el.children].forEach((c) => c.setAttribute('aria-hidden', 'true'));
}

/** Counts a number up from zero: data-count="87" (data-dec="1" keeps one decimal, data-prefix/data-suffix wrap it). */
export function countUp(el) {
  const to = Number(el.dataset.count);
  if (!Number.isFinite(to)) return;
  const dec = Number(el.dataset.dec) || 0;
  const pre = el.dataset.prefix || '', suf = el.dataset.suffix || '';
  const fmt = (v) => pre + (dec ? v.toFixed(dec) : Math.round(v).toLocaleString('en-US')) + suf;
  if (reduced() || typeof requestAnimationFrame !== 'function') { el.textContent = fmt(to); return; }
  const start = performance.now(), dur = 1100;
  const tick = (now) => {
    const t = Math.min(1, (now - start) / dur);
    el.textContent = fmt(to * (1 - Math.pow(1 - t, 4)));
    if (t < 1) requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}

export class RevealMotion {
  /**
   * @param {Element} root
   * @param {object} o
   * @param {Array<[string,string]>} o.units   [selector, kind]; the first match decides the kind
   * @param {string} [o.atomic]  units never nest inside these (they move as one piece)
   * @param {string} [o.titles]  headlines split into rising words
   * @param {string} [o.fill]    bars, rings and meters that fill (get `fillClass`) once their unit arrives
   * @param {string} [o.fillClass]
   * @param {string} [o.skip]    never marked (sticky bars, open menus)
   * @param {Record<string,number>} [o.hold]  ms a kind keeps its reveal classes (long widgets)
   */
  constructor(root, { units, atomic = '', titles = '', fill = '', fillClass = 'in', skip = '', hold = {} } = {}) {
    this.root = root;
    this.units = units || [];
    this.selector = this.units.map(([s]) => s).join(', ');
    this.atomic = atomic;
    this.titles = titles;
    this.fill = fill;
    this.fillClass = fillClass;
    this.skip = skip;
    this.hold = hold;
    this.io = null;
    this.timers = new Set();
  }

  get off() { return reduced(); }

  kindOf(el) {
    for (const [sel, kind] of this.units) if (el.matches(sel)) return kind;
    return 'up';
  }

  /** Fills bars/rings inside `el` (and `el` itself). */
  fillIn(el) {
    if (!this.fill || !el) return;
    if (el.matches?.(this.fill)) el.classList.add(this.fillClass);
    el.querySelectorAll?.(this.fill).forEach((n) => n.classList.add(this.fillClass));
  }

  /**
   * Marks every unit inside `scope` and starts revealing.
   * mode: 'forward' | 'back' | 'up' (the page slides in that way), 'quick' (search results,
   * faster wave), 'now' (already on screen: reveal before the next paint so nothing blinks).
   */
  enter(scope, { mode = 'up' } = {}) {
    if (!scope) return;
    if (this.off) {
      this.fillIn(scope);
      scope.querySelectorAll('[data-count]').forEach(countUp);
      return;
    }
    if (mode === 'forward' || mode === 'back' || mode === 'up') {
      scope.dataset.rvEnter = mode;
      const clear = () => { delete scope.dataset.rvEnter; };
      scope.addEventListener('animationend', clear, { once: true });
      this.later(clear, 900);
    }
    if (this.titles) scope.querySelectorAll(this.titles).forEach(splitWords);
    const units = [];
    const marked = new Set();
    if (this.selector) {
      const cands = [...(scope.matches?.(this.selector) && scope !== this.root ? [scope] : []), ...scope.querySelectorAll(this.selector)];
      cands.forEach((el) => {
        if (el.classList.contains('rv-u') || el.classList.contains('rv-arrived') || (this.skip && el.closest(this.skip))) return;
        const parent = this.atomic ? el.parentElement?.closest(this.atomic) : null;
        if (parent && scope.contains(parent) && parent !== el && (parent.classList.contains('rv-u') || marked.has(parent))) return;
        el.classList.add('rv-u');
        el.dataset.rv = this.kindOf(el);
        units.push(el);
        marked.add(el);
      });
    }
    // Groups of small parts (dots, cells, chips inside a widget) cascade by index.
    units.forEach((u) => { if (u.dataset.rv === 'widget') [...u.children].forEach((c, i) => c.style.setProperty('--k', i)); });
    const quick = mode === 'quick' || mode === 'now';
    if (mode === 'now' || typeof IntersectionObserver === 'undefined') {
      units.forEach((u, i) => this.show(u, i, quick));
      return;
    }
    this.io ??= new IntersectionObserver((entries) => {
      const shown = entries.filter((e) => e.isIntersecting).map((e) => e.target)
        .sort((a, b) => (a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1));
      shown.forEach((el, i) => { this.io.unobserve(el); this.show(el, i, el.dataset.rvQuick === '1'); });
    }, { rootMargin: '0px 0px -5% 0px' });
    units.forEach((u) => { if (quick) u.dataset.rvQuick = '1'; this.io.observe(u); });
  }

  /** Reveals one unit, `order` places into the current wave. */
  show(el, order, quick = false) {
    const step = quick ? 24 : 48;
    const delay = Math.min(order, quick ? 10 : 12) * step;
    el.style.setProperty('--rv-d', `${delay}ms`);
    el.classList.add('is-in');
    if (quick) el.classList.add('is-quick');
    // Bars and rings fill as their block settles; numbers count up alongside.
    this.later(() => this.fillIn(el), delay + (quick ? 80 : 180));
    el.querySelectorAll?.('[data-count]').forEach((n) => this.later(() => countUp(n), delay + 60));
    if (el.matches('[data-count]')) this.later(() => countUp(el), delay + 60);
    // Hand the element back to its own styles (hover, press) once it has arrived.
    this.later(() => {
      el.classList.remove('rv-u', 'is-in', 'is-quick');
      el.style.removeProperty('--rv-d');
      delete el.dataset.rv; delete el.dataset.rvQuick;
      el.classList.add('rv-arrived');
    }, delay + (this.hold[el.dataset.rv] || 1300));
  }

  /** New parts of a view already on screen arrive quickly. */
  repaint(scope) { this.enter(scope, { mode: 'now' }); }

  later(fn, ms) {
    const t = setTimeout(() => { this.timers.delete(t); fn(); }, ms);
    this.timers.add(t);
  }

  reset() {
    this.io?.disconnect();
    this.io = null;
    this.timers.forEach(clearTimeout);
    this.timers.clear();
  }
}

/**
 * Moves elements from where they were to where they are now (FLIP). Call `measure()` before
 * the DOM changes, then `play()` after: everything keyed by data-flip glides to its new place
 * (scale: false moves without resizing, for things whose text must not stretch).
 */
export function flip(root, { duration = 560, easing = 'cubic-bezier(.16, 1, .3, 1)', scale = true } = {}) {
  const before = new Map();
  const measure = () => {
    root?.querySelectorAll('[data-flip]').forEach((el) => before.set(el.dataset.flip, el.getBoundingClientRect()));
  };
  const play = () => {
    if (reduced() || !root) return;
    root.querySelectorAll('[data-flip]').forEach((el) => {
      const a = before.get(el.dataset.flip);
      if (!a || typeof el.animate !== 'function') return;
      const b = el.getBoundingClientRect();
      const dx = a.left - b.left, dy = a.top - b.top;
      const sx = scale && b.width ? a.width / b.width : 1, sy = scale && b.height ? a.height / b.height : 1;
      if (Math.abs(dx) < 1 && Math.abs(dy) < 1 && Math.abs(sx - 1) < 0.01 && Math.abs(sy - 1) < 0.01) return;
      el.animate([
        { transformOrigin: '0 0', transform: `translate(${dx}px, ${dy}px) scale(${sx}, ${sy})` },
        { transformOrigin: '0 0', transform: 'none' },
      ], { duration, easing });
    });
  };
  measure();
  return { measure, play };
}

/** A soft light follows the pointer over `selector`, and elements matching `tilt` lean toward it. */
export function pointerLight(root, selector, tilt = '') {
  if (reduced() || typeof matchMedia !== 'function' || !matchMedia('(hover: hover) and (pointer: fine)').matches) return () => {};
  let raf = 0, ev = null;
  const move = (e) => {
    ev = e;
    if (raf) return;
    raf = requestAnimationFrame(() => {
      raf = 0;
      const el = ev.target.closest?.(selector);
      if (!el || !root.contains(el)) return;
      const r = el.getBoundingClientRect();
      const x = (ev.clientX - r.left) / r.width, y = (ev.clientY - r.top) / r.height;
      el.style.setProperty('--gx', `${(x * 100).toFixed(1)}%`);
      el.style.setProperty('--gy', `${(y * 100).toFixed(1)}%`);
      if (tilt && el.matches(tilt)) {
        el.style.setProperty('--rx', `${((0.5 - y) * 6).toFixed(2)}deg`);
        el.style.setProperty('--ry', `${((x - 0.5) * 8).toFixed(2)}deg`);
      }
    });
  };
  const leave = (e) => {
    const el = tilt ? e.target.closest?.(tilt) : null;
    if (el && !el.contains(e.relatedTarget)) { el.style.setProperty('--rx', '0deg'); el.style.setProperty('--ry', '0deg'); }
  };
  root.addEventListener('pointermove', move, { passive: true });
  root.addEventListener('pointerout', leave, { passive: true });
  return () => { root.removeEventListener('pointermove', move); root.removeEventListener('pointerout', leave); cancelAnimationFrame(raf); };
}
