/* ============================================================
   TOOLBOX — Suggestion thread (Home search on phones)

   The suggestions keep their plain list shape and live under the
   search field. They slide out from beneath the field when they
   first appear; as the query narrows, a suggestion that no longer
   fits slides up into the nearest one above it that still does (or
   back into the field when it was the first), and the ones below
   close the gap. New suggestions slide out from under the row above
   them. Clearing the query draws them all back into the field.

   Rows are keyed (data-key), so a row that stays is the same element
   throughout: it only moves. Only transform and opacity animate, all
   measurements are read before anything is written, and interrupted
   motion continues from where it visibly is, so fast typing never
   jumps or stalls a frame.
   ============================================================ */

import { morphHtml } from './dom-morph.js';

const EASE = 'cubic-bezier(.22, 1, .36, 1)';
const IN = 'cubic-bezier(.4, 0, .9, .6)';
const MOVE = 210;        // a row closing a gap
const EMERGE = 230;      // a row sliding out
const MERGE = 190;       // a row sliding into the one above

const reduced = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

export function createSuggestionThread({ list, field }) {
  const rows = () => [...list.children].filter(n => n.classList?.contains('hero-dd-row') && !n.classList.contains('is-ghost'));
  const thread = () => list.querySelector(':scope > .hero-dd-thread');
  let closing = null;

  /** Distance from a row's top to the point where it is fully tucked under the field. */
  const tuck = (top, h) => {
    const gap = list.getBoundingClientRect().top - field.getBoundingClientRect().bottom;
    return -(top + h + Math.max(0, gap));
  };

  function snapshot() {
    const lt = list.getBoundingClientRect().top;
    const out = new Map();
    for (const r of rows()) {
      const box = r.getBoundingClientRect();
      out.set(r.dataset.key, { el: r, top: box.top - lt, h: box.height, opacity: Number(getComputedStyle(r).opacity) || 0 });
    }
    const t = thread();
    return { rows: out, threadH: t ? t.getBoundingClientRect().height : 0 };
  }

  function paint(html) {
    if (closing) { closing.cancel(); closing = null; }
    const opening = list.hidden || !rows().length;
    const content = `<span class="hero-dd-thread" data-key="thread" aria-hidden="true"></span>${html}`;
    if (opening || reduced()) {
      list.innerHTML = '';
      list.hidden = false;
      morphHtml(list, content);
      if (!reduced()) emergeAll();
      return;
    }

    const tpl = document.createElement('template');
    tpl.innerHTML = content;
    const nextOrder = [...tpl.content.querySelectorAll(':scope > .hero-dd-row[data-key]')].map(n => n.dataset.key);
    // Same suggestions in the same order (only a description changed): patch the text, leave the motion alone.
    if (nextOrder.join('\n') === rows().map(r => r.dataset.key).join('\n')) { morphHtml(list, content); return; }
    const newKeys = new Set(nextOrder);

    // 1. Read: where everything is right now, mid-animation included.
    const before = snapshot();
    const oldOrder = [...before.rows.keys()];

    // 2. Rows that no longer fit leave the flow as ghosts, held where they are.
    const ghosts = [];
    oldOrder.forEach((key, i) => {
      if (newKeys.has(key)) return;
      const { el, top, opacity } = before.rows.get(key);
      el.getAnimations().forEach(a => a.cancel());
      el.classList.add('is-ghost');
      el.removeAttribute('data-key');
      el.dataset.morphKeep = '';
      el.setAttribute('aria-hidden', 'true');
      el.tabIndex = -1;
      el.style.top = `${top}px`;
      // The nearest row above it that stays is where it goes.
      let absorber = null;
      for (let j = i - 1; j >= 0; j--) if (newKeys.has(oldOrder[j])) { absorber = oldOrder[j]; break; }
      ghosts.push({ el, top, opacity, absorber });
    });

    // 3. Write: the new list (rows that stay are patched in place, not rebuilt).
    morphHtml(list, content);

    // 4. Read the new layout, then play everything from where it was.
    const now = rows();
    const layout = new Map(now.map(r => [r.dataset.key, { el: r, top: r.offsetTop, h: r.offsetHeight }]));
    const t = thread();
    const threadTo = t ? t.offsetHeight : 0;

    now.forEach((r, i) => {
      const key = r.dataset.key;
      const was = before.rows.get(key);
      const at = layout.get(key);
      if (was) {
        const dy = was.top - at.top;
        r.getAnimations().forEach(a => a.cancel());
        if (Math.abs(dy) > 0.5 || was.opacity < 0.99) {
          r.animate([{ transform: `translateY(${dy}px)`, opacity: was.opacity }, { transform: 'none', opacity: 1 }], { duration: MOVE, easing: EASE, tempo: false });
        }
        return;
      }
      // New: out from under the nearest row above that was already there, or from the field.
      let anchor = null;
      for (let j = i - 1; j >= 0; j--) if (before.rows.has(now[j].dataset.key)) { anchor = layout.get(now[j].dataset.key); break; }
      const from = anchor ? anchor.top - at.top : tuck(at.top, at.h);
      r.animate([{ transform: `translateY(${from}px)`, opacity: 0 }, { transform: 'none', opacity: 1 }], { duration: EMERGE, easing: EASE, tempo: false, fill: 'backwards' });
    });

    for (const g of ghosts) {
      const target = g.absorber && layout.has(g.absorber) ? layout.get(g.absorber).top : tuck(0, g.el.offsetHeight);
      const a = g.el.animate([
        { transform: 'none', opacity: g.opacity },
        { transform: `translateY(${(target - g.top) * 0.7}px) scale(.985)`, opacity: 0, offset: 0.72 },
        { transform: `translateY(${target - g.top}px) scale(.97)`, opacity: 0 },
      ], { duration: MERGE, easing: IN, tempo: false, fill: 'forwards' });
      a.finished.then(() => g.el.remove(), () => g.el.remove());
    }

    if (t && before.threadH && threadTo && Math.abs(before.threadH - threadTo) > 0.5) {
      t.getAnimations().forEach(a => a.cancel());
      t.animate([{ transform: `scaleY(${before.threadH / threadTo})` }, { transform: 'none' }], { duration: MOVE, easing: EASE, tempo: false });
    }
  }

  /** First appearance: the list slides down out from under the field as one sheet, so rows never cross. */
  function emergeAll() {
    const all = rows();
    if (!all.length) return;
    const last = all[all.length - 1];
    const from = tuck(last.offsetTop, last.offsetHeight);
    all.forEach((r) => {
      r.animate([{ transform: `translateY(${from}px)`, opacity: 0 }, { opacity: 1, offset: 0.55 }, { transform: 'none', opacity: 1 }],
        { duration: EMERGE + 30, easing: EASE, tempo: false, fill: 'backwards' });
    });
    thread()?.animate([{ transform: 'scaleY(0)' }, { transform: 'none' }], { duration: EMERGE + 30, easing: EASE, tempo: false });
  }

  /** The sheet slides back up into the field, then the list hides. */
  function retract() {
    if (list.hidden) return;
    list.querySelectorAll(':scope > .is-ghost').forEach(g => g.remove());
    const all = rows();
    if (reduced() || !all.length) { clear(); return; }
    const lt = list.getBoundingClientRect().top;
    const plan = all.map(r => { const b = r.getBoundingClientRect(); return { r, dy: b.top - lt - r.offsetTop, opacity: Number(getComputedStyle(r).opacity) || 0 }; });
    const last = all[all.length - 1];
    const to = tuck(last.offsetTop, last.offsetHeight);
    const anims = plan.map(({ r, dy, opacity }) => {
      r.getAnimations().forEach(a => a.cancel());
      r.style.pointerEvents = 'none';
      return r.animate([{ transform: `translateY(${dy}px)`, opacity }, { opacity: Math.min(opacity, 0.9), offset: 0.5 }, { transform: `translateY(${to}px)`, opacity: 0 }],
        { duration: MERGE + 20, easing: IN, tempo: false, fill: 'forwards' });
    });
    const t = thread();
    if (t) { t.getAnimations().forEach(a => a.cancel()); anims.push(t.animate([{ transform: 'none' }, { transform: 'scaleY(0)' }], { duration: MERGE + 20, easing: IN, tempo: false, fill: 'forwards' })); }
    // A timer, not the animations' promises: a row removed mid-flight would never settle them.
    const timer = setTimeout(() => { closing = null; clear(); }, MERGE + 40);
    closing = { cancel: () => { clearTimeout(timer); anims.forEach(a => a.cancel()); all.forEach(r => { r.style.pointerEvents = ''; }); } };
  }

  function clear() {
    if (closing) { closing.cancel(); closing = null; }
    list.hidden = true;
    list.innerHTML = '';
  }

  return { paint, retract, clear, get isOpen() { return !list.hidden; } };
}
