/* ============================================================
   mathx / plot-view — monochrome canvas plotter for the Math Utility.
   (DOM module; the engine files stay DOM-free.)
   Types: fn, param, polar, implicit, field (vector/slope), points,
   bars, hist, argand, surface (3D, drag to rotate).
   Interaction: wheel / pinch zoom, drag to pan, double-click reset,
   +/−/reset buttons, hover read-out, click-to-trace on slope fields.
   ============================================================ */

import { rk45 } from './solve.js';

const DASHES = [[], [7, 5], [2, 4], [10, 4, 2, 4], [4, 3], [1, 3]];

function cssColors(el) {
  const cs = getComputedStyle(el);
  const g = (n, d) => (cs.getPropertyValue(n) || '').trim() || d;
  return { ink: g('--text', '#0a0a0a'), ink2: g('--text-2', '#525252'), ink3: g('--text-3', '#6b6b6b'), line: g('--line', '#e7e7e5'), line2: g('--line-strong', '#d6d6d4'), bg: g('--surface', '#fff'), bg2: g('--surface-2', '#f2f2f1'), tint: g('--tint', 'rgba(10,10,10,.05)') };
}
const seriesColor = (C, i) => [C.ink, C.ink2, C.ink, C.ink3, C.ink2, C.ink3][i % 6];

function niceStep(span, target = 8) {
  const raw = span / target, p = Math.pow(10, Math.floor(Math.log10(raw))), f = raw / p;
  return (f < 1.5 ? 1 : f < 3.5 ? 2 : f < 7.5 ? 5 : 10) * p;
}
const fmtTick = (v, step) => {
  if (Math.abs(v) < step * 1e-6) return '0';
  const d = Math.max(0, -Math.floor(Math.log10(step)) + (step / Math.pow(10, Math.floor(Math.log10(step))) === 5 ? 0 : 0));
  const s = Math.abs(v) >= 1e5 || Math.abs(v) < 1e-4 ? v.toExponential(1) : v.toFixed(Math.min(d, 8));
  return s.replace('-', '−');
};

function robustRange(vals) {
  const v = vals.filter(Number.isFinite).sort((a, b) => a - b);
  if (!v.length) return [-5, 5];
  const q = (p) => v[Math.min(v.length - 1, Math.max(0, Math.floor(p * (v.length - 1))))];
  let lo = q(0.03), hi = q(0.97);
  const full = [v[0], v[v.length - 1]];
  if (full[1] - full[0] < 3 * (hi - lo) || hi - lo < 1e-12) { lo = full[0]; hi = full[1]; }
  if (hi - lo < 1e-9) { lo -= 1; hi += 1; }
  const pad = (hi - lo) * 0.12;
  return [lo - pad, hi + pad];
}

export function mountPlot(host, spec) {
  if (spec.type === 'surface') return mountSurface(host, spec);
  const wrap = document.createElement('div');
  wrap.className = 'mx-plot';
  wrap.innerHTML = `
    <canvas class="mx-plot-canvas" role="img" aria-label="${spec.type} plot"></canvas>
    <div class="mx-plot-tools">
      <button type="button" class="mx-plot-btn" data-z="in" aria-label="Zoom in">+</button>
      <button type="button" class="mx-plot-btn" data-z="out" aria-label="Zoom out">−</button>
      <button type="button" class="mx-plot-btn" data-z="reset" aria-label="Reset view"><svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M3 12a9 9 0 1 0 3-6.7"/><path d="M3 4v5h5"/></svg></button>
    </div>
    <div class="mx-plot-readout" aria-live="off"></div>
    <div class="mx-plot-legend"></div>`;
  host.appendChild(wrap);
  const canvas = wrap.querySelector('canvas');
  const ctx = canvas.getContext('2d');
  const readout = wrap.querySelector('.mx-plot-readout');
  const legend = wrap.querySelector('.mx-plot-legend');
  const traces = []; // user-clicked solution curves on slope fields

  /* ---- initial view ---- */
  let view;
  const initialView = () => {
    let x0 = -10, x1 = 10;
    if (spec.x) [x0, x1] = spec.x;
    if (spec.type === 'fn') {
      if (!spec.x && spec.roots && spec.roots.length) { const lo = Math.min(...spec.roots), hi = Math.max(...spec.roots); const pad = Math.max(2, (hi - lo) * 0.5); x0 = lo - pad; x1 = hi + pad; }
      const ys = [];
      for (const it of spec.items) for (let i = 0; i <= 300; i++) { const x = x0 + (x1 - x0) * i / 300; ys.push(it.f(x)); }
      let [y0, y1] = robustRange(ys);
      if (spec.shade) { y0 = Math.min(y0, 0); y1 = Math.max(y1, 0); }
      return { x0, x1, y0, y1 };
    }
    if (spec.type === 'param' || spec.type === 'polar') {
      const xs = [], ys = [];
      const [t0, t1] = spec.t;
      for (let i = 0; i <= 600; i++) {
        const t = t0 + (t1 - t0) * i / 600;
        if (spec.type === 'param') { xs.push(spec.fx(t)); ys.push(spec.fy(t)); }
        else for (const it of spec.items) { const r = it.r(t); xs.push(r * Math.cos(t)); ys.push(r * Math.sin(t)); }
      }
      const [a, b] = robustRange(xs), [c, d] = robustRange(ys);
      return square({ x0: a, x1: b, y0: c, y1: d });
    }
    if (spec.type === 'points' || spec.type === 'bars' || spec.type === 'hist' || spec.type === 'argand') {
      let pts = [];
      if (spec.type === 'points') spec.series.forEach((s) => pts.push(...s.pts));
      if (spec.type === 'bars') pts = spec.pts;
      if (spec.type === 'argand') pts = spec.points.map((z) => [z.re, z.im]);
      if (spec.type === 'hist') { const h = histBins(spec.data); pts = h.bins.map((b) => [b.x0, b.c]).concat(h.bins.map((b) => [b.x1, 0])); }
      const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]);
      let [a, b] = robustRange(xs), [c, d] = robustRange(ys);
      if (spec.type === 'bars' || spec.type === 'hist') c = 0;
      if (spec.type === 'argand') return square({ x0: Math.min(a, -1.5), x1: Math.max(b, 1.5), y0: Math.min(c, -1.5), y1: Math.max(d, 1.5) });
      if (spec.phase) { /* keep time-series view */ }
      return { x0: a, x1: b, y0: c, y1: d };
    }
    if (spec.type === 'implicit' && spec.points && spec.points.length) {
      const xs = spec.points.map((p) => p[0]), ys = spec.points.map((p) => p[1]);
      const cx = (Math.min(...xs) + Math.max(...xs)) / 2, cy = (Math.min(...ys) + Math.max(...ys)) / 2;
      const r = Math.max(4, (Math.max(...xs) - Math.min(...xs)), (Math.max(...ys) - Math.min(...ys))) * 1.2;
      return square({ x0: cx - r, x1: cx + r, y0: cy - r, y1: cy + r });
    }
    return square({ x0: -6, x1: 6, y0: -6, y1: 6 });
  };
  const square = (v) => {
    // equal aspect for geometric plots
    const W = canvas.clientWidth || 600, H = canvas.clientHeight || 300;
    const sx = (v.x1 - v.x0) / W, sy = (v.y1 - v.y0) / H;
    const s = Math.max(sx, sy);
    const cx = (v.x0 + v.x1) / 2, cy = (v.y0 + v.y1) / 2;
    return { x0: cx - s * W / 2, x1: cx + s * W / 2, y0: cy - s * H / 2, y1: cy + s * H / 2 };
  };

  /* ---- drawing ---- */
  let W = 0, H = 0, dpr = 1;
  const X = (x) => (x - view.x0) / (view.x1 - view.x0) * W;
  const Y = (y) => H - (y - view.y0) / (view.y1 - view.y0) * H;
  const invX = (px) => view.x0 + px / W * (view.x1 - view.x0);
  const invY = (py) => view.y0 + (H - py) / H * (view.y1 - view.y0);

  function resize() {
    dpr = window.devicePixelRatio || 1;
    W = canvas.clientWidth; H = canvas.clientHeight;
    canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function drawAxes(C) {
    const sx = niceStep(view.x1 - view.x0, Math.max(4, W / 90)), sy = niceStep(view.y1 - view.y0, Math.max(3, H / 60));
    ctx.lineWidth = 1;
    ctx.strokeStyle = C.line;
    ctx.beginPath();
    for (let x = Math.ceil(view.x0 / sx) * sx; x <= view.x1; x += sx) { const px = Math.round(X(x)) + 0.5; ctx.moveTo(px, 0); ctx.lineTo(px, H); }
    for (let y = Math.ceil(view.y0 / sy) * sy; y <= view.y1; y += sy) { const py = Math.round(Y(y)) + 0.5; ctx.moveTo(0, py); ctx.lineTo(W, py); }
    ctx.stroke();
    ctx.strokeStyle = C.ink3; ctx.lineWidth = 1;
    ctx.beginPath();
    const ax = Math.min(Math.max(Y(0), 0), H), ay = Math.min(Math.max(X(0), 0), W);
    ctx.moveTo(0, Math.round(ax) + 0.5); ctx.lineTo(W, Math.round(ax) + 0.5);
    ctx.moveTo(Math.round(ay) + 0.5, 0); ctx.lineTo(Math.round(ay) + 0.5, H);
    ctx.stroke();
    ctx.fillStyle = C.ink3; ctx.font = '10.5px ui-monospace, SFMono-Regular, Menlo, monospace';
    ctx.textAlign = 'center'; ctx.textBaseline = 'top';
    const ly = Math.min(Math.max(ax + 4, 2), H - 14);
    for (let x = Math.ceil(view.x0 / sx) * sx; x <= view.x1; x += sx) { if (Math.abs(x) < sx * 1e-6) continue; const px = X(x); if (px < 14 || px > W - 14) continue; ctx.fillText(fmtTick(x, sx), px, ly); }
    ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    const lx = Math.min(Math.max(ay + 4, 2), W - 40);
    for (let y = Math.ceil(view.y0 / sy) * sy; y <= view.y1; y += sy) { if (Math.abs(y) < sy * 1e-6) continue; const py = Y(y); if (py < 8 || py > H - 8) continue; ctx.fillText(fmtTick(y, sy), lx, py); }
  }

  function strokePath(pts, C, i, width = 2) {
    ctx.strokeStyle = seriesColor(C, i); ctx.lineWidth = width; ctx.setLineDash(DASHES[i % DASHES.length]);
    ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    ctx.beginPath();
    let pen = false;
    for (const p of pts) {
      if (!p) { pen = false; continue; }
      if (!pen) { ctx.moveTo(p[0], p[1]); pen = true; } else ctx.lineTo(p[0], p[1]);
    }
    ctx.stroke(); ctx.setLineDash([]);
  }

  function sampleFn(f) {
    const pts = []; const n = Math.max(200, Math.round(W * 1.5));
    let prev = null;
    const yspan = view.y1 - view.y0;
    for (let i = 0; i <= n; i++) {
      const x = view.x0 + (view.x1 - view.x0) * i / n;
      const y = f(x);
      if (!Number.isFinite(y)) { pts.push(null); prev = null; continue; }
      if (prev !== null && Math.abs(y - prev) > yspan * 3) {
        // likely a pole: check midpoint
        const ym = f(x - (view.x1 - view.x0) / n / 2);
        if (!Number.isFinite(ym) || Math.abs(ym - prev) > yspan || Math.abs(ym - y) > yspan) pts.push(null);
      }
      const py = Y(y);
      pts.push([X(x), Math.max(-H, Math.min(2 * H, py))]);
      prev = y;
    }
    return pts;
  }

  function marchingSquares(F, C, i) {
    const nx = Math.min(220, Math.max(80, Math.round(W / 3))), ny = Math.max(50, Math.round(nx * H / W));
    const vals = [];
    for (let j = 0; j <= ny; j++) { const row = []; for (let k = 0; k <= nx; k++) row.push(F(view.x0 + (view.x1 - view.x0) * k / nx, view.y0 + (view.y1 - view.y0) * j / ny)); vals.push(row); }
    ctx.strokeStyle = seriesColor(C, i); ctx.lineWidth = 2; ctx.setLineDash(DASHES[i % DASHES.length]);
    ctx.beginPath();
    const cw = W / nx, ch = H / ny;
    const lerp = (a, b) => (Math.abs(b - a) < 1e-300 ? 0.5 : a / (a - b));
    for (let j = 0; j < ny; j++) for (let k = 0; k < nx; k++) {
      const a = vals[j][k], b = vals[j][k + 1], c = vals[j + 1][k + 1], d = vals[j + 1][k];
      if (![a, b, c, d].every(Number.isFinite)) continue;
      const px = k * cw, py = H - j * ch;
      const e = [];
      if ((a > 0) !== (b > 0)) e.push([px + lerp(a, b) * cw, py]);
      if ((b > 0) !== (c > 0)) e.push([px + cw, py - lerp(b, c) * ch]);
      if ((d > 0) !== (c > 0)) e.push([px + lerp(d, c) * cw, py - ch]);
      if ((a > 0) !== (d > 0)) e.push([px, py - lerp(a, d) * ch]);
      // reject sign changes through poles (huge magnitude jump)
      const mx = Math.max(Math.abs(a), Math.abs(b), Math.abs(c), Math.abs(d));
      const rng = Math.abs((view.x1 - view.x0)) * 50;
      if (mx > rng * 1e3) continue;
      if (e.length >= 2) { ctx.moveTo(e[0][0], e[0][1]); ctx.lineTo(e[1][0], e[1][1]); }
      if (e.length === 4) { ctx.moveTo(e[2][0], e[2][1]); ctx.lineTo(e[3][0], e[3][1]); }
    }
    ctx.stroke(); ctx.setLineDash([]);
  }

  function arrow(x, y, dx, dy, len, C, head = true) {
    const m = Math.hypot(dx, dy); if (!m || !Number.isFinite(m)) return;
    const ux = dx / m, uy = dy / m;
    const x1 = x - ux * len / 2, y1 = y + uy * len / 2, x2 = x + ux * len / 2, y2 = y - uy * len / 2;
    ctx.moveTo(x1, y1); ctx.lineTo(x2, y2);
    if (head) { const hx = -ux * 4, hy = uy * 4; ctx.moveTo(x2, y2); ctx.lineTo(x2 + hx - uy * 3, y2 + hy - ux * 3); ctx.moveTo(x2, y2); ctx.lineTo(x2 + hx + uy * 3, y2 + hy + ux * 3); }
  }

  function draw() {
    const C = cssColors(wrap);
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = C.bg; ctx.fillRect(0, 0, W, H);
    // regions under axes
    if (spec.region && spec.type === 'fn') {
      ctx.fillStyle = C.tint;
      for (const [a, b] of spec.region) { const pa = Number.isFinite(a) ? X(a) : 0, pb = Number.isFinite(b) ? X(b) : W; ctx.fillRect(Math.max(0, pa), 0, Math.min(W, pb) - Math.max(0, pa), H); }
    }
    if (spec.type === 'implicit' && spec.region) {
      ctx.fillStyle = C.tint;
      const step = 6;
      for (let py = 0; py < H; py += step) for (let px = 0; px < W; px += step) if (spec.region.F(invX(px + step / 2), invY(py + step / 2))) ctx.fillRect(px, py, step, step);
    }
    drawAxes(C);
    const leg = [];
    if (spec.type === 'fn') {
      if (spec.shade && spec.items[0]) {
        const f = spec.items[0].f, a = Math.max(spec.shade.a, view.x0), b = Math.min(spec.shade.b, view.x1);
        if (b > a) {
          ctx.fillStyle = C.tint; ctx.beginPath(); ctx.moveTo(X(a), Y(0));
          for (let i = 0; i <= 200; i++) { const x = a + (b - a) * i / 200; const y = f(x); ctx.lineTo(X(x), Number.isFinite(y) ? Math.max(-H, Math.min(2 * H, Y(y))) : Y(0)); }
          ctx.lineTo(X(b), Y(0)); ctx.closePath(); ctx.fill();
          ctx.fillStyle = C.ink3; ctx.globalAlpha = 0.18; ctx.fill(); ctx.globalAlpha = 1;
        }
      }
      spec.items.forEach((it, i) => { strokePath(sampleFn(it.f), C, i); leg.push({ label: it.label, i }); });
      if (spec.markX !== undefined && Number.isFinite(spec.markX)) { ctx.strokeStyle = C.ink3; ctx.setLineDash([3, 3]); ctx.beginPath(); ctx.moveTo(X(spec.markX), 0); ctx.lineTo(X(spec.markX), H); ctx.stroke(); ctx.setLineDash([]); }
      (spec.roots || []).forEach((r) => dot(X(r), Y(0), C, true));
      if (spec.markPt) dot(X(spec.markPt[0]), Y(spec.markPt[1]), C, true);
    } else if (spec.type === 'param') {
      const pts = []; const [t0, t1] = spec.t;
      for (let i = 0; i <= 1500; i++) { const t = t0 + (t1 - t0) * i / 1500; const x = spec.fx(t), y = spec.fy(t); pts.push(Number.isFinite(x) && Number.isFinite(y) ? [X(x), Y(y)] : null); }
      strokePath(pts, C, 0); leg.push({ label: spec.label, i: 0 });
    } else if (spec.type === 'polar') {
      spec.items.forEach((it, i) => {
        const pts = []; const [t0, t1] = spec.t;
        for (let k = 0; k <= 1500; k++) { const t = t0 + (t1 - t0) * k / 1500; const r = it.r(t); pts.push(Number.isFinite(r) ? [X(r * Math.cos(t)), Y(r * Math.sin(t))] : null); }
        strokePath(pts, C, i); leg.push({ label: `r = ${it.label}`, i });
      });
    } else if (spec.type === 'implicit') {
      spec.items.forEach((it, i) => { marchingSquares(it.F, C, i); leg.push({ label: it.label, i }); });
      (spec.points || []).forEach((p) => dot(X(p[0]), Y(p[1]), C, true));
    } else if (spec.type === 'field') {
      const n = Math.max(12, Math.round(W / 34)), m = Math.max(8, Math.round(n * H / W));
      const mags = [];
      const grid = [];
      for (let j = 0; j < m; j++) for (let k = 0; k < n; k++) {
        const px = (k + 0.5) * W / n, py = (j + 0.5) * H / m;
        const [u, v] = spec.F(invX(px), invY(py));
        const du = u * W / (view.x1 - view.x0), dv = v * H / (view.y1 - view.y0);
        grid.push([px, py, du, dv]); mags.push(Math.hypot(u, v));
      }
      const mmax = Math.max(...mags.filter(Number.isFinite)) || 1;
      ctx.lineWidth = 1.3; ctx.lineCap = 'round';
      grid.forEach(([px, py, du, dv], idx) => {
        const rel = spec.slope ? 1 : Math.sqrt(Math.min(1, mags[idx] / mmax));
        ctx.strokeStyle = spec.slope ? C.ink2 : (rel > 0.66 ? C.ink : rel > 0.33 ? C.ink2 : C.ink3);
        ctx.beginPath();
        arrow(px, py, du, dv, spec.slope ? Math.min(W / n, H / m) * 0.7 : Math.min(W / n, H / m) * (0.35 + 0.5 * rel), C, !spec.slope);
        ctx.stroke();
      });
      traces.forEach((tr, i) => strokePath(tr.map(([x, y]) => [X(x), Y(y)]), C, 0, 2.2));
      if (spec.slope) leg.push({ label: 'click to trace a solution', i: 0 });
    } else if (spec.type === 'points') {
      spec.series.forEach((s, i) => {
        if (spec.lines) strokePath(s.pts.map(([x, y]) => [X(x), Y(y)]), C, i);
        else s.pts.forEach(([x, y]) => dot(X(x), Y(y), C, false));
        leg.push({ label: s.label, i, dot: !spec.lines });
      });
      if (spec.fit) { strokePath(sampleFn(spec.fit.f), C, 1); leg.push({ label: spec.fit.label, i: 1 }); }
    } else if (spec.type === 'bars' || spec.type === 'hist') {
      const items = spec.type === 'bars' ? spec.pts.map(([x, y]) => ({ x0: x - 0.4, x1: x + 0.4, y, hl: spec.mark !== undefined && x <= spec.mark })) : histBins(spec.data).bins.map((b) => ({ x0: b.x0, x1: b.x1, y: b.c }));
      items.forEach((b) => { ctx.fillStyle = b.hl ? C.ink : C.ink3; ctx.globalAlpha = b.hl ? 0.85 : 0.45; ctx.fillRect(X(b.x0), Y(b.y), X(b.x1) - X(b.x0) - 1, Y(0) - Y(b.y)); });
      ctx.globalAlpha = 1;
    } else if (spec.type === 'argand') {
      ctx.strokeStyle = C.line2; ctx.setLineDash([3, 4]); ctx.beginPath(); ctx.arc(X(0), Y(0), Math.abs(X(1) - X(0)), 0, 2 * Math.PI); ctx.stroke(); ctx.setLineDash([]);
      spec.points.forEach((z) => dot(X(z.re), Y(z.im), C, true));
      leg.push({ label: 'roots in ℂ (dashed: unit circle)', i: 0, dot: true });
    }
    legend.innerHTML = leg.length > 1 || (leg[0] && leg[0].label) ? leg.map((l) => `<span class="mx-leg"><svg width="22" height="8" aria-hidden="true">${l.dot ? `<circle cx="11" cy="4" r="3" fill="${seriesColor(C, l.i)}"/>` : `<line x1="1" y1="4" x2="21" y2="4" stroke="${seriesColor(C, l.i)}" stroke-width="2" stroke-dasharray="${DASHES[l.i % DASHES.length].join(' ')}"/>`}</svg>${escapeHtml(l.label || '')}</span>`).join('') : '';
  }
  function dot(px, py, C, ring) {
    ctx.beginPath(); ctx.arc(px, py, ring ? 4.5 : 3, 0, 2 * Math.PI);
    ctx.fillStyle = ring ? C.bg : C.ink; ctx.fill();
    if (ring) { ctx.lineWidth = 2; ctx.strokeStyle = C.ink; ctx.stroke(); }
  }

  /* ---- interaction ---- */
  const pointers = new Map();
  let dragStart = null, pinch = null, moved = false;
  const zoomAt = (px, py, k) => {
    const x = invX(px), y = invY(py);
    view = { x0: x - (x - view.x0) * k, x1: x + (view.x1 - x) * k, y0: y - (y - view.y0) * k, y1: y + (view.y1 - y) * k };
    draw();
  };
  const onWheel = (e) => { e.preventDefault(); const r = canvas.getBoundingClientRect(); zoomAt(e.clientX - r.left, e.clientY - r.top, Math.exp(e.deltaY * 0.0015)); };
  const onDown = (e) => {
    canvas.setPointerCapture(e.pointerId);
    pointers.set(e.pointerId, [e.clientX, e.clientY]);
    moved = false;
    if (pointers.size === 1) dragStart = { x: e.clientX, y: e.clientY, view: { ...view } };
    if (pointers.size === 2) { const [a, b] = [...pointers.values()]; pinch = { d: Math.hypot(a[0] - b[0], a[1] - b[1]), view: { ...view }, cx: (a[0] + b[0]) / 2, cy: (a[1] + b[1]) / 2 }; }
  };
  const onMove = (e) => {
    const r = canvas.getBoundingClientRect();
    const px = e.clientX - r.left, py = e.clientY - r.top;
    if (pointers.has(e.pointerId)) pointers.set(e.pointerId, [e.clientX, e.clientY]);
    if (pinch && pointers.size === 2) {
      const [a, b] = [...pointers.values()]; const d = Math.hypot(a[0] - b[0], a[1] - b[1]);
      view = { ...pinch.view }; zoomAt(pinch.cx - r.left, pinch.cy - r.top, pinch.d / Math.max(d, 1)); moved = true; return;
    }
    if (dragStart && pointers.size === 1) {
      const dx = e.clientX - dragStart.x, dy = e.clientY - dragStart.y;
      if (Math.abs(dx) + Math.abs(dy) > 3) moved = true;
      const sx = (dragStart.view.x1 - dragStart.view.x0) / W, sy = (dragStart.view.y1 - dragStart.view.y0) / H;
      view = { x0: dragStart.view.x0 - dx * sx, x1: dragStart.view.x1 - dx * sx, y0: dragStart.view.y0 + dy * sy, y1: dragStart.view.y1 + dy * sy };
      draw();
    }
    // read-out
    const x = invX(px), y = invY(py);
    let txt = `x ${fmt(x)}  y ${fmt(y)}`;
    if (spec.type === 'fn' && spec.items.length) txt = `x ${fmt(x)}` + spec.items.map((it, i) => `  ${spec.items.length > 1 ? `f${i + 1}` : 'f'} ${fmt(it.f(x))}`).join('');
    readout.textContent = txt;
  };
  const onUp = (e) => {
    pointers.delete(e.pointerId);
    if (pointers.size < 2) pinch = null;
    if (!pointers.size) {
      if (!moved && spec.type === 'field' && spec.slope && spec.rhs && dragStart) {
        const r = canvas.getBoundingClientRect();
        const x0 = invX(dragStart.x - r.left), y0 = invY(dragStart.y - r.top);
        const f = (t, yv) => [spec.rhs(t, yv[0])];
        const fw = rk45(f, x0, [y0], view.x1, { rtol: 1e-6, atol: 1e-9, maxSteps: 3000 });
        const bw = rk45(f, x0, [y0], view.x0, { rtol: 1e-6, atol: 1e-9, maxSteps: 3000 });
        const clip = (arr) => arr.filter(([, yy]) => Math.abs(yy) < 1e6);
        traces.push(clip([...bw.t.map((t, i) => [t, bw.y[i][0]]).reverse(), ...fw.t.map((t, i) => [t, fw.y[i][0]])]));
        if (traces.length > 6) traces.shift();
        draw();
      }
      dragStart = null;
    }
  };
  const onLeave = () => { readout.textContent = ''; };
  const onDbl = () => { view = initialView(); draw(); };
  const onBtn = (e) => {
    const b = e.target.closest('[data-z]'); if (!b) return;
    if (b.dataset.z === 'reset') { traces.length = 0; view = initialView(); draw(); }
    else zoomAt(W / 2, H / 2, b.dataset.z === 'in' ? 0.7 : 1 / 0.7);
  };
  canvas.addEventListener('wheel', onWheel, { passive: false });
  canvas.addEventListener('pointerdown', onDown);
  canvas.addEventListener('pointermove', onMove);
  canvas.addEventListener('pointerup', onUp);
  canvas.addEventListener('pointercancel', onUp);
  canvas.addEventListener('pointerleave', onLeave);
  canvas.addEventListener('dblclick', onDbl);
  wrap.addEventListener('click', onBtn);

  resize();
  view = initialView();
  draw();
  const ro = new ResizeObserver(() => { const oldW = W, oldH = H; resize(); if (oldW && (Math.abs(oldW - W) > 1 || Math.abs(oldH - H) > 1)) { const cx = (view.x0 + view.x1) / 2, sx = (view.x1 - view.x0) * W / oldW; view.x0 = cx - sx / 2; view.x1 = cx + sx / 2; } draw(); });
  ro.observe(canvas);
  const mo = new MutationObserver(() => draw());
  mo.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  return () => { ro.disconnect(); mo.disconnect(); canvas.removeEventListener('wheel', onWheel); wrap.remove(); };
}

function histBins(data) {
  const n = data.length, lo = Math.min(...data), hi = Math.max(...data);
  const k = Math.max(1, Math.min(40, Math.ceil(Math.log2(n) + 1)));
  const w = (hi - lo) / k || 1;
  const bins = Array.from({ length: k }, (_, i) => ({ x0: lo + i * w, x1: lo + (i + 1) * w, c: 0 }));
  data.forEach((v) => { bins[Math.min(k - 1, Math.floor((v - lo) / w))].c++; });
  return { bins };
}
const fmt = (v) => (Number.isFinite(v) ? (Math.abs(v) >= 1e5 || (Math.abs(v) < 1e-3 && v !== 0) ? v.toExponential(3) : String(parseFloat(v.toFixed(4)))).replace('-', '−') : '—');
function escapeHtml(s) { return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }

/* ---------------- 3D surface ---------------- */
function mountSurface(host, spec) {
  const wrap = document.createElement('div');
  wrap.className = 'mx-plot mx-plot-3d';
  wrap.innerHTML = `<canvas class="mx-plot-canvas" role="img" aria-label="3D surface plot of ${escapeHtml(spec.label || '')}"></canvas>
    <div class="mx-plot-tools"><button type="button" class="mx-plot-btn" data-z="in" aria-label="Zoom in">+</button><button type="button" class="mx-plot-btn" data-z="out" aria-label="Zoom out">−</button><button type="button" class="mx-plot-btn" data-z="reset" aria-label="Reset view"><svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M3 12a9 9 0 1 0 3-6.7"/><path d="M3 4v5h5"/></svg></button></div>
    <div class="mx-plot-readout">drag to rotate</div>`;
  host.appendChild(wrap);
  const canvas = wrap.querySelector('canvas');
  const ctx = canvas.getContext('2d');
  const [xr, yr] = spec.range || [[-3, 3], [-3, 3]];
  const N = 42;
  const Z = [];
  let zmin = Infinity, zmax = -Infinity;
  for (let j = 0; j <= N; j++) { const row = []; for (let i = 0; i <= N; i++) { const x = xr[0] + (xr[1] - xr[0]) * i / N, y = yr[0] + (yr[1] - yr[0]) * j / N; const z = spec.f(x, y); row.push(z); if (Number.isFinite(z)) { zmin = Math.min(zmin, z); zmax = Math.max(zmax, z); } } Z.push(row); }
  const zs = Z.flat().filter(Number.isFinite).sort((a, b) => a - b);
  if (zs.length) { zmin = zs[Math.floor(zs.length * 0.02)]; zmax = zs[Math.floor(zs.length * 0.98)]; }
  if (!(zmax > zmin)) { zmin -= 1; zmax += 1; }
  let yaw = -0.8, pitch = 0.95, zoom = 1;
  let W = 0, H = 0, dpr = 1;
  function resize() { dpr = window.devicePixelRatio || 1; W = canvas.clientWidth; H = canvas.clientHeight; canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr); ctx.setTransform(dpr, 0, 0, dpr, 0, 0); }
  const norm = (i, j) => { const z = Z[j][i]; return [i / N * 2 - 1, j / N * 2 - 1, Number.isFinite(z) ? ((Math.min(zmax, Math.max(zmin, z)) - zmin) / (zmax - zmin)) * 1.2 - 0.6 : NaN]; };
  function project([x, y, z]) {
    const cy = Math.cos(yaw), sy = Math.sin(yaw), cp = Math.cos(pitch), sp = Math.sin(pitch);
    const x1 = x * cy - y * sy, y1 = x * sy + y * cy;
    const y2 = y1 * cp - z * sp, z2 = y1 * sp + z * cp;
    const s = Math.min(W, H) * 0.36 * zoom;
    return [W / 2 + x1 * s, H / 2 + z2 * -s + 10, y2];
  }
  function draw() {
    const C = cssColors(wrap);
    ctx.fillStyle = C.bg; ctx.fillRect(0, 0, W, H);
    // floor box
    const corners = [[-1, -1, -0.6], [1, -1, -0.6], [1, 1, -0.6], [-1, 1, -0.6]].map(project);
    ctx.strokeStyle = C.line2; ctx.lineWidth = 1; ctx.beginPath(); corners.forEach((p, i) => (i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]))); ctx.closePath(); ctx.stroke();
    const quads = [];
    const light = [0.4, -0.5, 0.77];
    for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
      const a = norm(i, j), b = norm(i + 1, j), c = norm(i + 1, j + 1), d = norm(i, j + 1);
      if (![a, b, c, d].every((p) => Number.isFinite(p[2]))) continue;
      const u = [c[0] - a[0], c[1] - a[1], c[2] - a[2]], v = [d[0] - b[0], d[1] - b[1], d[2] - b[2]];
      const n = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
      const nl = Math.hypot(...n) || 1;
      const shade = Math.abs((n[0] * light[0] + n[1] * light[1] + n[2] * light[2]) / nl);
      const P = [a, b, c, d].map(project);
      quads.push({ P, depth: P.reduce((s, p) => s + p[2], 0) / 4, shade });
    }
    quads.sort((q, r) => r.depth - q.depth);
    const dark = document.documentElement.getAttribute('data-theme') === 'dark';
    for (const q of quads) {
      const g = dark ? Math.round(40 + 150 * q.shade) : Math.round(245 - 150 * (1 - q.shade));
      ctx.fillStyle = `rgb(${g},${g},${g})`;
      ctx.beginPath(); q.P.forEach((p, i) => (i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]))); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = C.line2; ctx.lineWidth = 0.5; ctx.stroke();
    }
    if (spec.mark) {
      const [mx, my, mz] = spec.mark;
      const p = project([(mx - xr[0]) / (xr[1] - xr[0]) * 2 - 1, (my - yr[0]) / (yr[1] - yr[0]) * 2 - 1, ((Math.min(zmax, Math.max(zmin, mz)) - zmin) / (zmax - zmin)) * 1.2 - 0.6]);
      ctx.beginPath(); ctx.arc(p[0], p[1], 5, 0, 2 * Math.PI); ctx.fillStyle = C.bg; ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = C.ink; ctx.stroke();
    }
    ctx.fillStyle = C.ink3; ctx.font = '11px ui-monospace, Menlo, monospace';
    const lx = project([1.12, -1, -0.6]), ly = project([-1, 1.12, -0.6]);
    ctx.fillText(spec.vars ? spec.vars[0] : 'x', lx[0], lx[1]); ctx.fillText(spec.vars ? spec.vars[1] : 'y', ly[0], ly[1]);
    ctx.fillText(`z ∈ [${fmt(zmin)}, ${fmt(zmax)}]`, 8, H - 8);
  }
  let drag = null;
  const onDown = (e) => { canvas.setPointerCapture(e.pointerId); drag = { x: e.clientX, y: e.clientY, yaw, pitch }; };
  const onMove = (e) => { if (!drag) return; yaw = drag.yaw + (e.clientX - drag.x) * 0.01; pitch = Math.max(0.1, Math.min(1.5, drag.pitch + (e.clientY - drag.y) * 0.01)); draw(); };
  const onUp = () => { drag = null; };
  const onWheel = (e) => { e.preventDefault(); zoom = Math.max(0.4, Math.min(3, zoom * Math.exp(-e.deltaY * 0.0015))); draw(); };
  const onBtn = (e) => { const b = e.target.closest('[data-z]'); if (!b) return; if (b.dataset.z === 'reset') { yaw = -0.8; pitch = 0.95; zoom = 1; } else zoom = Math.max(0.4, Math.min(3, zoom * (b.dataset.z === 'in' ? 1.25 : 0.8))); draw(); };
  canvas.addEventListener('pointerdown', onDown); canvas.addEventListener('pointermove', onMove); canvas.addEventListener('pointerup', onUp); canvas.addEventListener('pointercancel', onUp);
  canvas.addEventListener('wheel', onWheel, { passive: false }); wrap.addEventListener('click', onBtn);
  resize(); draw();
  const ro = new ResizeObserver(() => { resize(); draw(); }); ro.observe(canvas);
  const mo = new MutationObserver(() => draw()); mo.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  return () => { ro.disconnect(); mo.disconnect(); wrap.remove(); };
}
