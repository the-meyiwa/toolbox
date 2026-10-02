/* ============================================================
   TOOLBOX — Suggestion web

   Suggestions grow out of a search field as a web instead of dropping
   down in a panel. Used by the Home search and Spotlight on desktop.

   - Each suggestion is a small bubble (icon and name) tied back to the
     field by a faint trace. The best match sits closest to the field;
     each next one sits a little further out, so distance reads as rank.
   - Details (a short description) appear in a minimal bubble only on
     hover, or when the arrow keys reach a suggestion.
   - Typing into an empty field makes the web burst out of the field:
     a fast spread that slows to a sharp, settled stop.
   - When the suggestions change, the ones that no longer fit run back
     along their traces into the field while the new ones burst out; any
     that stay glide to their new place.
   - Arrow keys move through the suggestions in rank order (the field
     keeps focus and points at the active one for screen readers); Enter
     picks it; Escape folds the web back into the field.

   Bubbles never overlap each other, the field, or areas the page marks
   to keep clear (like headings), and stay inside the visible window.
   Suggestions that cannot fit are left out rather than squeezed in.
   Reduced motion: everything fades in place.
   ============================================================ */

const SPREAD = 'cubic-bezier(.12, .86, .14, 1)';   // fast spread, slow sharp stop
const GLIDE = 'cubic-bezier(.22, 1, .36, 1)';
const RETRACT = 'cubic-bezier(.5, 0, .2, 1)';     // eases off, then draws smoothly home
const NS = 'http://www.w3.org/2000/svg';
let uid = 0;

const reduced = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const overlaps = (a, b) => a.l < b.r && a.r > b.l && a.t < b.b && a.b > b.t;
const inflate = (r, n) => ({ l: r.l - n, t: r.t - n, r: r.r + n, b: r.b + n });
/** Does the segment a→b pass through box r? (sampled; boxes are bubble-sized) */
const crossesBox = (ax, ay, bx, by, r) => {
  for (let i = 1; i < 12; i++) { const t = i / 12, x = ax + (bx - ax) * t, y = ay + (by - ay) * t; if (x > r.l && x < r.r && y > r.t && y < r.b) return true; }
  return false;
};
/** Do segments p1→p2 and p3→p4 cross? */
const crosses = (p1, p2, p3, p4) => {
  const d = (a, b, c) => (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
  const d1 = d(p3, p4, p1), d2 = d(p3, p4, p2), d3 = d(p1, p2, p3), d4 = d(p1, p2, p4);
  return ((d1 > 0) !== (d2 > 0)) && ((d3 > 0) !== (d4 > 0));
};

/** True where the web is the right fit: a wide window and a precise pointer. */
export function webSuits() {
  return typeof matchMedia === 'function' && matchMedia('(min-width: 900px) and (hover: hover) and (pointer: fine)').matches;
}

/**
 * @param {object} o
 * @param {HTMLElement} o.host    positioned element the web is drawn in (it moves with it)
 * @param {HTMLElement} o.field   the search field the web grows from
 * @param {HTMLInputElement} o.input  the text input (gets combobox wiring)
 * @param {() => HTMLElement[]} [o.avoid]  elements to keep clear of
 * @param {boolean} [o.above]     whether suggestions may sit above the field
 * @param {number} [o.topInset]   space at the top of the window to keep clear (a fixed header)
 * @param {(item, event) => void} o.onPick
 */
export function createSuggestionWeb({ host, field, input, avoid = () => [], above = false, topInset = 0, onPick }) {
  const id = `sw${++uid}`;
  const layer = document.createElement('div');
  layer.className = 'sw';
  layer.id = `${id}-list`;
  layer.setAttribute('role', 'listbox');
  layer.setAttribute('aria-label', 'Suggestions');
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('class', 'sw-traces');
  svg.setAttribute('aria-hidden', 'true');
  const tip = document.createElement('div');
  tip.className = 'sw-tip';
  tip.setAttribute('aria-hidden', 'true');
  layer.append(svg, tip);
  host.appendChild(layer);
  input.setAttribute('aria-controls', layer.id);
  input.setAttribute('aria-expanded', 'false');

  /** key → { item, el, path, x, y, w, h, ex, ey } for what is on screen now. */
  let live = new Map();
  let order = [];          // keys in rank order
  let cursor = -1;
  let hovered = null;
  let pending = null;      // latest items waiting for the next frame
  let lastPaint = 0;
  let timer = 0;
  let open = false;

  /* ---------------- geometry ---------------- */

  function frame() {
    const h = host.getBoundingClientRect();
    const f = field.getBoundingClientRect();
    const vw = document.documentElement.clientWidth, vh = window.innerHeight;
    const rel = (r) => ({ l: r.left - h.left, t: r.top - h.top, r: r.right - h.left, b: r.bottom - h.top });
    const F = rel(f);
    const bounds = {
      l: Math.max(0, -h.left) + 14,
      r: Math.min(h.width, vw - h.left) - 14,
      t: Math.max(-h.top, -h.top + topInset) + 10,
      b: vh - h.top - 14,
    };
    const keep = avoid().filter(Boolean).map(el => el.getBoundingClientRect()).filter(r => r.width && r.height).map(r => inflate(rel(r), 10));
    return { F, bounds, keep };
  }

  /** Ideal direction for each rank, in degrees (0 = right, 90 = straight down). The best match
      goes straight out below the field; the rest fan out to either side, alternating. */
  const BELOW = [90, 58, 122, 30, 150, 4, 176, 74, 106, 44, 136, 16, 164];
  const AROUND = [90, 270, 50, 130, 230, 310, 14, 166, 194, 346, 70, 110, 250, 290];

  /** Where a trace leaves the field for direction θ, and the direction it travels in. Rays fan
      out from an ellipse inside the field, so traces spread along the whole field and never cross. */
  function ray(F, deg) {
    const t = deg * Math.PI / 180;
    const cx = (F.l + F.r) / 2, cy = (F.t + F.b) / 2, hw = (F.r - F.l) / 2, hh = (F.b - F.t) / 2;
    let nx = Math.cos(t), ny = Math.sin(t) * 1.25;
    const len = Math.hypot(nx, ny); nx /= len; ny /= len;
    let ex = cx + Math.cos(t) * hw * 0.9, ey = cy + Math.sin(t) * hh;
    // Step out to the field's edge along the ray, so the trace starts on the edge, not inside.
    const tx = nx > 0 ? (F.r - ex) / nx : nx < 0 ? (F.l - ex) / nx : Infinity;
    const ty = ny > 0 ? (F.b - ey) / ny : ny < 0 ? (F.t - ey) / ny : Infinity;
    const out = Math.max(0, Math.min(tx, ty));
    ex += nx * out; ey += ny * out;
    return { ex, ey, nx, ny };
  }

  function layout(sizes) {
    const { F, bounds, keep } = frame();
    const taken = [inflate(F, 8), ...keep];
    const ideals = above ? AROUND : BELOW;
    const allowed = [];
    for (let d = above ? 0 : -16; d < (above ? 360 : 197); d += 6) allowed.push(((d % 360) + 360) % 360);
    const used = [];
    const bubbles = [];   // placed bubble boxes
    const lines = [];     // placed traces, as straight segments
    const result = new Map();
    sizes.forEach(({ key, w, h }, rank) => {
      const ideal = ideals[rank % ideals.length];
      const angDist = (a) => { const d = Math.abs(a - ideal) % 360; return d > 180 ? 360 - d : d; };
      // Directions near the ideal first; directions another bubble already took come last.
      const dirs = allowed.slice().sort((a, b) => (angDist(a) + (used.some(u => Math.abs(u - a) < 14) ? 400 : 0)) - (angDist(b) + (used.some(u => Math.abs(u - b) < 14) ? 400 : 0)));
      const start = 26 + rank * 28;
      for (let gap = start; gap <= start + 200; gap += 10) {
        for (const deg of dirs) {
          if (angDist(deg) > 70 && gap < start + 40) continue;
          const s = ray(F, deg);
          const ext = Math.abs(s.nx) * w / 2 + Math.abs(s.ny) * h / 2;
          const x = s.ex + s.nx * (gap + ext), y = s.ey + s.ny * (gap + ext);
          const box = { l: x - w / 2, t: y - h / 2, r: x + w / 2, b: y + h / 2 };
          if (box.l < bounds.l || box.r > bounds.r || box.t < bounds.t || box.b > bounds.b) continue;
          if (taken.some(t => overlaps(inflate(box, 16), t))) continue;   // room to breathe between bubbles
          // Keep the web legible: no trace runs under another bubble or across another trace.
          const a = { x: s.ex, y: s.ey }, c = { x, y };
          if (bubbles.some(r => crossesBox(a.x, a.y, c.x, c.y, inflate(r, 3)))) continue;
          if (lines.some(([p, q]) => crossesBox(p.x, p.y, q.x, q.y, inflate(box, 3)) || crosses(a, c, p, q))) continue;
          taken.push(box);
          bubbles.push(box);
          lines.push([a, c]);
          used.push(deg);
          result.set(key, { x, y, w, h, ex: s.ex, ey: s.ey, nx: s.nx, ny: s.ny, gap });
          return;
        }
      }
    });
    return { spots: result, center: { x: (F.l + F.r) / 2, y: (F.t + F.b) / 2 } };
  }

  const traceD = (p) => {
    const bend = Math.min(48, p.gap * 0.7);
    return `M${p.ex.toFixed(1)} ${p.ey.toFixed(1)} Q${(p.ex + p.nx * bend).toFixed(1)} ${(p.ey + p.ny * bend).toFixed(1)} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`;
  };

  /* ---------------- elements ---------------- */

  function makeBubble(item, rank) {
    const el = document.createElement(item.href ? 'a' : 'button');
    if (item.href) el.href = item.href; else el.type = 'button';
    el.className = `sw-b${item.kind ? ` sw-${item.kind}` : ''}`;
    el.id = `${id}-o${uid++}`;
    el.tabIndex = -1;
    el.setAttribute('role', 'option');
    el.setAttribute('aria-selected', 'false');
    el.setAttribute('aria-label', item.hint ? `${item.title}. ${item.hint}` : item.title);
    el.dataset.key = item.key;
    el.innerHTML = `${item.icon ? `<span class="sw-ico" aria-hidden="true">${item.icon}</span>` : ''}<span class="sw-t">${esc(item.title)}</span>`;
    el.style.setProperty('--r', rank);
    return el;
  }

  function place(rec) {
    rec.el.style.left = `${(rec.x - rec.w / 2).toFixed(1)}px`;
    rec.el.style.top = `${(rec.y - rec.h / 2).toFixed(1)}px`;
    rec.path.setAttribute('d', traceD(rec));
  }

  function drawTrace(path, duration, delay, easing) {
    if (reduced() || !path.animate) return;
    let len = 0;
    try { len = path.getTotalLength(); } catch { /* not laid out */ }
    if (!len) return;
    path.animate([{ strokeDasharray: `${len} ${len}`, strokeDashoffset: len }, { strokeDasharray: `${len} ${len}`, strokeDashoffset: 0 }], { duration, delay, easing, fill: 'backwards' });
  }

  /* ---------------- motion ---------------- */

  function burstIn(rec, delay) {
    if (reduced() || !rec.el.animate) {
      rec.el.animate?.([{ opacity: 0 }, { opacity: 1 }], { duration: 140, fill: 'backwards' });
      return;
    }
    const dx = rec.ex - rec.x, dy = rec.ey - rec.y;
    rec.el.animate([
      { transform: `translate(${dx}px, ${dy}px) scale(.25)`, opacity: 0 },
      { opacity: 1, offset: 0.35 },
      { transform: 'none', opacity: 1 },
    ], { duration: 640, delay, easing: SPREAD, fill: 'backwards' });
    drawTrace(rec.path, 640, delay, SPREAD);
  }

  function glideTo(rec, from) {
    const dx = from.x - rec.x, dy = from.y - rec.y;
    if (reduced() || !rec.el.animate || (Math.abs(dx) < 1 && Math.abs(dy) < 1)) return;
    rec.el.animate([{ transform: `translate(${dx}px, ${dy}px)` }, { transform: 'none' }], { duration: 460, easing: GLIDE });
    drawTrace(rec.path, 460, 0, GLIDE);
  }

  /** A suggestion that no longer fits runs back along its trace into the field, and the
      trace draws back in behind it. */
  function retract(rec, i) {
    const el = rec.el, path = rec.path;
    el.classList.add('is-leaving');
    el.removeAttribute('id');
    el.setAttribute('aria-hidden', 'true');
    const done = () => { el.remove(); path.remove(); };
    if (reduced() || !el.animate) { done(); return; }
    const dx = rec.ex - rec.x, dy = rec.ey - rec.y;
    el.animate([
      { transform: 'none', opacity: 1 },
      { transform: `translate(${(dx * 0.55).toFixed(1)}px, ${(dy * 0.55).toFixed(1)}px) scale(.8)`, opacity: 0.85, offset: 0.55 },
      { transform: `translate(${dx.toFixed(1)}px, ${dy.toFixed(1)}px) scale(.2)`, opacity: 0 },
    ], { duration: 420, delay: Math.min(i, 6) * 22, easing: RETRACT, fill: 'forwards' }).finished.then(done, done);
    let len = 0;
    try { len = path.getTotalLength(); } catch { /* not laid out */ }
    if (len && path.animate) {
      path.animate([{ strokeDasharray: `${len} ${len}`, strokeDashoffset: 0 }, { strokeDasharray: `${len} ${len}`, strokeDashoffset: len }],
        { duration: 420, delay: Math.min(i, 6) * 22, easing: RETRACT, fill: 'forwards' });
    } else path.animate?.([{ opacity: 1 }, { opacity: 0 }], { duration: 220, fill: 'forwards' });
  }

  /** Folds back into the field. */
  function foldIn(rec, i) {
    const el = rec.el, path = rec.path;
    el.classList.add('is-leaving');
    el.removeAttribute('id');
    const done = () => { el.remove(); path.remove(); };
    if (reduced() || !el.animate) { done(); return; }
    el.animate([{ transform: 'none', opacity: 1 }, { transform: `translate(${rec.ex - rec.x}px, ${rec.ey - rec.y}px) scale(.3)`, opacity: 0 }],
      { duration: 280, delay: Math.min(i, 6) * 12, easing: 'cubic-bezier(.5, 0, .75, 0)', fill: 'forwards' }).finished.then(done, done);
    path.animate?.([{ opacity: 1 }, { opacity: 0 }], { duration: 200, fill: 'forwards' });
  }

  /* ---------------- details bubble ---------------- */

  function showTip(key) {
    const rec = key && live.get(key);
    if (!rec || !rec.item.hint) { tip.classList.remove('is-on'); return; }
    const wasOn = tip.classList.contains('is-on');
    tip.innerHTML = `<strong>${esc(rec.item.title)}</strong><span>${esc(rec.item.hint)}</span>`;
    const { bounds } = frame();
    const tw = tip.offsetWidth, th = tip.offsetHeight;
    // Away from the field: below a bubble that sits below it, above one that sits above.
    const below = rec.ny >= -0.2;
    let x = rec.x - tw / 2, y = below ? rec.y + rec.h / 2 + 8 : rec.y - rec.h / 2 - 8 - th;
    if (below && y + th > bounds.b) y = rec.y - rec.h / 2 - 8 - th;
    x = Math.max(bounds.l, Math.min(bounds.r - tw, x));
    tip.dataset.side = y > rec.y ? 'below' : 'above';
    // Appearing: jump to the spot first, then grow in. Already showing: glide to the next one.
    if (!wasOn) tip.style.transition = 'none';
    tip.style.setProperty('--tx', `${x.toFixed(1)}px`);
    tip.style.setProperty('--ty', `${y.toFixed(1)}px`);
    tip.classList.toggle('is-moving', wasOn);
    if (!wasOn) { void tip.offsetWidth; tip.style.transition = ''; }
    tip.classList.add('is-on');
  }
  const tipFor = () => {
    const key = hovered || order[cursor] || null;
    for (const [k, rec] of live) rec.path.classList.toggle('is-hot', k === key);
    showTip(key);
  };

  /* ---------------- cursor ---------------- */

  function paintCursor() {
    order.forEach((key, i) => {
      const el = live.get(key)?.el;
      if (!el) return;
      el.classList.toggle('is-cursor', i === cursor);
      el.setAttribute('aria-selected', String(i === cursor));
    });
    const el = cursor >= 0 ? live.get(order[cursor])?.el : null;
    if (el) input.setAttribute('aria-activedescendant', el.id); else input.removeAttribute('aria-activedescendant');
    tipFor();
  }

  /* ---------------- render ---------------- */

  function paint(items) {
    const keys = new Set(items.map(it => it.key));
    // Measure every bubble at its natural size before deciding where any of them go.
    const fresh = [];
    const sizes = items.map((item, rank) => {
      let rec = live.get(item.key);
      if (!rec) {
        const el = makeBubble(item, rank);
        el.classList.add('is-measuring');
        layer.appendChild(el);
        const path = document.createElementNS(NS, 'path');
        path.setAttribute('class', `sw-trace${item.kind ? ` sw-trace-${item.kind}` : ''}`);
        svg.appendChild(path);
        rec = { item, el, path };
        fresh.push(rec);
      } else {
        rec.item = item;
        rec.el.style.setProperty('--r', rank);
      }
      return { key: item.key, w: rec.el.offsetWidth, h: rec.el.offsetHeight, rec };
    });
    const { spots } = layout(sizes);

    // Leaving: anything not in the new set, or that no longer fits.
    let leaving = 0;
    for (const [key, rec] of live) {
      if (!keys.has(key) || !spots.has(key)) { retract(rec, leaving++); live.delete(key); }
    }
    const next = new Map();
    let born = 0;
    sizes.forEach(({ key, w, h, rec }) => {
      const spot = spots.get(key);
      if (!spot) { if (fresh.includes(rec)) { rec.el.remove(); rec.path.remove(); } return; }
      const from = live.has(key) ? { x: rec.x, y: rec.y } : null;
      Object.assign(rec, spot, { w, h });
      rec.el.classList.remove('is-measuring');
      place(rec);
      if (from) glideTo(rec, from);
      else burstIn(rec, (leaving ? 70 : 0) + born++ * 26);
      next.set(key, rec);
    });
    live = next;
    order = items.map(it => it.key).filter(k => live.has(k));
    if (cursor >= order.length) cursor = order.length - 1;
    if (hovered && !live.has(hovered)) hovered = null;
    paintCursor();
    open = order.length > 0;
    input.setAttribute('aria-expanded', String(open));
    layer.classList.toggle('is-open', open);
  }

  function flush() {
    timer = 0;
    if (!pending) return;
    const items = pending;
    pending = null;
    lastPaint = performance.now();
    paint(items);
  }

  /* ---------------- events ---------------- */

  layer.addEventListener('pointerdown', (e) => {
    // Keep the caret in the field while choosing.
    if (e.target.closest('.sw-b')) e.preventDefault();
  });
  layer.addEventListener('click', (e) => {
    const el = e.target.closest('.sw-b:not(.is-leaving)');
    if (!el) return;
    const rec = live.get(el.dataset.key);
    if (!rec) return;
    if (el.tagName === 'A' && (e.metaKey || e.ctrlKey || e.shiftKey || e.button === 1)) return;
    e.preventDefault();
    onPick?.(rec.item, e);
  });
  layer.addEventListener('pointerover', (e) => {
    const el = e.target.closest('.sw-b:not(.is-leaving)');
    const key = el?.dataset.key || null;
    if (key === hovered) return;
    hovered = key;
    tipFor();
  });
  layer.addEventListener('pointerleave', () => { hovered = null; tipFor(); });

  let resizeTimer = 0;
  const onResize = () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      if (!open) return;
      const items = order.map(k => live.get(k).item);
      // Re-place without the entrance: the web simply settles into the new space.
      for (const rec of live.values()) { rec.el.remove(); rec.path.remove(); }
      live = new Map();
      paintQuiet(items);
    }, 120);
  };
  function paintQuiet(items) {
    const sizes = items.map((item, rank) => {
      const el = makeBubble(item, rank);
      layer.appendChild(el);
      const path = document.createElementNS(NS, 'path');
      path.setAttribute('class', `sw-trace${item.kind ? ` sw-trace-${item.kind}` : ''}`);
      svg.appendChild(path);
      return { key: item.key, w: el.offsetWidth, h: el.offsetHeight, rec: { item, el, path } };
    });
    const { spots } = layout(sizes);
    for (const { key, w, h, rec } of sizes) {
      const spot = spots.get(key);
      if (!spot) { rec.el.remove(); rec.path.remove(); continue; }
      Object.assign(rec, spot, { w, h });
      place(rec);
      live.set(key, rec);
    }
    order = items.map(it => it.key).filter(k => live.has(k));
    if (cursor >= order.length) cursor = order.length - 1;
    paintCursor();
  }
  window.addEventListener('resize', onResize);

  /* ---------------- API ---------------- */

  return {
    layer,
    /** Show these suggestions (best first). Rapid calls are coalesced so typing stays smooth. */
    update(items) {
      pending = (items || []).filter(it => it && it.key && it.title);
      if (!pending.length) { pending = null; this.clear(); return; }
      if (!open) cursor = -1;
      // At most one repaint every 110ms; the latest suggestions always win.
      clearTimeout(timer);
      timer = setTimeout(flush, Math.max(0, 110 - (performance.now() - lastPaint)));
    },
    /** Fold everything back into the field. */
    clear() {
      clearTimeout(timer);
      pending = null;
      let i = 0;
      for (const rec of live.values()) foldIn(rec, i++);
      live = new Map();
      order = [];
      cursor = -1;
      hovered = null;
      open = false;
      tip.classList.remove('is-on');
      input.removeAttribute('aria-activedescendant');
      input.setAttribute('aria-expanded', 'false');
      layer.classList.remove('is-open');
    },
    /** Move the active suggestion; returns false when there is nothing to move through. */
    move(delta) {
      if (!order.length) return false;
      cursor = cursor < 0 ? (delta > 0 ? 0 : order.length - 1) : (cursor + delta + order.length) % order.length;
      paintCursor();
      return true;
    },
    /** The active suggestion, if the arrow keys picked one. */
    active() { return cursor >= 0 ? live.get(order[cursor])?.item || null : null; },
    /** The best (closest) suggestion. */
    first() { return order.length ? live.get(order[0]).item : null; },
    isOpen: () => open,
    destroy() {
      window.removeEventListener('resize', onResize);
      clearTimeout(timer);
      layer.remove();
    },
  };
}
