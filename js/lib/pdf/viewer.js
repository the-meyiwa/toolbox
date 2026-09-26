/* ============================================================
   Page viewer with an annotation layer (PDF Editor).

   Renders one page with pdf.js and draws annotations on a canvas above
   it. Annotations live in PDF user space (see core.js), so they follow
   their page through rotation and reordering and burn in exactly where
   they were drawn. Tools: select/move/resize, text, highlight, ink,
   rectangle, ellipse, line, arrow, image or signature placement and
   redaction boxes.
   ============================================================ */

import { viewToUser, userToView, viewRectToUser, userRectToView, viewSize, normRot } from './core.js';
import { displayRot, boxOf, uid, esc } from './workspace.js';

const RECT_TYPES = new Set(['highlight', 'rect', 'ellipse', 'redact']);
const HANDLE = 9;

export class PageViewer {
  /**
   * @param {HTMLElement} host
   * @param {object} o
   *   session         PdfSession
   *   getAnnots(id)   annotations of a page item (array, mutated in place)
   *   commit(label)   record an undo step after a change
   *   getImage(key)   HTMLImageElement for an image annotation
   *   style()         {color, stroke, size, highlight}
   *   onSelect(a)     selection changed
   *   onPlace()       a pending stamp was placed
   *   overlay(ctx, page, view)  extra preview drawing (watermark, page numbers)
   */
  constructor(host, o) {
    this.host = host;
    this.o = o;
    this.tool = 'select';
    this.page = null;
    this.zoom = 1;          // CSS px per point
    this.fit = 'width';
    this.selected = null;
    this.pending = null;    // {kind: 'image', key, width, height}
    this.renderTask = null;
    this.seq = 0;
    host.classList.add('pe-view');
    host.innerHTML = `
      <div class="pe-canvas-wrap">
        <canvas class="pe-page-canvas" aria-hidden="true"></canvas>
        <canvas class="pe-annot-canvas" tabindex="0" aria-label="Page canvas"></canvas>
      </div>
      <div class="pe-view-empty" hidden>Select a page</div>`;
    this.wrap = host.querySelector('.pe-canvas-wrap');
    this.pc = host.querySelector('.pe-page-canvas');
    this.ac = host.querySelector('.pe-annot-canvas');
    this.bind();
    this.ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(() => { if (this.fit !== 'none') this.layout(); }) : null;
    this.ro?.observe(host);
  }

  destroy() {
    this.ro?.disconnect();
    try { this.renderTask?.cancel(); } catch { /* done */ }
    this.closeEditor(false);
  }

  get box() { return boxOf(this.page); }
  get rot() { return displayRot(this.page); }
  get vsize() { return viewSize(this.box, this.rot); }

  setTool(tool) {
    this.tool = tool;
    this.ac.dataset.tool = tool;
    if (tool !== 'select') this.select(null);
    if (tool !== 'place') this.pending = null;
  }

  arm(pending) { this.pending = pending; this.setTool('place'); this.ac.dataset.tool = 'place'; }

  async show(page) {
    this.closeEditor(true);
    if (this.page?.id !== page?.id) this.select(null);
    this.page = page;
    this.host.querySelector('.pe-view-empty').hidden = Boolean(page);
    this.wrap.hidden = !page;
    if (!page) return;
    await this.layout();
  }

  setZoom(z) {
    this.fit = 'none';
    this.zoom = Math.max(0.25, Math.min(4, z));
    return this.layout();
  }

  fitWidth() { this.fit = 'width'; return this.layout(); }

  async layout() {
    if (!this.page) return;
    const vs = this.vsize;
    if (this.fit === 'width') {
      const avail = Math.max(200, this.host.clientWidth - 32);
      this.zoom = Math.min(2, avail / vs.width);
    }
    const w = vs.width * this.zoom, h = vs.height * this.zoom;
    this.wrap.style.width = `${w}px`;
    this.wrap.style.height = `${h}px`;
    const dpr = Math.min(2, globalThis.devicePixelRatio || 1);
    this.dpr = dpr;
    this.ac.width = Math.round(w * dpr);
    this.ac.height = Math.round(h * dpr);
    this.ac.style.width = this.pc.style.width = `${w}px`;
    this.ac.style.height = this.pc.style.height = `${h}px`;
    this.draw();
    await this.renderPage();
  }

  async renderPage() {
    const page = this.page;
    const seq = ++this.seq;
    try { this.renderTask?.cancel(); } catch { /* done */ }
    const ctx = this.pc.getContext('2d', { alpha: false });
    if (page.blank) {
      this.pc.width = this.ac.width; this.pc.height = this.ac.height;
      ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, this.pc.width, this.pc.height);
      this.wrap.classList.add('is-ready');
      return;
    }
    const src = this.o.session.get(page.src);
    if (!src) return;
    try {
      const p = await src.pdf.getPage(page.index + 1);
      if (seq !== this.seq) return;
      const viewport = p.getViewport({ scale: this.zoom * this.dpr, rotation: this.rot });
      // Render off-screen, then swap, so the old page stays visible meanwhile.
      const off = document.createElement('canvas');
      off.width = Math.round(viewport.width); off.height = Math.round(viewport.height);
      const octx = off.getContext('2d', { alpha: false });
      octx.fillStyle = '#fff'; octx.fillRect(0, 0, off.width, off.height);
      this.renderTask = p.render({ canvasContext: octx, viewport });
      await this.renderTask.promise;
      if (seq !== this.seq) { off.width = 0; return; }
      this.pc.width = off.width; this.pc.height = off.height;
      ctx.drawImage(off, 0, 0);
      off.width = 0;
      this.wrap.classList.add('is-ready');
      p.cleanup?.();
    } catch (err) {
      if (err?.name !== 'RenderingCancelledException') console.warn('page render failed', err);
    }
  }

  /* ---------- geometry helpers (view px = points × zoom) ---------- */

  toView(ux, uy) { const v = userToView(this.box, this.rot, ux, uy); return { x: v.x * this.zoom, y: v.y * this.zoom }; }
  toUser(px, py) { return viewToUser(this.box, this.rot, px / this.zoom, py / this.zoom); }

  /** Visual angle (radians, canvas convention) of an annotation drawn at rotation a.rot. */
  angle(a) { return ((normRot(this.rot - (a.rot || 0))) * Math.PI) / 180; }

  bbox(a, ctx = this.ac.getContext('2d')) {
    const z = this.zoom;
    if (RECT_TYPES.has(a.type)) {
      const r = userRectToView(this.box, this.rot, a);
      return { x: r.x * z, y: r.y * z, w: r.width * z, h: r.height * z };
    }
    if (a.points) {
      const pts = a.points.map(p => this.toView(p.x, p.y));
      const xs = pts.map(p => p.x), ys = pts.map(p => p.y);
      const pad = Math.max(4, (a.stroke || 2) * z);
      return { x: Math.min(...xs) - pad, y: Math.min(...ys) - pad, w: Math.max(...xs) - Math.min(...xs) + pad * 2, h: Math.max(...ys) - Math.min(...ys) + pad * 2 };
    }
    // text and image: local box rotated about the anchor
    const p = this.toView(a.x, a.y);
    let w, h, oy;
    if (a.type === 'text') {
      ctx.save();
      ctx.font = `${a.size * z}px Helvetica, Arial, sans-serif`;
      const lines = String(a.text || '').split('\n');
      w = Math.max(...lines.map(l => ctx.measureText(l).width), 10);
      ctx.restore();
      h = a.size * z * (1.2 * (lines.length - 1) + 1);
      oy = -a.size * z * 0.8;
    } else { w = a.width * z; h = a.height * z; oy = -h; }
    const t = this.angle(a);
    const c = Math.cos(t), s = Math.sin(t);
    const corners = [[0, oy], [w, oy], [0, oy + h], [w, oy + h]].map(([x, y]) => ({ x: p.x + x * c - y * s, y: p.y + x * s + y * c }));
    const xs = corners.map(q => q.x), ys = corners.map(q => q.y);
    return { x: Math.min(...xs), y: Math.min(...ys), w: Math.max(...xs) - Math.min(...xs), h: Math.max(...ys) - Math.min(...ys) };
  }

  hit(px, py) {
    const list = this.annots();
    for (let i = list.length - 1; i >= 0; i--) {
      const b = this.bbox(list[i]);
      if (px >= b.x - 4 && px <= b.x + b.w + 4 && py >= b.y - 4 && py <= b.y + b.h + 4) return list[i];
    }
    return null;
  }

  annots() { return this.page ? this.o.getAnnots(this.page.id) : []; }

  /* ---------- drawing ---------- */

  draw(preview = null) {
    const ctx = this.ac.getContext('2d');
    const d = this.dpr || 1;
    ctx.setTransform(d, 0, 0, d, 0, 0);
    ctx.clearRect(0, 0, this.ac.width, this.ac.height);
    if (!this.page) return;
    this.o.overlay?.(ctx, this.page, this);
    for (const a of this.annots()) this.drawOne(ctx, a);
    if (preview) this.drawOne(ctx, preview, true);
    if (this.selected && this.annots().includes(this.selected)) {
      const b = this.bbox(this.selected);
      ctx.save();
      ctx.strokeStyle = getComputedStyle(this.host).getPropertyValue('--pe-sel').trim() || '#0a0a0a';
      ctx.setLineDash([4, 3]);
      ctx.lineWidth = 1;
      ctx.strokeRect(b.x - 3.5, b.y - 3.5, b.w + 7, b.h + 7);
      ctx.setLineDash([]);
      if (this.resizable(this.selected)) {
        ctx.fillStyle = '#fff';
        ctx.strokeStyle = '#0a0a0a';
        ctx.fillRect(b.x + b.w + 3.5 - HANDLE / 2, b.y + b.h + 3.5 - HANDLE / 2, HANDLE, HANDLE);
        ctx.strokeRect(b.x + b.w + 3.5 - HANDLE / 2, b.y + b.h + 3.5 - HANDLE / 2, HANDLE, HANDLE);
      }
      ctx.restore();
    }
  }

  resizable(a) { return RECT_TYPES.has(a.type) || a.type === 'image' || a.type === 'text'; }

  drawOne(ctx, a, preview = false) {
    const z = this.zoom;
    ctx.save();
    switch (a.type) {
      case 'highlight': {
        const b = this.bbox(a);
        ctx.globalCompositeOperation = 'multiply';
        ctx.fillStyle = a.color || '#ffe14d';
        ctx.globalAlpha = 0.45;
        ctx.fillRect(b.x, b.y, b.w, b.h);
        break;
      }
      case 'redact': {
        const b = this.bbox(a);
        ctx.fillStyle = 'rgba(10,10,10,.82)';
        ctx.fillRect(b.x, b.y, b.w, b.h);
        ctx.strokeStyle = '#0a0a0a';
        ctx.lineWidth = 1;
        ctx.strokeRect(b.x + 0.5, b.y + 0.5, b.w - 1, b.h - 1);
        if (b.w > 70 && b.h > 14) {
          ctx.fillStyle = 'rgba(255,255,255,.75)';
          ctx.font = '600 10px system-ui, sans-serif';
          ctx.textBaseline = 'middle';
          ctx.fillText('REDACT', b.x + 6, b.y + b.h / 2);
        }
        break;
      }
      case 'rect':
      case 'ellipse': {
        const b = this.bbox(a);
        ctx.strokeStyle = a.color || '#d92626';
        ctx.lineWidth = (a.stroke || 2) * z;
        if (a.type === 'rect') ctx.strokeRect(b.x, b.y, b.w, b.h);
        else { ctx.beginPath(); ctx.ellipse(b.x + b.w / 2, b.y + b.h / 2, Math.max(1, b.w / 2), Math.max(1, b.h / 2), 0, 0, Math.PI * 2); ctx.stroke(); }
        break;
      }
      case 'line':
      case 'arrow':
      case 'ink': {
        const pts = (a.points || []).map(p => this.toView(p.x, p.y));
        if (pts.length < 2) break;
        ctx.strokeStyle = a.color || '#d92626';
        ctx.lineWidth = (a.stroke || 2) * z;
        ctx.lineCap = 'round'; ctx.lineJoin = 'round';
        ctx.beginPath();
        ctx.moveTo(pts[0].x, pts[0].y);
        for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
        ctx.stroke();
        if (a.type === 'arrow') {
          const [p, q] = [pts[0], pts.at(-1)];
          const ang = Math.atan2(q.y - p.y, q.x - p.x);
          const len = Math.max(8, (a.stroke || 2) * 5) * z;
          ctx.beginPath();
          for (const s of [-1, 1]) { ctx.moveTo(q.x, q.y); ctx.lineTo(q.x - len * Math.cos(ang + s * 0.45), q.y - len * Math.sin(ang + s * 0.45)); }
          ctx.stroke();
        }
        break;
      }
      case 'text': {
        const p = this.toView(a.x, a.y);
        ctx.translate(p.x, p.y);
        ctx.rotate(this.angle(a));
        ctx.fillStyle = a.color || '#111';
        ctx.font = `${a.size * z}px Helvetica, Arial, sans-serif`;
        String(a.text || '').split('\n').forEach((line, n) => ctx.fillText(line, 0, n * a.size * 1.2 * z));
        break;
      }
      case 'image': {
        const img = this.o.getImage(a.key);
        const p = this.toView(a.x, a.y);
        ctx.translate(p.x, p.y);
        ctx.rotate(this.angle(a));
        if (preview) ctx.globalAlpha = 0.6;
        if (img?.complete) ctx.drawImage(img, 0, -a.height * z, a.width * z, a.height * z);
        else { ctx.strokeStyle = '#888'; ctx.strokeRect(0, -a.height * z, a.width * z, a.height * z); }
        break;
      }
      default: break;
    }
    ctx.restore();
  }

  select(a) {
    this.selected = a;
    this.draw();
    this.o.onSelect?.(a);
  }

  deleteSelected() {
    if (!this.selected) return false;
    const list = this.annots();
    const i = list.indexOf(this.selected);
    if (i >= 0) list.splice(i, 1);
    this.selected = null;
    this.draw();
    this.o.commit?.('Delete annotation');
    this.o.onSelect?.(null);
    return true;
  }

  /* ---------- interaction ---------- */

  bind() {
    const ac = this.ac;
    let drag = null;
    const pos = (e) => { const r = ac.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };

    ac.addEventListener('pointerdown', (e) => {
      if (!this.page || e.button > 0) return;
      const p = pos(e);
      const st = this.o.style();
      ac.setPointerCapture(e.pointerId);
      if (this.tool === 'select') {
        if (this.selected && this.resizable(this.selected)) {
          const b = this.bbox(this.selected);
          if (Math.abs(p.x - (b.x + b.w + 3.5)) < 10 && Math.abs(p.y - (b.y + b.h + 3.5)) < 10) {
            drag = { kind: 'resize', a: this.selected, start: p, b, orig: structuredClone(stripKey(this.selected)) };
            return;
          }
        }
        const a = this.hit(p.x, p.y);
        this.select(a);
        if (a) drag = { kind: 'move', a, start: p, last: p, moved: false };
        return;
      }
      if (this.tool === 'text') { e.preventDefault(); this.openEditor(p, null); return; }
      if (this.tool === 'place' && this.pending) {
        const pd = this.pending;
        const w = pd.width, h = pd.height;
        const vx = p.x / this.zoom - w / 2, vy = p.y / this.zoom - h / 2;
        const anchor = viewToUser(this.box, this.rot, vx, vy + h);
        const a = { id: uid('a'), type: 'image', key: pd.key, x: anchor.x, y: anchor.y, width: w, height: h, rot: this.rot, sign: pd.sign };
        this.annots().push(a);
        this.o.commit?.(pd.sign ? 'Place signature' : 'Place image');
        this.setTool('select');
        this.select(a);
        this.o.onPlace?.(a);
        return;
      }
      if (this.tool === 'ink') {
        drag = { kind: 'ink', pts: [p] };
        return;
      }
      drag = { kind: 'shape', start: p, cur: p, st };
    });

    // Keep focus in the inline text box: a mousedown would otherwise focus the canvas and blur it.
    ac.addEventListener('mousedown', (e) => { if (this.tool === 'text' || this.editor) e.preventDefault(); });

    ac.addEventListener('pointermove', (e) => {
      const p = pos(e);
      if (!drag) {
        if (this.tool === 'select') ac.style.cursor = this.hit(p.x, p.y) ? 'move' : 'default';
        return;
      }
      if (drag.kind === 'move') {
        const dx = p.x - drag.last.x, dy = p.y - drag.last.y;
        if (!dx && !dy) return;
        drag.moved = true;
        const u0 = this.toUser(0, 0), u1 = this.toUser(dx, dy);
        translate(drag.a, u1.x - u0.x, u1.y - u0.y);
        drag.last = p;
        this.draw();
      } else if (drag.kind === 'resize') {
        const { a, b, orig } = drag;
        const nw = Math.max(8, b.w + (p.x - drag.start.x)), nh = Math.max(8, b.h + (p.y - drag.start.y));
        if (RECT_TYPES.has(a.type)) {
          const r = viewRectToUser(this.box, this.rot, { x: b.x / this.zoom, y: b.y / this.zoom, width: nw / this.zoom, height: nh / this.zoom });
          Object.assign(a, r);
        } else {
          const f = Math.max(0.1, Math.max(nw / b.w, nh / b.h));
          if (a.type === 'text') a.size = Math.max(4, Math.min(200, orig.size * f));
          else { a.width = orig.width * f; a.height = orig.height * f; }
          // keep the top-left corner (as displayed) fixed
          const tl0 = { x: b.x, y: b.y };
          const nb = this.bbox(a);
          const u0 = this.toUser(0, 0), u1 = this.toUser(tl0.x - nb.x, tl0.y - nb.y);
          translate(a, u1.x - u0.x, u1.y - u0.y);
        }
        this.draw();
      } else if (drag.kind === 'ink') {
        const last = drag.pts.at(-1);
        if (Math.hypot(p.x - last.x, p.y - last.y) < 1.5) return;
        drag.pts.push(p);
        const st = this.o.style();
        this.draw({ type: 'ink', points: drag.pts.map(q => this.toUser(q.x, q.y)), color: st.color, stroke: st.stroke });
      } else if (drag.kind === 'shape') {
        drag.cur = p;
        this.draw(this.shapeFrom(drag));
      }
    });

    const end = (e) => {
      if (!drag) return;
      const d = drag;
      drag = null;
      try { ac.releasePointerCapture(e.pointerId); } catch { /* not captured */ }
      if (d.kind === 'move') { if (d.moved) this.o.commit?.('Move annotation'); return; }
      if (d.kind === 'resize') { this.o.commit?.('Resize annotation'); return; }
      const st = this.o.style();
      let a = null;
      if (d.kind === 'ink' && d.pts.length > 1) a = { type: 'ink', points: d.pts.map(q => this.toUser(q.x, q.y)), color: st.color, stroke: st.stroke };
      if (d.kind === 'shape') {
        const s = this.shapeFrom(d);
        const b = s && this.bbox(s);
        if (s && (s.points ? Math.hypot(d.cur.x - d.start.x, d.cur.y - d.start.y) > 6 : b.w > 4 && b.h > 4)) a = s;
      }
      if (a) {
        a.id = uid('a');
        this.annots().push(a);
        this.o.commit?.(labelFor(a.type));
        if (a.type === 'redact') this.o.onRedact?.();
      }
      this.draw();
    };
    ac.addEventListener('pointerup', end);
    ac.addEventListener('pointercancel', end);

    ac.addEventListener('dblclick', (e) => {
      const p = pos(e);
      const a = this.hit(p.x, p.y);
      if (a?.type === 'text') this.openEditor(null, a);
    });

    ac.addEventListener('keydown', (e) => {
      if (!this.selected) return;
      if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); this.deleteSelected(); return; }
      const step = e.shiftKey ? 10 : 1;
      const d = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] }[e.key];
      if (d) {
        e.preventDefault();
        const u0 = this.toUser(0, 0), u1 = this.toUser(d[0] * this.zoom, d[1] * this.zoom);
        translate(this.selected, u1.x - u0.x, u1.y - u0.y);
        this.draw();
        clearTimeout(this._nudge);
        this._nudge = setTimeout(() => this.o.commit?.('Nudge'), 400);
      }
      if (e.key === 'Escape') this.select(null);
    });
  }

  shapeFrom(d) {
    const st = d.st || this.o.style();
    const tool = this.tool;
    if (tool === 'line' || tool === 'arrow') {
      return { type: tool, points: [this.toUser(d.start.x, d.start.y), this.toUser(d.cur.x, d.cur.y)], color: st.color, stroke: st.stroke };
    }
    if (!RECT_TYPES.has(tool)) return null;
    const x = Math.min(d.start.x, d.cur.x), y = Math.min(d.start.y, d.cur.y);
    const w = Math.abs(d.cur.x - d.start.x), h = Math.abs(d.cur.y - d.start.y);
    const r = viewRectToUser(this.box, this.rot, { x: x / this.zoom, y: y / this.zoom, width: w / this.zoom, height: h / this.zoom });
    const a = { type: tool, ...r, color: tool === 'highlight' ? (st.highlight || '#ffe14d') : st.color, stroke: st.stroke };
    return a;
  }

  /* ---------- inline text editor ---------- */

  openEditor(p, existing) {
    this.closeEditor(true);
    const st = this.o.style();
    const size = existing?.size || st.size;
    const z = this.zoom;
    let left, top;
    if (existing) {
      const b = this.bbox(existing);
      left = b.x; top = b.y;
    } else { left = p.x; top = p.y; }
    const ta = document.createElement('textarea');
    ta.className = 'pe-text-editor';
    ta.value = existing?.text || '';
    ta.rows = Math.max(1, (existing?.text || '').split('\n').length);
    ta.placeholder = 'Type here';
    ta.style.left = `${left}px`;
    ta.style.top = `${top}px`;
    ta.style.font = `${size * z}px/1.2 Helvetica, Arial, sans-serif`;
    ta.style.color = existing?.color || st.color;
    ta.setAttribute('aria-label', 'Annotation text');
    this.wrap.appendChild(ta);
    if (existing) { existing._hidden = existing.text; existing.text = ''; this.draw(); }
    const grow = () => { ta.style.height = 'auto'; ta.style.height = `${ta.scrollHeight}px`; ta.style.width = 'auto'; ta.style.width = `${Math.max(80, ta.scrollWidth + 8)}px`; };
    ta.addEventListener('input', grow);
    ta.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); this.closeEditor(true); }
      if (e.key === 'Escape') { e.preventDefault(); this.closeEditor(false); }
      e.stopPropagation();
    });
    ta.addEventListener('blur', () => setTimeout(() => this.closeEditor(true), 0));
    this.editor = { ta, existing, left, top, size, color: existing?.color || st.color };
    grow();
    setTimeout(() => ta.focus(), 0);
  }

  closeEditor(commit) {
    const ed = this.editor;
    if (!ed) return;
    this.editor = null;
    const text = ed.ta.value.replace(/\s+$/, '');
    ed.ta.remove();
    const list = this.page ? this.annots() : [];
    if (ed.existing) {
      if (!commit) ed.existing.text = ed.existing._hidden;
      else if (!text) { const i = list.indexOf(ed.existing); if (i >= 0) list.splice(i, 1); }
      else ed.existing.text = text;
      delete ed.existing._hidden;
      if (commit) this.o.commit?.('Edit text');
    } else if (commit && text && this.page) {
      // Baseline sits one ascent below the top of the box, as displayed.
      const pad = 3;
      const u = viewToUser(this.box, this.rot, (ed.left + pad) / this.zoom, (ed.top + pad) / this.zoom + ed.size * 0.85);
      const a = { id: uid('a'), type: 'text', x: u.x, y: u.y, size: ed.size, rot: this.rot, text, color: ed.color };
      list.push(a);
      this.o.commit?.('Add text');
    }
    this.draw();
  }
}

function translate(a, dx, dy) {
  if (a.points) { for (const p of a.points) { p.x += dx; p.y += dy; } return; }
  a.x += dx; a.y += dy;
}

function stripKey(a) { const { ...rest } = a; return rest; }

function labelFor(type) {
  return { highlight: 'Highlight', rect: 'Rectangle', ellipse: 'Ellipse', line: 'Line', arrow: 'Arrow', ink: 'Drawing', redact: 'Redaction' }[type] || 'Annotation';
}

export { esc };
