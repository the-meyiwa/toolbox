/* ============================================================
   TOOLBOX — Suggestion thread (Home search on phones)

   The suggestions keep their plain list shape and live under the
   search field. Nothing fades: every row moves.

   - First appearance: the list slides down out from under the field
     as one sheet, revealed at the field's edge.
   - A suggestion that no longer fits slides up underneath the nearest
     one above it that still fits, and is hidden by that row's edge as
     it goes; several in a row fold up together. The first row goes
     back under the field. Rows below glide up to close the gap.
   - A new suggestion slides out from under the row above it.
   - Clearing the query draws the whole list back up under the field.

   Rows are transparent, so "underneath" is drawn with a clip that
   tracks the covering edge frame by frame. Keyframes are sampled from
   the same curve for position and clip, so the two never drift apart.
   Only transform and clip-path animate; all measuring happens before
   any writing; interrupted motion continues from where rows are.
   ============================================================ */

import { morphHtml } from './dom-morph.js';

const DURATION = 440;        // rows gliding to their new place
const FOLD = 300;            // a row folding away under the one above
const ARRIVE = 420;          // a row sliding out from under the one above…
const ARRIVE_DELAY = 130;    // …once the rows leaving that spot are mostly out of sight
const OPEN = 480;            // the first slide out of the field
const CLOSE = 400;           // back under the field
const SAMPLES = 18;
const CURVE = [0.32, 0.72, 0, 1];   // a long, soft settle with no overshoot

const reduced = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

/** cubic-bezier(x1, y1, x2, y2) as a function of time. */
function bezier([x1, y1, x2, y2]) {
  const cx = 3 * x1, bx = 3 * (x2 - x1) - cx, ax = 1 - cx - bx;
  const cy = 3 * y1, by = 3 * (y2 - y1) - cy, ay = 1 - cy - by;
  const sx = (t) => ((ax * t + bx) * t + cx) * t;
  const sy = (t) => ((ay * t + by) * t + cy) * t;
  const dx = (t) => (3 * ax * t + 2 * bx) * t + cx;
  return (x) => {
    let t = x;
    for (let i = 0; i < 8; i++) { const e = sx(t) - x; const d = dx(t); if (Math.abs(e) < 1e-5 || !d) break; t -= e / d; }
    return sy(Math.min(1, Math.max(0, t)));
  };
}
const ease = bezier(CURVE);
const CSS_CURVE = `cubic-bezier(${CURVE.join(', ')})`;

/**
 * Plays one element's path: at progress p (0→1, already eased) it sits at translateY(y(p)),
 * and anything above the line edge(p) (in the element's own coordinates) is hidden.
 */
/** Keys of the longest run of `keys` whose old positions increase: the rows that can glide
    without crossing another. */
function steady(keys, oldIndex) {
  const idx = keys.map(k => oldIndex.get(k));
  const tails = [], prev = new Array(idx.length).fill(-1), at = [];
  idx.forEach((v, i) => {
    let lo = 0, hi = tails.length;
    while (lo < hi) { const m = (lo + hi) >> 1; if (idx[tails[m]] < v) lo = m + 1; else hi = m; }
    if (lo > 0) prev[i] = tails[lo - 1];
    tails[lo] = i; at[lo] = i;
  });
  const out = new Set();
  for (let i = tails.at(-1) ?? -1; i >= 0; i = prev[i]) out.add(keys[i]);
  return out;
}

/**
 * Plays one element's path. frame(p, ms) gives, at eased progress p (0→1) and time ms since this
 * motion began (delay included), the row's offset y and how much of its top is hidden (cut).
 */
function play(el, { frame, y, hideAbove, duration, delay = 0, keep = false }) {
  const at = frame || ((p) => ({ y: y(p), cut: hideAbove ? hideAbove(p) : 0 }));
  const frames = [];
  for (let i = 0; i <= SAMPLES; i++) {
    const p = ease(i / SAMPLES);
    const f = at(p, delay + (i / SAMPLES) * duration);
    frames.push({ offset: i / SAMPLES, transform: `translateY(${f.y.toFixed(2)}px)`, clipPath: `inset(${Math.max(0, f.cut).toFixed(2)}px -24px -24px -24px)` });
  }
  return el.animate(frames, { duration, delay, easing: 'linear', fill: keep ? 'forwards' : 'backwards' });
}

/** Where a row that glides from `from` to `to` (with the rows that stay) is, `ms` into the motion. */
const glideAt = (from, to, ms) => from + (to - from) * ease(Math.min(1, Math.max(0, ms / DURATION)));

export function createSuggestionThread({ list, field }) {
  const rows = () => [...list.children].filter(n => n.classList?.contains('hero-dd-row') && !n.classList.contains('is-ghost'));
  const thread = () => list.querySelector(':scope > .hero-dd-thread');
  let closing = null;

  /** The field's bottom edge in the list's coordinates (negative: it sits above the list). */
  const fieldEdge = () => field.getBoundingClientRect().bottom - list.getBoundingClientRect().top;

  /** How much of a row's top is hidden right now (it may be mid-way out from under another row). */
  const hiddenTop = (r) => { const m = /inset\(\s*([\d.]+)px/.exec(getComputedStyle(r).clipPath || ''); return m ? parseFloat(m[1]) : 0; };

  function visualTops() {
    const lt = list.getBoundingClientRect().top;
    const out = new Map();
    for (const r of rows()) { const b = r.getBoundingClientRect(); out.set(r.dataset.key, { el: r, top: b.top - lt, h: b.height, cut: hiddenTop(r) }); }
    return out;
  }

  function paint(html) {
    if (closing) { closing.cancel(); closing = null; }
    const opening = list.hidden || !rows().length;
    const content = `<span class="hero-dd-thread" data-key="thread" aria-hidden="true"></span>${html}`;
    if (opening || reduced()) {
      list.innerHTML = '';
      list.hidden = false;
      morphHtml(list, content);
      if (!reduced()) slideOut();
      return;
    }

    const tpl = document.createElement('template');
    tpl.innerHTML = content;
    // (`:scope` matches nothing in a template fragment, so read its children directly.)
    const nextOrder = [...tpl.content.children].filter(n => n.classList.contains('hero-dd-row') && n.dataset.key).map(n => n.dataset.key);
    // Same suggestions in the same order (only a description changed): patch the text, leave the motion alone.
    if (nextOrder.join('\n') === rows().map(r => r.dataset.key).join('\n')) { morphHtml(list, content); return; }
    // Rows still folding away from the last keystroke are nearly out of sight: finish them now,
    // so they never linger where new rows arrive.
    list.querySelectorAll(':scope > .is-ghost').forEach(g => g.remove());

    // 1. Read: where everything is right now, mid-motion included.
    const before = visualTops();
    const oldOrder = [...before.keys()];
    // Rows keep their order while they glide. A row that would have to cross others (it moved up
    // or down past them) folds away where it was and slides out again in its new place.
    const glide = steady(nextOrder.filter(k => before.has(k)), new Map(oldOrder.map((k, i) => [k, i])));
    const stays = glide;
    for (const k of nextOrder) {
      if (!before.has(k) || glide.has(k)) continue;
      const { el, top, h, cut } = before.get(k);
      const ghost = el.cloneNode(true);
      el.parentNode.insertBefore(ghost, el);
      before.set(`ghost:${k}`, { el: ghost, top, h, cut });
      oldOrder[oldOrder.indexOf(k)] = `ghost:${k}`;
      before.delete(k);
      el.getAnimations().forEach(a => a.cancel());
    }
    const t = thread();
    const threadFrom = t ? t.getBoundingClientRect().height : 0;
    const edgeNow = fieldEdge();

    // 2. Rows that no longer fit leave the flow as ghosts, held where they are, grouped by the
    //    row above them that stays (null: the field).
    const groups = new Map();
    oldOrder.forEach((key, i) => {
      if (stays.has(key)) return;
      const { el, top, h, cut } = before.get(key);
      el.getAnimations().forEach(a => a.cancel());
      el.style.clipPath = cut > 0.5 ? `inset(${cut}px -24px -24px -24px)` : '';
      el.classList.add('is-ghost');
      el.removeAttribute('data-key');
      el.removeAttribute('id');
      el.dataset.morphKeep = '';
      el.setAttribute('aria-hidden', 'true');
      el.tabIndex = -1;
      el.style.top = `${top}px`;
      let cover = null;
      for (let j = i - 1; j >= 0; j--) if (stays.has(oldOrder[j])) { cover = oldOrder[j]; break; }
      if (!groups.has(cover)) groups.set(cover, []);
      groups.get(cover).push({ el, top, h });
    });

    // 3. Write: the new list (rows that stay are patched in place, not rebuilt).
    morphHtml(list, content);

    // 4. Read the new layout, then play everything from where it was.
    const now = rows();
    const layout = new Map(now.map(r => [r.dataset.key, { el: r, top: r.offsetTop, h: r.offsetHeight }]));
    const edgeNext = fieldEdge();

    // Rows that stay glide to their new place.
    for (const r of now) {
      const was = before.get(r.dataset.key);
      if (!was) continue;
      const to = layout.get(r.dataset.key).top;
      const dy = was.top - to;
      r.getAnimations().forEach(a => a.cancel());
      // A row caught half-way out from under another keeps its mask and finishes revealing.
      if (Math.abs(dy) > 0.5 || was.cut > 0.5) play(r, { y: (p) => dy * (1 - p), hideAbove: was.cut > 0.5 ? (p) => was.cut * (1 - p) : null, duration: DURATION });
    }

    // Leaving rows fold up under the row above that stays, riding along with it.
    for (const [cover, members] of groups) {
      const gTop = members[0].top;
      const gBottom = members.at(-1).top + members.at(-1).h;
      const c = cover && before.get(cover);
      const edgeFrom = c ? c.top + c.h : edgeNow;
      const edgeTo = c ? layout.get(cover).top + layout.get(cover).h : edgeNext;
      const H = gBottom - gTop;
      // The group rides with the row covering it and ends with its bottom on that row's edge.
      for (const g of members) {
        const off = g.top - gTop;
        const a = play(g.el, {
          frame: (p, ms) => {
            const edge = glideAt(edgeFrom, edgeTo, ms);
            const top = gTop + (edge - edgeFrom) + (edgeFrom - H - gTop) * p;
            return { y: top + off - g.top, cut: edge - (top + off) };
          },
          duration: FOLD, keep: true,
        });
        a.finished.then(() => g.el.remove(), () => g.el.remove());
      }
      void gTop;
    }

    // New rows slide out from under the row above that was already there (or the field).
    let i = 0;
    while (i < now.length) {
      if (before.has(now[i].dataset.key)) { i++; continue; }
      const start = i;
      while (i < now.length && !before.has(now[i].dataset.key)) i++;
      const fresh = now.slice(start, i).map(r => layout.get(r.dataset.key));
      const anchorKey = start > 0 ? now[start - 1].dataset.key : null;
      const a = anchorKey && before.get(anchorKey);
      const edgeTo = a ? layout.get(anchorKey).top + layout.get(anchorKey).h : edgeNext;
      const edgeFrom = a ? a.top + a.h : edgeNow;
      const gTop = fresh[0].top;
      const H = fresh.at(-1).top + fresh.at(-1).h - gTop;
      // At the start the group's bottom sits on the covering edge; it ends in place.
      const delay = groups.size ? ARRIVE_DELAY : 0;
      // The group starts tucked under the covering row and slides out, riding with it.
      for (const f of fresh) {
        const off = f.top - gTop;
        play(f.el, {
          frame: (p, ms) => {
            const edge = glideAt(edgeFrom, edgeTo, ms);
            const top = edge - H * (1 - p) + (gTop - edgeTo) * p;
            return { y: top + off - f.top, cut: edge - (top + off) };
          },
          duration: ARRIVE, delay,
        });
      }
    }

    const threadTo = t ? t.offsetHeight : 0;
    if (t && threadFrom && threadTo && Math.abs(threadFrom - threadTo) > 0.5) {
      t.getAnimations().forEach(a => a.cancel());
      t.animate([{ transform: `scaleY(${threadFrom / threadTo})` }, { transform: 'none' }], { duration: DURATION, easing: CSS_CURVE });
    }
  }

  /** First appearance: the list slides down out from under the field as one sheet. */
  function slideOut() {
    const all = rows();
    if (!all.length) return;
    const edge = fieldEdge();
    const last = all.at(-1);
    const shiftStart = edge - (last.offsetTop + last.offsetHeight);
    for (const r of all) {
      const top = r.offsetTop;
      play(r, { y: (p) => shiftStart * (1 - p), hideAbove: (p) => edge - (top + shiftStart * (1 - p)), duration: OPEN });
    }
    thread()?.animate([{ transform: 'scaleY(0)' }, { transform: 'none' }], { duration: OPEN, easing: CSS_CURVE });
  }

  /** The sheet slides back up under the field, then the list hides. */
  function retract() {
    if (list.hidden) return;
    list.querySelectorAll(':scope > .is-ghost').forEach(g => g.remove());
    const all = rows();
    if (reduced() || !all.length) { clear(); return; }
    const lt = list.getBoundingClientRect().top;
    const edge = fieldEdge();
    const plan = all.map(r => ({ r, top: r.offsetTop, from: r.getBoundingClientRect().top - lt - r.offsetTop }));
    const last = plan.at(-1);
    const shiftEnd = edge - (last.top + last.r.offsetHeight);
    const anims = plan.map(({ r, top, from }) => {
      r.getAnimations().forEach(a => a.cancel());
      r.style.pointerEvents = 'none';
      return play(r, { y: (p) => from + (shiftEnd - from) * p, hideAbove: (p) => edge - (top + from + (shiftEnd - from) * p), duration: CLOSE, keep: true });
    });
    const t = thread();
    if (t) { t.getAnimations().forEach(a => a.cancel()); anims.push(t.animate([{ transform: 'none' }, { transform: 'scaleY(0)' }], { duration: CLOSE, easing: CSS_CURVE, fill: 'forwards' })); }
    // A timer, not the animations' promises: a row removed mid-flight would never settle them.
    const timer = setTimeout(() => { closing = null; clear(); }, CLOSE + 30);
    closing = { cancel: () => { clearTimeout(timer); anims.forEach(a => a.cancel()); all.forEach(r => { r.style.pointerEvents = ''; }); } };
  }

  function clear() {
    if (closing) { closing.cancel(); closing = null; }
    list.hidden = true;
    list.innerHTML = '';
  }

  return { paint, retract, clear, get isOpen() { return !list.hidden; } };
}
