/* ============================================================
   TOOLBOX — Morphing panels

   A results panel that changes size and shape with its contents
   instead of jumping: run the change through morph(), and the panel
   eases from its old height and corner radius to the new ones while
   the new rows fade in. Fewer rows make a rounder, smaller shape;
   more rows make a taller, squarer one.
   ============================================================ */

const reduced = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
const EASE = 'cubic-bezier(.22, 1, .36, 1)';

/** Corner radius for a panel of this height: compact panels read as pills, tall ones as sheets. */
export const radiusFor = (h) => (h <= 0 ? 22 : h < 64 ? 22 : h < 140 ? 19 : 16);

/**
 * @param {HTMLElement} panel  the element whose size follows its content
 * @param {() => void} change  replaces the content
 * @param {{ rows?: string, shape?: boolean }} [o]  rows that fade in; whether the corners morph too
 */
export function morph(panel, change, { rows = '', shape = true } = {}) {
  const wasHidden = panel.hidden || !panel.offsetHeight;
  const from = wasHidden ? 0 : panel.getBoundingClientRect().height;
  panel.getAnimations?.().forEach(a => a.cancel());
  change();
  const to = panel.hidden ? 0 : panel.getBoundingClientRect().height;
  if (shape) panel.style.borderRadius = `${radiusFor(to)}px`;
  if (reduced() || !panel.animate || panel.hidden || Math.abs(to - from) < 1) return;
  const frame = (h, o) => (shape ? { height: `${h}px`, borderRadius: `${radiusFor(h)}px`, opacity: o } : { height: `${h}px`, opacity: o });
  panel.animate([frame(from, wasHidden ? 0 : 1), frame(to, 1)], { duration: wasHidden ? 260 : 320, easing: EASE });
  if (rows) {
    panel.querySelectorAll(rows).forEach((row, i) => {
      row.animate?.([{ opacity: 0, transform: 'translateY(-3px)' }, { opacity: 1, transform: 'none' }], { duration: 220, delay: Math.min(i, 8) * 16, easing: EASE, fill: 'backwards' });
    });
  }
}

/** Shrinks a panel away, then hides it. */
export function collapse(panel) {
  if (panel.hidden) return;
  const h = panel.getBoundingClientRect().height;
  const done = () => { panel.hidden = true; };
  if (reduced() || !panel.animate || !h) { done(); return; }
  panel.getAnimations?.().forEach(a => a.cancel());
  // If new results arrive mid-collapse the animation is cancelled and the panel stays.
  panel.animate([{ height: `${h}px`, opacity: 1 }, { height: '0px', opacity: 0 }], { duration: 180, easing: 'cubic-bezier(.4, 0, 1, 1)' }).finished.then(done, () => {});
}
