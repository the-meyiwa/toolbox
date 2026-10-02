/* ============================================================
   TOOLBOX — Squircle text selection

   Browsers draw text selection as hard rectangles and ignore
   border-radius on ::selection. On desktop, Toolbox draws it itself:
   the native highlight is made transparent and each selected line
   gets a soft squircle (rounded with continuous corners where the
   browser supports corner-shape) laid over the text.

   The overlay uses mix-blend-mode: difference over white, which turns
   the ink-on-paper page into paper-on-ink exactly like the native
   selection did, in both light and dark themes, without hiding text.

   Left native (and so unchanged): text fields, code editors (they draw
   their own selection), touch devices (system handles and loupes), and
   anything inside shadow DOM or frames. If the overlay cannot draw a
   selection, the native highlight is restored for it.
   ============================================================ */

const NATIVE = 'input, textarea, select, .cm-editor, .CodeMirror, .monaco-editor, [data-native-selection]';
const MAX_NODES = 1500;
const PAD_X = 3, PAD_Y = 1.5;
let layer = null;
let pool = [];
let raf = 0;
let active = false;
let virtual = null;    // a range Toolbox selected itself (touch selection), drawn instead of the browser's

const fine = () => typeof matchMedia === 'function' && matchMedia('(hover: hover) and (pointer: fine)').matches;

/** Rectangles a text node's selected part occupies, clipped to what can actually be seen. */
function textRects(range, own = false) {
  const out = [];
  const root = range.commonAncestorContainer.nodeType === 1 ? range.commonAncestorContainer : range.commonAncestorContainer.parentNode;
  if (!root) return out;
  const vh = window.innerHeight, vw = document.documentElement.clientWidth;
  const clipCache = new Map();
  const clipFor = (el) => {
    if (clipCache.has(el)) return clipCache.get(el);
    let box = { l: 0, t: 0, r: vw, b: vh };
    for (let p = el; p && p !== document.body && p.nodeType === 1; p = p.parentElement) {
      const cs = getComputedStyle(p);
      if (cs.overflowX !== 'visible' || cs.overflowY !== 'visible' || cs.contain.includes('paint')) {
        const r = p.getBoundingClientRect();
        box = { l: Math.max(box.l, r.left), t: Math.max(box.t, r.top), r: Math.min(box.r, r.right), b: Math.min(box.b, r.bottom) };
      }
      if (cs.position === 'fixed') break;
    }
    clipCache.set(el, box);
    return box;
  };
  const walker = document.createTreeWalker(root.nodeType === 3 ? root.parentNode : root, NodeFilter.SHOW_TEXT, {
    acceptNode: (n) => (n.nodeValue.trim() && range.intersectsNode(n) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT),
  });
  const sub = document.createRange();
  let n, count = 0;
  while ((n = walker.nextNode()) && count++ < MAX_NODES) {
    const parent = n.parentElement;
    if (!parent) continue;
    const pr = parent.getBoundingClientRect();
    if (pr.bottom < 0 || pr.top > vh || !pr.width) continue;   // off screen or not rendered
    const cs = getComputedStyle(parent);
    // Touch screens turn off browser selection everywhere; Toolbox's own ranges still draw there.
    if ((!own && cs.userSelect === 'none') || cs.visibility === 'hidden') continue;
    sub.setStart(n, n === range.startContainer ? range.startOffset : 0);
    sub.setEnd(n, n === range.endContainer ? range.endOffset : n.nodeValue.length);
    if (sub.collapsed) continue;
    const clip = clipFor(parent);
    for (const r of sub.getClientRects()) {
      if (r.width < 1 || r.height < 1) continue;
      const box = { l: Math.max(r.left, clip.l), t: Math.max(r.top, clip.t), r: Math.min(r.right, clip.r), b: Math.min(r.bottom, clip.b) };
      if (box.r - box.l < 1 || box.b - box.t < 1) continue;
      out.push(box);
    }
  }
  return out;
}

/** Joins the pieces of each line into one shape, so no two shapes overlap (overlaps would cancel out). */
function mergeLines(rects) {
  rects.sort((a, b) => a.t - b.t || a.l - b.l);
  const lines = [];
  for (const r of rects) {
    const mid = (r.t + r.b) / 2;
    const line = lines.find(L => mid > L.t && mid < L.b && r.l <= L.r + 6 && r.r >= L.l - 6);
    if (line) { line.l = Math.min(line.l, r.l); line.r = Math.max(line.r, r.r); line.t = Math.min(line.t, r.t); line.b = Math.max(line.b, r.b); }
    else lines.push({ ...r });
  }
  // Two lines that touch vertically keep a hairline between them rather than overlapping.
  lines.sort((a, b) => a.t - b.t);
  for (let i = 1; i < lines.length; i++) {
    const a = lines[i - 1], b = lines[i];
    if (b.t < a.b + PAD_Y * 2 && b.l < a.r && b.r > a.l) { const m = (a.b + b.t) / 2; a.b = m - PAD_Y - 0.5; b.t = m + PAD_Y + 0.5; }
  }
  return lines;
}

/** Stacks the overlay just above whatever the selection lives in (a dialog, a panel…). */
function zFor(node) {
  let z = 0;
  for (let p = node.nodeType === 1 ? node : node.parentElement; p; p = p.parentElement) {
    const v = parseInt(getComputedStyle(p).zIndex, 10);
    if (!Number.isNaN(v)) z = Math.max(z, v);
  }
  return z + 1;
}

function hide() {
  for (const el of pool) el.style.display = 'none';
  document.documentElement.classList.remove('sq-native');
}

function paint() {
  raf = 0;
  let range = virtual;
  if (!range) {
    const sel = document.getSelection();
    if (!active || !sel || sel.isCollapsed || !sel.rangeCount) { hide(); return; }
    range = sel.getRangeAt(0);
  }
  const anchor = range.commonAncestorContainer;
  const host = anchor.nodeType === 1 ? anchor : anchor.parentElement;
  const focused = document.activeElement;
  // Fields and editors keep their own (native) selection.
  if (!host || (!virtual && (host.closest(NATIVE) || focused?.matches?.('input, textarea')))) { hide(); return; }
  const lines = mergeLines(textRects(range, range === virtual));
  if (!lines.length) {
    // Nothing we could measure (shadow DOM, a replaced element…): show the native highlight.
    hide();
    document.documentElement.classList.add('sq-native');
    return;
  }
  document.documentElement.classList.remove('sq-native');
  layer.style.zIndex = String(Math.min(2147483000, zFor(anchor)));
  while (pool.length < lines.length) {
    const el = document.createElement('i');
    el.className = 'sq-sel-line';
    layer.appendChild(el);
    pool.push(el);
  }
  pool.forEach((el, i) => {
    const L = lines[i];
    if (!L) { el.style.display = 'none'; return; }
    const h = L.b - L.t + PAD_Y * 2;
    el.style.display = 'block';
    el.style.transform = `translate(${(L.l - PAD_X).toFixed(1)}px, ${(L.t - PAD_Y).toFixed(1)}px)`;
    el.style.width = `${(L.r - L.l + PAD_X * 2).toFixed(1)}px`;
    el.style.height = `${h.toFixed(1)}px`;
    el.style.borderRadius = `${Math.min(10, h * 0.42).toFixed(1)}px`;
  });
}

const schedule = () => { if ((active || virtual) && layer && !raf) raf = requestAnimationFrame(paint); };

function ensureLayer() {
  if (layer) return;
  layer = document.createElement('div');
  layer.className = 'sq-sel';
  layer.setAttribute('aria-hidden', 'true');
  document.body.appendChild(layer);
  window.addEventListener('scroll', schedule, { capture: true, passive: true });
  window.addEventListener('resize', schedule, { passive: true });
  // Content that reflows under a selection (fonts loading, panels opening) moves it.
  if (typeof ResizeObserver === 'function') new ResizeObserver(schedule).observe(document.body);
}

/** Draw a range Toolbox selected itself (null clears it). Used by touch selection. */
export function showRange(range) {
  if (typeof document === 'undefined') return;
  ensureLayer();
  virtual = range && !range.collapsed ? range : null;
  if (!virtual) hide();
  schedule();
}

export function installSquircleSelection() {
  if (active || typeof document === 'undefined' || !fine() || typeof Range === 'undefined' || !Range.prototype.getClientRects) return;
  active = true;
  ensureLayer();
  document.documentElement.classList.add('sq-sel-on');
  document.addEventListener('selectionchange', schedule);
  // A touch on a device that also has a mouse switches it back to the system highlight.
  window.matchMedia?.('(hover: hover) and (pointer: fine)').addEventListener?.('change', (e) => {
    document.documentElement.classList.toggle('sq-sel-on', e.matches);
    if (!e.matches) hide(); else schedule();
  });
}
