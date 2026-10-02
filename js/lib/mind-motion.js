/* ============================================================
   TOOLBOX — Mind: motion

   Motion in Mind explains where you are. Mind is a place: you sit
   at the centre, rooms orbit you, things live in rooms and on
   desks. So moving around it behaves like a camera:

   - Going in (a room, a desk, a thing) zooms toward what you
     tapped, and that card grows into the page it opens.
   - Going back zooms out, and the page shrinks into its card in
     the view you return to, so you can see where you came from.
   - Space, Map and Sense sit side by side; switching slides.
   - Changes inside a view (search, save, connect) never replay
     the page: cards that stay glide to their new places, new
     ones pop in and removed ones fade out where they were.
   - On the map, focusing a thing pulls it to the centre and its
     connections forward, in place.

   Entrances reuse the reveal engine the content tools share
   (lib/reveal-motion.js), so Mind feels like the rest of Toolbox.
   Only transform and opacity move. Reduced motion shows every
   state at once.
   ============================================================ */

import { RevealMotion, pointerLight } from './reveal-motion.js';

const reduced = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
const narrow = () => typeof matchMedia === 'function' && matchMedia('(max-width: 760px)').matches;
const GLIDE = 'cubic-bezier(.16, 1, .3, 1)';
const LEAVE_EASE = 'cubic-bezier(.4, 0, 1, 1)';
const quart = t => 1 - Math.pow(1 - t, 4);
/* Without the Web Animations API (older engines, test DOMs) every state is shown at once. */
const animates = () => typeof Element !== 'undefined' && typeof Element.prototype.animate === 'function';
const cssEscape = s => (globalThis.CSS?.escape ? CSS.escape(s) : String(s).replace(/["\\]/g, '\\$&'));

/* [selector, kind]. First match wins. Kinds are styled in css/motion.css. */
const UNITS = [
  ['.mind-scene-heading h2', 'title'],
  ['.mind-badge', 'pop'],
  ['.mind-self', 'widget'],
  ['.mind-object', 'card'],
  ['.mind-bubbles button', 'pop'],
  ['.mind-map-node', 'pop'],
  ['.mind-stat', 'up'],
  ['.mind-capture', 'up'],
  ['.mind-editor .mind-field, .mind-editor-actions, .mind-more', 'up'],
  ['.mind-link-row, .mind-chip', 'row'],
  ['.mind-panel', 'panel'],
  ['.mind-scene-actions', 'up'],
  ['.mind-scene-heading small, .mind-section-head', 'fade'],
  ['.mind-scene-heading p, .mind-empty, .mind-hint, .mind-map-foot, .mind-suggestion, .mind-legend, .mind-filters', 'up'],
];
const ATOMIC = '.mind-object, .mind-self, .mind-bubbles button, .mind-editor .mind-field, .mind-link-row, .mind-chip, .mind-map-node, .mind-scene-actions, .mind-editor-actions, .mind-suggestion, .mind-stat, .mind-capture, .mind-more, .mind-badge';

/* How the outgoing and incoming views move for each kind of travel. */
const LEAVE = {
  in: 'scale(1.04)', out: 'scale(.96)', next: 'translateX(-28px)', prev: 'translateX(28px)', swap: 'none',
};
const ARRIVE = {
  first: ['translateY(16px)', 620], in: ['scale(.965)', 480], out: ['scale(1.035)', 480],
  next: ['translateX(36px)', 440], prev: ['translateX(-36px)', 440], swap: ['none', 200],
};

export class MindMotion {
  constructor(root) {
    this.root = root;
    this.rv = new RevealMotion(root, {
      units: UNITS,
      atomic: ATOMIC,
      titles: '.mind-scene-heading h2',
      skip: '.mind-kept',
      hold: { widget: 2200, title: 1700 },
    });
    this.timers = new Set();
    this.ghosts = new Set();
    this.leaving = null;
    this.lineFrame = 0;
  }

  get off() { return reduced() || !animates(); }

  /* ---------- leaving the current view ---------- */

  /** Fades the current view out toward `rect` (what was tapped). Resolves when it has gone. */
  leave(scene, kind, rect) {
    if (this.off || !scene.firstElementChild || !(kind in LEAVE)) return Promise.resolve();
    if (this.leaving) return this.leaving.finished.catch(() => {});
    scene.style.transformOrigin = this.originIn(scene, rect);
    this.leaving = scene.animate(
      [{ opacity: 1, transform: 'none' }, { opacity: 0, transform: LEAVE[kind] }],
      { duration: kind === 'swap' ? 110 : 190, easing: LEAVE_EASE, fill: 'forwards' },
    );
    return this.leaving.finished.catch(() => {});
  }

  originIn(scene, rect) {
    if (!rect) return '50% 0';
    const s = scene.getBoundingClientRect();
    return `${Math.round(rect.left + rect.width / 2 - s.left)}px ${Math.round(rect.top + rect.height / 2 - s.top)}px`;
  }

  /** Lifts the tapped card out of the view so it can grow into the next page. */
  lift(el) {
    if (this.off || !el?.isConnected) return null;
    const rect = el.getBoundingClientRect();
    if (!rect.width || !rect.height) return null;
    const ghost = this.ghost(el, rect);
    el.style.visibility = 'hidden';
    return { ghost, rect };
  }

  /** Drops a lifted card whose page was never drawn (another tap came first). */
  drop(morph) {
    if (!morph) return;
    morph.ghost.remove();
    this.ghosts.delete(morph.ghost);
  }

  /* ---------- arriving ---------- */

  /**
   * Draws the entrance of a freshly rendered view.
   * kind: 'first' | 'in' | 'out' | 'next' | 'prev' | 'swap' | 'update'
   * morph: the lifted card (kind 'in'); from: the old heading's rect and back: the id
   * we came out of (kind 'out'); before: a snapshot of keyed parts (kind 'update').
   */
  enter(scene, kind, { morph = null, from = null, back = null, before = null } = {}) {
    if (this.leaving) { this.leaving.cancel(); this.leaving = null; }
    if (kind === 'update') { this.update(scene, before); this.lines(scene, true); this.orbit(scene, true); return null; }

    // The card we came out of takes its place without an entrance: the old page shrinks into it.
    let target = null;
    if (kind === 'out' && back) {
      const id = cssEscape(back);
      target = scene.querySelector(`.mind-object[data-open-room="${id}"], .mind-object[data-open-entity="${id}"], .mind-related [data-open-entity="${id}"], .mind-map-node[data-map-focus="${id}"], .mind-bubbles [data-open-room="${id}"]`);
      if (target) {
        const r = target.getBoundingClientRect();
        if (r.bottom < 0 || r.top > innerHeight) target.scrollIntoView({ block: 'center', behavior: 'auto' });
        target.classList.add('rv-arrived', 'mind-kept');
      }
    }

    if (!this.off) this.emerge(scene, kind, target);
    this.rv.enter(scene, { mode: kind === 'first' ? 'full' : 'quick' });
    this.lines(scene, this.off);
    this.orbit(scene, this.off);
    if (this.off) return target;

    // Camera: the whole view settles in from the direction of travel.
    const [transform, duration] = ARRIVE[kind] || ARRIVE.swap;
    const targetRect = target?.getBoundingClientRect();
    const heading = scene.querySelector('.mind-scene-heading');
    const headRect = kind === 'in' ? heading?.getBoundingClientRect() : null;
    scene.style.transformOrigin = kind === 'out' ? this.originIn(scene, targetRect) : '50% 0';
    scene.animate([{ opacity: 0, transform }, { opacity: 1, transform: 'none' }], { duration, easing: GLIDE });

    if (morph && headRect) this.grow(morph, headRect);
    else this.drop(morph);
    if (from && target) this.shrink(from, target, targetRect);
    return target;
  }

  /** In: the tapped card grows into the new page's heading, then dissolves into it. */
  grow({ ghost, rect }, to) {
    [...ghost.children].forEach(c => c.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 160, fill: 'forwards' }));
    const box = r => ({ left: `${r.left}px`, top: `${r.top}px`, width: `${r.width}px`, height: `${r.height}px` });
    const a = ghost.animate([
      { ...box(rect), opacity: 1 },
      { ...box(to), opacity: 0.9, offset: 0.72 },
      { ...box(to), opacity: 0 },
    ], { duration: 560, easing: GLIDE, fill: 'forwards' });
    this.retire(ghost, a);
  }

  /** Out: the page shrinks back into the card it was opened from. */
  shrink(from, target, to) {
    const ghost = this.ghost(target, to);
    target.style.opacity = '0'; // not visibility: it keeps keyboard focus meanwhile
    const box = r => ({ left: `${r.left}px`, top: `${r.top}px`, width: `${r.width}px`, height: `${r.height}px` });
    [...ghost.children].forEach(c => c.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 260, delay: 200, easing: 'ease-out', fill: 'backwards' }));
    const a = ghost.animate([
      { ...box(from), opacity: 0 },
      { opacity: 1, offset: 0.3 },
      { ...box(to), opacity: 1 },
    ], { duration: 520, easing: GLIDE, fill: 'forwards' });
    const show = () => { target.style.opacity = ''; };
    a.finished.then(show, show);
    this.retire(ghost, a);
  }

  /** Home: rooms leave the centre and settle into orbit around you. */
  emerge(scene, kind, skip) {
    const orbit = scene.querySelector('.mind-orbit');
    if (!orbit || narrow()) return;
    const o = orbit.getBoundingClientRect();
    const cx = o.left + o.width / 2, cy = o.top + o.height / 2;
    const slow = kind === 'first';
    orbit.querySelectorAll('.mind-room').forEach((room, i) => {
      room.classList.add('rv-arrived');
      if (room === skip) return;
      const r = room.getBoundingClientRect();
      const dx = cx - (r.left + r.width / 2), dy = cy - (r.top + r.height / 2);
      room.animate([
        { opacity: 0, transform: `translate(${dx}px, ${dy}px) scale(.4)` },
        { opacity: 1, transform: 'none' },
      ], { duration: slow ? 900 : 620, delay: (slow ? 260 : 80) + i * (slow ? 80 : 45), easing: GLIDE, fill: 'backwards' });
    });
  }

  /** Orbit rings draw in once the centre has arrived. */
  orbit(scene, now) {
    const orbit = scene.querySelector('.mind-orbit');
    if (!orbit) return;
    if (now) orbit.classList.add('mind-orbit-drawn');
    else this.later(() => orbit.classList.add('mind-orbit-drawn'), 160);
  }

  /** Map lines draw outward from the focused thing, nearest first. */
  lines(scene, now) {
    const lines = scene.querySelectorAll('.mind-map-field line, .mind-tethers line');
    if (now) { lines.forEach(l => l.classList.add('drawn')); return; }
    lines.forEach((l, i) => this.later(() => l.classList.add('drawn'), 260 + Math.min(i, 30) * 28));
  }

  /* ---------- changes inside a view ---------- */

  /** Records where every keyed part of the view is, before it is redrawn. */
  snapshot(scene) {
    const map = new Map();
    if (this.off) return map;
    scene.querySelectorAll('[data-key]').forEach(el => map.set(el.dataset.key, { el, rect: el.getBoundingClientRect() }));
    return map;
  }

  /** Parts that stayed glide to their new place, new parts pop in, removed parts fade where they were. */
  update(scene, before) {
    scene.querySelectorAll('.mind-object, .mind-map-node').forEach(el => el.classList.add('rv-arrived'));
    if (this.off || !before) return;
    let fresh = 0;
    scene.querySelectorAll('[data-key]').forEach(el => {
      const was = before.get(el.dataset.key);
      if (was) {
        before.delete(el.dataset.key);
        const now = el.getBoundingClientRect();
        const dx = was.rect.left - now.left, dy = was.rect.top - now.top;
        if (Math.abs(dx) > 1 || Math.abs(dy) > 1) {
          el.animate([{ transform: `translate(${dx}px, ${dy}px)` }, { transform: 'none' }], { duration: 460, easing: GLIDE });
        }
      } else {
        el.animate([
          { opacity: 0, transform: 'translateY(10px) scale(.96)' },
          { opacity: 1, transform: 'none' },
        ], { duration: 380, delay: Math.min(fresh++, 10) * 32, easing: GLIDE, fill: 'backwards' });
      }
    });
    before.forEach(({ el, rect }) => {
      if (!rect.width || rect.bottom < 0 || rect.top > innerHeight) return;
      const ghost = this.ghost(el, rect);
      this.retire(ghost, ghost.animate([{ opacity: 1, transform: 'none' }, { opacity: 0, transform: 'scale(.94)' }], { duration: 200, easing: LEAVE_EASE, fill: 'forwards' }));
    });
  }

  /** Map: moves every line's ends to the new places of its two things, in step with the nodes. */
  moveLines(field, place) {
    cancelAnimationFrame(this.lineFrame);
    const keys = ['x1', 'y1', 'x2', 'y2'];
    const plan = [...field.querySelectorAll('line[data-a]')].map(l => {
      const a = place(l.dataset.a), b = place(l.dataset.b);
      return a && b ? { l, from: keys.map(k => Number(l.getAttribute(k))), to: [a.x, a.y, b.x, b.y] } : null;
    }).filter(Boolean);
    const set = (t) => plan.forEach(({ l, from, to }) => keys.forEach((k, i) => l.setAttribute(k, (from[i] + (to[i] - from[i]) * t).toFixed(2))));
    if (this.off) { set(1); return; }
    const start = performance.now(), duration = 700;
    const tick = (now) => {
      const t = Math.min(1, (now - start) / duration);
      set(quart(t));
      if (t < 1) this.lineFrame = requestAnimationFrame(tick);
    };
    this.lineFrame = requestAnimationFrame(tick);
  }

  /** Finishes any entrance still running in `scope`, so the parts can move freely. */
  settle(scope) {
    scope.querySelectorAll('.rv-u').forEach(el => {
      el.classList.remove('rv-u', 'is-in', 'is-quick');
      el.style.removeProperty('--rv-d');
      delete el.dataset.rv; delete el.dataset.rvQuick;
      el.classList.add('rv-arrived');
    });
    scope.querySelectorAll('.mind-map-field line').forEach(l => l.classList.add('drawn'));
  }

  /* ---------- ghosts: fixed copies that carry a card between views ---------- */

  layer() {
    let layer = document.querySelector('body > .mind-layer');
    if (!layer) {
      layer = document.createElement('div');
      layer.className = 'mind-layer';
      layer.setAttribute('aria-hidden', 'true');
      document.body.append(layer);
    }
    return layer;
  }

  ghost(el, rect) {
    const g = el.cloneNode(true);
    g.removeAttribute('id');
    g.removeAttribute('data-key');
    g.classList.remove('rv-u', 'is-in', 'is-quick', 'mind-kept');
    delete g.dataset.rv;
    g.classList.add('mind-ghost');
    g.inert = true;
    g.style.cssText = `position:fixed;left:${rect.left}px;top:${rect.top}px;width:${rect.width}px;height:${rect.height}px;margin:0;transform:none;translate:none;transition:none;animation:none;visibility:visible;box-sizing:border-box;`;
    this.layer().append(g);
    this.ghosts.add(g);
    return g;
  }

  retire(ghost, animation) {
    const done = () => { ghost.remove(); this.ghosts.delete(ghost); };
    animation.finished.then(done, done);
  }

  later(fn, ms) {
    const t = setTimeout(() => { this.timers.delete(t); fn(); }, ms);
    this.timers.add(t);
  }

  /** Stops everything in flight before a view is redrawn. */
  reset() {
    this.rv.reset();
    this.timers.forEach(clearTimeout);
    this.timers.clear();
    cancelAnimationFrame(this.lineFrame);
  }

  /** Removes cards still travelling from an earlier change. */
  clearGhosts() {
    this.ghosts.forEach(g => g.remove());
    this.ghosts.clear();
  }

  destroy() {
    this.reset();
    this.clearGhosts();
    this.leaving?.cancel();
    this.leaving = null;
    document.querySelector('body > .mind-layer')?.remove();
  }
}

/**
 * Slides the pill behind the active mode button. The bar stays on screen
 * between views, so the pill glides from the old mode to the new one.
 */
export function movePill(group, selector = '.active') {
  if (!group) return;
  let pill = group.querySelector(':scope > .mind-pill');
  const fresh = !pill;
  if (fresh) {
    pill = document.createElement('span');
    pill.className = 'mind-pill';
    pill.setAttribute('aria-hidden', 'true');
    group.prepend(pill);
  }
  const on = group.querySelector(selector);
  if (!on || !on.offsetWidth) { pill.style.opacity = '0'; return; }
  if (fresh) pill.style.transition = 'none';
  pill.style.opacity = '1';
  pill.style.width = `${on.offsetWidth}px`;
  pill.style.height = `${on.offsetHeight}px`;
  pill.style.transform = `translate(${on.offsetLeft}px, ${on.offsetTop}px)`;
  if (fresh) { void pill.offsetWidth; pill.style.transition = ''; }
}

/** Cursor-following spotlight & gentle tilt for Mind cards. */
export function mindPointerLight(root) {
  return pointerLight(root,
    '.mind-object, .mind-self, .mind-map-node, .mind-panel',
    '.mind-object',
  );
}
