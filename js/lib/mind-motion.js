/* ============================================================
   TOOLBOX — Mind: motion

   Every piece of content in Mind has an entrance. When a view is
   drawn, each block (headings, cards, rooms, objects, map nodes,
   sense orbs, editor fields) is marked as a unit with a kind of
   movement; an observer reveals the units as they come into view,
   one after another.  Titles rise word by word, stat numbers
   count up, cards lift with perspective tilt, orbit rings draw in,
   map nodes pop and connection lines stroke in.

   css/mind.css turns the classes into movement.  Only transform,
   opacity and clip-path move; nothing loops.  Reduced motion
   shows everything at once.  All easing is Apple-like smooth
   deceleration; nothing bounces.
   ============================================================ */

import { RevealMotion, splitWords, countUp, pointerLight, flip } from './reveal-motion.js';

const reduced = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

/* [selector, kind]. First match wins. Kinds are styled as .rv-u[data-rv="kind"]. */
const UNITS = [
  ['.mind-scene-heading h2', 'title'],
  ['.mind-self', 'widget'],
  ['.mind-object', 'card'],
  ['.mind-sense-chapter', 'panel'],
  ['.mind-sense-bars button', 'pop'],
  ['.mind-detail > .mind-editor', 'panel'],
  ['.mind-detail > .mind-related', 'panel'],
  ['.mind-editor label', 'li'],
  ['.mind-editor-actions', 'pop'],
  ['.mind-related button', 'row'],
  ['.mind-map-node', 'pop'],
  ['.mind-scene-actions', 'pop'],
  ['.mind-scene-heading small, .mind-eyebrow', 'fade'],
  ['.mind-scene-heading p, .mind-empty', 'up'],
  ['.mind-path', 'fade'],
  ['p', 'up'],
];

const ATOMIC = '.mind-object, .mind-self, .mind-sense-bars button, .mind-editor label, .mind-related button, .mind-map-node, .mind-scene-actions, .mind-path, .mind-sense-chapter, p, .mind-editor-actions';

export class MindMotion {
  constructor(root) {
    this.root = root;
    this.rv = new RevealMotion(root, {
      units: UNITS,
      atomic: ATOMIC,
      titles: '.mind-scene-heading h2',
      fill: '.mind-fill',
      fillClass: 'in',
      skip: '.mind-modes',
      /* Longer hold times so the entrance is fully visible before cleanup. */
      hold: { widget: 2800, title: 2200, panel: 2400, card: 1800 },
    });
    this.timers = new Set();
  }

  get off() { return reduced(); }

  /**
   * Marks every unit in `scope` and starts the entrance cascade.
   * mode: 'forward' | 'back' | 'up' | 'search' | 'now'
   */
  enter(scope, { mode = 'up' } = {}) {
    if (!scope) return;
    if (this.off) {
      // Reduced motion: fill everything, count up, show immediately.
      scope.querySelectorAll('.mind-fill').forEach(n => n.classList.add('in'));
      scope.querySelectorAll('[data-count]').forEach(countUp);
      this.animateOrbit(scope);
      this.drawConnections(scope);
      return;
    }
    this.rv.enter(scope, { mode });
    // Orbit rings draw in.
    this.animateOrbit(scope);
    // Map connection lines draw in.
    this.drawConnections(scope);
    // Sweep sheen across panels.
    this.sweepPanels(scope);
  }

  /** Animates the orbit rings (::before/::after) scaling in. */
  animateOrbit(scope) {
    const orbit = scope.querySelector('.mind-orbit');
    if (!orbit) return;
    if (this.off) { orbit.classList.add('mind-orbit-drawn'); return; }
    this.later(() => orbit.classList.add('mind-orbit-drawn'), 350);
  }

  /** Draws SVG map connection lines by triggering the stroke animation. */
  drawConnections(scope) {
    const lines = scope.querySelectorAll('.mind-map-field svg line');
    if (!lines.length) return;
    if (this.off) { lines.forEach(l => l.classList.add('drawn')); return; }
    lines.forEach((l, i) => {
      this.later(() => l.classList.add('drawn'), 400 + i * 45);
    });
  }

  /** Adds a sweep sheen to panels on arrival. */
  sweepPanels(scope) {
    if (this.off) return;
    scope.querySelectorAll('.mind-object, .mind-self').forEach(el => {
      if (!el.classList.contains('mind-swept')) {
        el.classList.add('mind-swept');
      }
    });
  }

  /** Replays entrances inside a section. */
  repaint(scope) {
    if (this.off || !scope) return;
    this.rv.repaint(scope);
  }

  /** Measures positions before a DOM change for FLIP animation. */
  flip(root, opts) {
    return flip(root, opts);
  }

  later(fn, ms) {
    const t = setTimeout(() => { this.timers.delete(t); fn(); }, ms);
    this.timers.add(t);
  }

  reset() {
    this.rv.reset();
    this.timers.forEach(clearTimeout);
    this.timers.clear();
  }
}

/**
 * Slides the pill behind the active mode button.
 * @param {Element} group  The .mind-modes container
 * @param {string} [selector]  Selector for the active button
 */
export function movePill(group, selector = '.active') {
  if (!group) return;
  let pill = group.querySelector(':scope > .mind-pill');
  const fresh = !pill;
  if (fresh) {
    pill = document.createElement('span');
    pill.className = 'mind-pill';
    pill.setAttribute('aria-hidden', 'true');
    pill.style.transition = 'none';
    group.prepend(pill);
  }
  const on = group.querySelector(selector);
  if (!on) { pill.style.opacity = '0'; return; }
  pill.style.opacity = '1';
  pill.style.width = `${on.offsetWidth}px`;
  pill.style.height = `${on.offsetHeight}px`;
  pill.style.transform = `translate(${on.offsetLeft}px, ${on.offsetTop}px)`;
  if (fresh) requestAnimationFrame(() => requestAnimationFrame(() => { pill.style.transition = ''; }));
}

/** Cursor-following spotlight & 3D tilt for Mind cards. */
export function mindPointerLight(root) {
  return pointerLight(root,
    '.mind-object, .mind-room, .mind-self, .mind-map-node',
    '.mind-object, .mind-room'
  );
}
