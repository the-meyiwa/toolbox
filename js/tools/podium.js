/* ============================================================
   Podium — a slide editor for .pptx and .odp that saves back to the
   format it opened. Legacy .ppt files open as text slides and save
   as .pptx.

   Slides render through lib/docs/deck-render.js, the same renderer
   the File Explorer preview uses. Text boxes are edited in place;
   boxes and pictures move by dragging and resize from the corner.
   ============================================================ */

import { mountShell, icon, esc } from '../lib/docs/editor-shell.js';
import { extOf } from '../lib/docs/formats.js';
import { slideHtml, DECK_CSS } from '../lib/docs/deck-render.js';
import { mergeRunsSized } from '../lib/docs/odf.js';

const I = {
  undo: '<path d="M9 14L4 9l5-5"/><path d="M4 9h10a6 6 0 0 1 0 12h-3"/>',
  redo: '<path d="M15 14l5-5-5-5"/><path d="M20 9H10a6 6 0 0 0 0 12h3"/>',
  slide: '<rect x="3" y="5" width="18" height="12" rx="1"/><path d="M12 9v4M10 11h4"/>',
  text: '<path d="M5 6V4h14v2M12 4v16M9 20h6"/>',
  rect: '<rect x="4" y="6" width="16" height="12" rx="1"/>',
  ellipse: '<ellipse cx="12" cy="12" rx="8" ry="6"/>',
  image: '<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="10" r="2"/><path d="M21 16l-5-5-9 9"/>',
  bold: '<path d="M7 5h6a3.5 3.5 0 0 1 0 7H7zM7 12h7a3.5 3.5 0 0 1 0 7H7z"/>',
  italic: '<path d="M11 5h6M7 19h6M14 5l-4 14"/>',
  underline: '<path d="M7 4v7a5 5 0 0 0 10 0V4M5 20h14"/>',
  bigger: '<path d="M4 18l5-12 5 12M6 14h6M18 8v6M15 11h6"/>',
  smaller: '<path d="M4 18l5-12 5 12M6 14h6M15 11h6"/>',
  ul: '<path d="M9 6h11M9 12h11M9 18h11"/><circle cx="4.5" cy="6" r="1"/><circle cx="4.5" cy="12" r="1"/><circle cx="4.5" cy="18" r="1"/>',
  left: '<path d="M4 6h16M4 10h10M4 14h16M4 18h10"/>',
  center: '<path d="M4 6h16M7 10h10M4 14h16M7 18h10"/>',
  right: '<path d="M4 6h16M10 10h10M4 14h16M10 18h10"/>',
  front: '<rect x="8" y="8" width="12" height="12" rx="1"/><path d="M4 16V5a1 1 0 0 1 1-1h11"/>',
  back: '<rect x="4" y="4" width="12" height="12" rx="1"/><path d="M20 8v11a1 1 0 0 1-1 1H8"/>',
  trash: '<path d="M4 7h16M10 11v6M14 11v6"/><path d="M6 7l1 12a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1l1-12M9 7V4h6v3"/>',
  play: '<path d="M7 4l13 8-13 8z"/>',
  up: '<path d="M6 15l6-6 6 6"/>',
  down: '<path d="M6 9l6 6 6-6"/>',
  copy: '<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V5a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3"/>',
};

const tb = (act, label, ic) => `<button type="button" class="dx-tbtn" data-act="${act}" title="${esc(label)}" aria-label="${esc(label)}">${icon(ic)}</button>`;

const TOOLBAR = `
  <div class="dx-tgroup">${tb('undo', 'Undo (Ctrl+Z)', I.undo)}${tb('redo', 'Redo (Ctrl+Y)', I.redo)}</div>
  <div class="dx-tgroup">
    <select class="dx-select" data-new-slide aria-label="New slide" title="New slide">
      <option value="" selected disabled>New slide</option><option value="title">Title slide</option><option value="content">Title and content</option><option value="blank">Blank</option>
    </select>
  </div>
  <div class="dx-tgroup">${tb('text', 'Text box', I.text)}${tb('rect', 'Rectangle', I.rect)}${tb('ellipse', 'Ellipse', I.ellipse)}<label class="dx-tbtn" title="Picture" aria-label="Picture">${icon(I.image)}<input type="file" accept="image/png,image/jpeg,image/gif" data-image hidden></label></div>
  <div class="dx-tgroup" data-needs-box>${tb('bold', 'Bold', I.bold)}${tb('italic', 'Italic', I.italic)}${tb('underline', 'Underline', I.underline)}${tb('bigger', 'Larger text', I.bigger)}${tb('smaller', 'Smaller text', I.smaller)}
    <label class="dx-tbtn dx-color" title="Text colour"><span class="dx-color-a" aria-hidden="true">A</span><input type="color" data-color="text" value="#111111" aria-label="Text colour"></label></div>
  <div class="dx-tgroup" data-needs-box>${tb('bullets', 'Bullets', I.ul)}${tb('alignLeft', 'Align left', I.left)}${tb('alignCenter', 'Centre', I.center)}${tb('alignRight', 'Align right', I.right)}</div>
  <div class="dx-tgroup" data-needs-sel>
    <label class="dx-tbtn dx-color" title="Fill colour"><span class="dx-swatch" aria-hidden="true"></span><input type="color" data-color="fill" value="#dbe7ff" aria-label="Fill colour"></label>
    ${tb('front', 'Bring forward', I.front)}${tb('back', 'Send backward', I.back)}${tb('delete', 'Delete (Del)', I.trash)}</div>
  <div class="dx-tgroup"><label class="dx-tbtn dx-color" title="Slide background"><span class="dx-swatch is-bg" aria-hidden="true"></span><input type="color" data-color="bg" value="#ffffff" aria-label="Slide background"></label>${tb('present', 'Present (F5)', I.play)}</div>
`;

const BODY = `
  <div class="pdm-layout">
    <nav class="pdm-rail" aria-label="Slides"></nav>
    <div class="pdm-main">
      <div class="pdm-stage-wrap"><div class="pdm-stage" tabindex="0" aria-label="Slide"></div></div>
      <label class="pdm-notes"><span>Speaker notes</span><textarea rows="3" placeholder="Notes for this slide"></textarea></label>
    </div>
  </div>
`;

let styleInjected = false;
function injectDeckCss() {
  if (styleInjected || typeof document === 'undefined') return;
  const el = document.createElement('style');
  el.dataset.podium = '';
  el.textContent = DECK_CSS;
  document.head?.appendChild(el);
  styleInjected = true;
}

const clone = (o) => JSON.parse(JSON.stringify(o));

export function newDeck() {
  return { width: 960, height: 540, slides: [layoutSlide('title', 960, 540)] };
}

export function layoutSlide(kind, W, H) {
  const title = (y, h, size, text) => ({ type: 'box', x: W * 0.08, y, w: W * 0.84, h, valign: 'middle', paragraphs: [{ align: kind === 'title' ? 'center' : undefined, runs: [{ text, size, bold: kind === 'title' || undefined }] }] });
  if (kind === 'title') {
    return { notes: '', elements: [title(H * 0.3, H * 0.22, 44, 'Presentation title'), { ...title(H * 0.54, H * 0.12, 22, 'Subtitle'), paragraphs: [{ align: 'center', runs: [{ text: 'Subtitle', size: 22, color: '555555' }] }] }] };
  }
  if (kind === 'content') {
    return { notes: '', elements: [title(H * 0.06, H * 0.16, 34, 'Slide title'), { type: 'box', x: W * 0.08, y: H * 0.26, w: W * 0.84, h: H * 0.64, paragraphs: [{ bullet: true, level: 0, runs: [{ text: 'First point', size: 24 }] }, { bullet: true, level: 0, runs: [{ text: 'Second point', size: 24 }] }] }] };
  }
  return { notes: '', elements: [] };
}

/** Read edited paragraphs back off a .dk-text element. */
export function readParagraphs(textEl, deck) {
  const toPt = (css) => {
    const m = /([\d.]+)cqw/.exec(css || '');
    return m ? Math.round((parseFloat(m[1]) * deck.width) / 100 * 10) / 10 : undefined;
  };
  const colorHex = (c) => {
    const s = String(c || '').trim().toLowerCase();
    let m = /^#([0-9a-f]{6})$/.exec(s);
    if (m) return m[1];
    m = /^#([0-9a-f])([0-9a-f])([0-9a-f])$/.exec(s);
    if (m) return m[1] + m[1] + m[2] + m[2] + m[3] + m[3];
    m = /^rgba?\((\d+),\s*(\d+),\s*(\d+)/.exec(s);
    if (m) return [m[1], m[2], m[3]].map(v => (+v).toString(16).padStart(2, '0')).join('');
    return undefined;
  };
  const paras = [];
  const blocks = [...textEl.children].filter(n => n.nodeType === 1);
  const list = blocks.length ? blocks : [textEl];
  for (const p of list) {
    const pStyle = p.getAttribute?.('style') || '';
    const para = { runs: [], level: +(p.dataset?.level || 0) || 0 };
    if (p.classList?.contains('is-bullet')) para.bullet = true;
    const align = /text-align:\s*(left|center|right|justify)/.exec(pStyle)?.[1];
    if (align && align !== 'left') para.align = align;
    const baseSize = toPt(/font-size:\s*([\d.]+cqw)/.exec(pStyle)?.[1]) || 18;
    const walk = (node, marks) => {
      for (let n = node.firstChild; n; n = n.nextSibling) {
        if (n.nodeType === 3) { if (n.nodeValue) para.runs.push({ text: n.nodeValue, ...marks }); continue; }
        if (n.nodeType !== 1) continue;
        const tag = n.tagName.toLowerCase();
        if (tag === 'br') { if (n.nextSibling) para.runs.push({ text: '\n', ...marks }); continue; }
        const st = n.getAttribute('style') || '';
        const m = { ...marks };
        if (tag === 'b' || tag === 'strong' || /font-weight:\s*(700|bold)/.test(st)) m.bold = true;
        if (/font-weight:\s*(400|normal)/.test(st)) delete m.bold;
        if (tag === 'i' || tag === 'em' || /font-style:\s*italic/.test(st)) m.italic = true;
        if (tag === 'u' || /underline/.test(st)) m.underline = true;
        if (tag === 's' || tag === 'strike' || /line-through/.test(st)) m.strike = true;
        const size = toPt(/font-size:\s*([\d.]+cqw)/.exec(st)?.[1]);
        if (size) m.size = size;
        const color = colorHex(n.getAttribute('color') || /(?:^|;)\s*color:\s*([^;]+)/.exec(st)?.[1]);
        if (color) m.color = color;
        if (tag === 'div' || tag === 'p') {
          // A browser that splits the paragraph on Enter adds a nested block.
          if (para.runs.length) para.runs.push({ text: '\n', ...m });
        }
        walk(n, m);
      }
    };
    walk(p, { size: baseSize });
    para.runs = mergeRunsSized(para.runs);
    if (!para.runs.length) { para.size = baseSize; delete para.bullet; }
    paras.push(para);
  }
  return paras;
}

export default {
  ownFileChrome: true,
  render(container, { artifact } = {}) {
    injectDeckCss();
    let deck = newDeck();
    let current = 0;
    let selected = -1; // element index on the current slide
    let editingText = false;
    let undo = [], redo = [];

    const shell = mountShell(container, {
      tool: 'podium',
      defaultName: 'Untitled.pptx',
      accept: '.pptx,.ppt,.odp',
      toolbar: TOOLBAR,
      body: BODY,
      footer: '<span class="pdm-count" aria-live="polite"></span>',
      load: async (bytes, name) => {
        const ext = extOf(name);
        let next;
        if (ext === 'pptx') next = await (await import('../lib/docs/pptx.js')).pptxToDeck(bytes);
        else if (ext === 'odp') next = await (await import('../lib/docs/odf.js')).odpToDeck(bytes);
        else if (ext === 'ppt') next = await (await import('../lib/docs/legacy.js')).pptToDeck(bytes);
        else throw new Error('Podium opens .pptx, .odp and .ppt files');
        deck = next; current = 0; selected = -1; undo = []; redo = [];
        renderAll();
      },
      selection: () => container.querySelector('.dk-el.is-selected')?.innerText || '',
      blank: () => { deck = newDeck(); current = 0; selected = -1; undo = []; redo = []; renderAll(); },
      serialize: async (format) => {
        finishText();
        const title = shell.state.name.replace(/\.[^.]+$/, '');
        if (format === 'odp') return (await import('../lib/docs/odf.js')).deckToOdp({ ...deck, title });
        return (await import('../lib/docs/pptx.js')).deckToPptx(deck, { title });
      },
    });
    this._shell = shell;

    const root = shell.root;
    const rail = root.querySelector('.pdm-rail');
    const stage = root.querySelector('.pdm-stage');
    const notes = root.querySelector('.pdm-notes textarea');
    const count = root.querySelector('.pdm-count');
    const slide = () => deck.slides[current];

    /* ---------- history ---------- */
    const record = () => { undo.push(JSON.stringify({ deck, current })); if (undo.length > 80) undo.shift(); redo = []; };
    const changed = () => { shell.markDirty(); renderRail(); };
    const doUndo = () => { const s = undo.pop(); if (!s) return; redo.push(JSON.stringify({ deck, current })); ({ deck, current } = JSON.parse(s)); selected = -1; shell.markDirty(); renderAll(); };
    const doRedo = () => { const s = redo.pop(); if (!s) return; undo.push(JSON.stringify({ deck, current })); ({ deck, current } = JSON.parse(s)); selected = -1; shell.markDirty(); renderAll(); };

    /* ---------- rendering ---------- */
    function renderRail() {
      rail.innerHTML = deck.slides.map((s, i) => `
        <div class="pdm-thumb${i === current ? ' is-current' : ''}" data-slide="${i}" role="button" tabindex="0" aria-label="Slide ${i + 1}" aria-current="${i === current}">
          <span class="pdm-num">${i + 1}</span>
          <div class="pdm-mini">${slideHtml(s, deck)}</div>
        </div>`).join('') + `
        <div class="pdm-rail-actions">
          <button type="button" class="dx-tbtn" data-rail="dup" title="Duplicate slide" aria-label="Duplicate slide">${icon(I.copy)}</button>
          <button type="button" class="dx-tbtn" data-rail="up" title="Move slide up" aria-label="Move slide up">${icon(I.up)}</button>
          <button type="button" class="dx-tbtn" data-rail="down" title="Move slide down" aria-label="Move slide down">${icon(I.down)}</button>
          <button type="button" class="dx-tbtn" data-rail="del" title="Delete slide" aria-label="Delete slide">${icon(I.trash)}</button>
        </div>`;
      count.textContent = `Slide ${current + 1} of ${deck.slides.length}`;
    }

    function renderStage() {
      editingText = false;
      stage.innerHTML = slideHtml(slide(), deck, { editable: true });
      if (selected >= 0) {
        const node = stage.querySelector(`.dk-el[data-i="${selected}"]`);
        if (node) {
          node.classList.add('is-selected');
          node.insertAdjacentHTML('beforeend', '<span class="pdm-handle" data-handle="se"></span><span class="pdm-handle pdm-handle-nw" data-handle="nw"></span>');
        } else selected = -1;
      }
      notes.value = slide().notes || '';
      root.querySelectorAll('[data-needs-sel]').forEach(g => g.classList.toggle('is-off', selected < 0));
      root.querySelectorAll('[data-needs-box]').forEach(g => g.classList.toggle('is-off', !(selected >= 0 && slide().elements[selected]?.type === 'box')));
      const bg = root.querySelector('[data-color="bg"]');
      if (bg) bg.value = `#${slide().background || 'ffffff'}`;
    }

    function renderAll() { renderRail(); renderStage(); }

    /* ---------- text editing ---------- */
    function beginText(i) {
      const node = stage.querySelector(`.dk-el[data-i="${i}"] .dk-text`);
      if (!node) return;
      editingText = true;
      record();
      node.setAttribute('contenteditable', 'true');
      node.focus();
      node.addEventListener('blur', () => finishText(), { once: true });
    }
    function finishText() {
      if (!editingText) return;
      const node = stage.querySelector('.dk-text[contenteditable="true"]');
      editingText = false;
      if (!node) return;
      const i = +node.closest('.dk-el').dataset.i;
      const el = slide().elements[i];
      if (el) el.paragraphs = readParagraphs(node, deck);
      node.setAttribute('contenteditable', 'false');
      changed();
    }

    /* ---------- pointer: select, move, resize ---------- */
    stage.addEventListener('pointerdown', (e) => {
      const elNode = e.target.closest('.dk-el');
      const handle = e.target.closest('[data-handle]');
      if (editingText && e.target.closest('.dk-text[contenteditable="true"]')) return;
      if (editingText) finishText();
      if (!elNode) { selected = -1; renderStage(); return; }
      const i = +elNode.dataset.i;
      if (selected !== i) { selected = i; renderStage(); }
      const slideEl = stage.querySelector('.dk-slide');
      const rect = slideEl.getBoundingClientRect();
      const k = deck.width / (rect.width || deck.width);
      const el = slide().elements[i];
      const start = { x: e.clientX, y: e.clientY, ex: el.x, ey: el.y, ew: el.w, eh: el.h };
      let moved = false;
      const onMove = (ev) => {
        const dx = (ev.clientX - start.x) * k, dy = (ev.clientY - start.y) * k;
        if (!moved && Math.abs(dx) + Math.abs(dy) < 3) return;
        if (!moved) { record(); moved = true; }
        if (handle?.dataset.handle === 'se') { el.w = Math.max(12, start.ew + dx); el.h = Math.max(12, start.eh + dy); }
        else if (handle?.dataset.handle === 'nw') { el.x = start.ex + dx; el.y = start.ey + dy; el.w = Math.max(12, start.ew - dx); el.h = Math.max(12, start.eh - dy); }
        else { el.x = start.ex + dx; el.y = start.ey + dy; }
        const node = stage.querySelector(`.dk-el[data-i="${i}"]`);
        if (node) {
          node.style.left = `${(el.x / deck.width) * 100}%`; node.style.top = `${(el.y / deck.height) * 100}%`;
          node.style.width = `${(el.w / deck.width) * 100}%`; node.style.height = `${(el.h / deck.height) * 100}%`;
        }
      };
      const onUp = () => {
        document.removeEventListener('pointermove', onMove);
        document.removeEventListener('pointerup', onUp);
        if (moved) changed();
      };
      document.addEventListener('pointermove', onMove);
      document.addEventListener('pointerup', onUp);
    });
    stage.addEventListener('dblclick', (e) => {
      const elNode = e.target.closest('.dk-el.dk-box');
      if (elNode) beginText(+elNode.dataset.i);
    });

    /* ---------- keyboard ---------- */
    const onKey = (e) => {
      if (!root.isConnected) return;
      if (root.querySelector('.pdm-show')) return; // the slideshow has its own keys
      const inField = e.target.closest?.('input, textarea, select, [contenteditable="true"]');
      const mod = e.ctrlKey || e.metaKey;
      if (e.key === 'F5') { e.preventDefault(); present(); return; }
      if (inField) { if (e.key === 'Escape' && editingText) { finishText(); renderStage(); } return; }
      if (!root.contains(e.target) && e.target !== document.body) return;
      if (mod && e.key.toLowerCase() === 'z') { e.preventDefault(); e.shiftKey ? doRedo() : doUndo(); return; }
      if (mod && e.key.toLowerCase() === 'y') { e.preventDefault(); doRedo(); return; }
      if (selected >= 0 && (e.key === 'Delete' || e.key === 'Backspace')) { e.preventDefault(); act('delete'); return; }
      if (selected >= 0 && e.key === 'Enter' && slide().elements[selected]?.type === 'box') { e.preventDefault(); beginText(selected); return; }
      if (selected >= 0 && e.key.startsWith('Arrow')) {
        e.preventDefault();
        const step = e.shiftKey ? 10 : 1;
        const el = slide().elements[selected];
        record();
        if (e.key === 'ArrowLeft') el.x -= step; if (e.key === 'ArrowRight') el.x += step;
        if (e.key === 'ArrowUp') el.y -= step; if (e.key === 'ArrowDown') el.y += step;
        renderStage(); changed();
        return;
      }
      if (selected < 0 && (e.key === 'PageDown' || e.key === 'PageUp')) { e.preventDefault(); goTo(current + (e.key === 'PageDown' ? 1 : -1)); }
    };
    document.addEventListener('keydown', onKey);

    function goTo(i) {
      finishText();
      current = Math.max(0, Math.min(deck.slides.length - 1, i));
      selected = -1;
      renderAll();
    }

    /* ---------- toolbar ---------- */
    const box = () => (selected >= 0 && slide().elements[selected]?.type === 'box' ? slide().elements[selected] : null);
    const eachRun = (fn) => { const b = box(); if (!b) return; for (const p of b.paragraphs) { for (const r of p.runs) fn(r, p); } };

    function addElement(el) {
      record();
      slide().elements.push(el);
      selected = slide().elements.length - 1;
      renderStage(); changed();
    }

    function act(a) {
      if (a !== 'bold' && a !== 'italic' && a !== 'underline') finishText();
      const W = deck.width, H = deck.height;
      if (a === 'undo') return doUndo();
      if (a === 'redo') return doRedo();
      if (a === 'present') return present();
      if (a === 'text') return addElement({ type: 'box', x: W * 0.3, y: H * 0.4, w: W * 0.4, h: H * 0.14, paragraphs: [{ runs: [{ text: 'Text', size: 24 }] }] });
      if (a === 'rect' || a === 'ellipse') return addElement({ type: 'box', shape: a, fill: '4a78d0', x: W * 0.38, y: H * 0.34, w: W * 0.24, h: H * 0.3, valign: 'middle', paragraphs: [{ align: 'center', runs: [{ text: '', size: 20, color: 'ffffff' }] }] });
      if (editingText && ['bold', 'italic', 'underline'].includes(a)) {
        try { document.execCommand(a); } catch { /* ignore */ }
        return;
      }
      const el = selected >= 0 ? slide().elements[selected] : null;
      if (!el) return;
      record();
      if (a === 'delete') { slide().elements.splice(selected, 1); selected = -1; }
      else if (a === 'front' && selected < slide().elements.length - 1) { slide().elements.splice(selected + 1, 0, slide().elements.splice(selected, 1)[0]); selected++; }
      else if (a === 'back' && selected > 0) { slide().elements.splice(selected - 1, 0, slide().elements.splice(selected, 1)[0]); selected--; }
      else if (a === 'bold' || a === 'italic' || a === 'underline') {
        const all = []; eachRun(r => all.push(r));
        const on = !all.every(r => r[a]);
        eachRun(r => { if (on) r[a] = true; else delete r[a]; });
      } else if (a === 'bigger' || a === 'smaller') {
        const f = a === 'bigger' ? 1.15 : 1 / 1.15;
        eachRun(r => { r.size = Math.max(6, Math.min(200, Math.round((r.size || 18) * f))); });
        for (const p of el.paragraphs || []) if (p.size) p.size = Math.max(6, Math.round(p.size * f));
      } else if (a === 'bullets') {
        const on = !(el.paragraphs || []).every(p => p.bullet);
        for (const p of el.paragraphs || []) { if (on) p.bullet = true; else delete p.bullet; }
      } else if (a.startsWith('align')) {
        const v = a.slice(5).toLowerCase();
        for (const p of el.paragraphs || []) { if (v === 'left') delete p.align; else p.align = v; }
      }
      renderStage(); changed();
    }

    root.querySelector('.dx-toolbar').addEventListener('mousedown', (e) => { if (e.target.closest('button')) e.preventDefault(); });
    root.querySelector('.dx-toolbar').addEventListener('click', (e) => {
      const a = e.target.closest('[data-act]')?.dataset.act;
      if (a) act(a);
    });
    root.querySelector('[data-new-slide]').addEventListener('change', (e) => {
      const kind = e.target.value;
      e.target.selectedIndex = 0;
      finishText();
      record();
      deck.slides.splice(current + 1, 0, layoutSlide(kind, deck.width, deck.height));
      current++;
      selected = -1;
      renderAll(); shell.markDirty();
    });
    root.querySelectorAll('[data-color]').forEach(inp => inp.addEventListener('change', () => {
      const hex = inp.value.replace('#', '').toLowerCase();
      const kind = inp.dataset.color;
      if (kind === 'text' && editingText) { try { document.execCommand('foreColor', false, inp.value); } catch { /* ignore */ } return; }
      finishText();
      record();
      if (kind === 'bg') slide().background = hex === 'ffffff' ? undefined : hex;
      else if (kind === 'fill' && selected >= 0 && slide().elements[selected].type === 'box') {
        const el = slide().elements[selected];
        el.fill = hex;
        if (!el.shape) el.shape = 'rect';
      } else if (kind === 'text') eachRun(r => { r.color = hex; });
      renderStage(); changed();
    }));
    root.querySelector('[data-image]').addEventListener('change', async (e) => {
      const file = e.target.files?.[0];
      e.target.value = '';
      if (!file) return;
      const src = await new Promise((resolve, reject) => { const r = new FileReader(); r.onload = () => resolve(r.result); r.onerror = reject; r.readAsDataURL(file); });
      const img = new Image();
      img.onload = () => {
        const W = deck.width, H = deck.height;
        const ratio = (img.naturalHeight || 3) / (img.naturalWidth || 4);
        let w = W * 0.4, h = w * ratio;
        if (h > H * 0.7) { h = H * 0.7; w = h / ratio; }
        addElement({ type: 'image', x: (W - w) / 2, y: (H - h) / 2, w, h, src });
      };
      img.src = src;
    });

    rail.addEventListener('click', (e) => {
      const b = e.target.closest('[data-rail]');
      if (b) {
        finishText();
        const r = b.dataset.rail;
        record();
        if (r === 'dup') { deck.slides.splice(current + 1, 0, clone(slide())); current++; }
        else if (r === 'up' && current > 0) { deck.slides.splice(current - 1, 0, deck.slides.splice(current, 1)[0]); current--; }
        else if (r === 'down' && current < deck.slides.length - 1) { deck.slides.splice(current + 1, 0, deck.slides.splice(current, 1)[0]); current++; }
        else if (r === 'del') {
          if (deck.slides.length === 1) deck.slides[0] = layoutSlide('blank', deck.width, deck.height);
          else { deck.slides.splice(current, 1); current = Math.min(current, deck.slides.length - 1); }
        } else undo.pop();
        selected = -1;
        renderAll(); shell.markDirty();
        return;
      }
      const t = e.target.closest('[data-slide]');
      if (t) goTo(+t.dataset.slide);
    });
    rail.addEventListener('keydown', (e) => {
      const t = e.target.closest('[data-slide]');
      if (t && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); goTo(+t.dataset.slide); }
    });

    notes.addEventListener('input', () => { slide().notes = notes.value; shell.markDirty(); });

    /* ---------- slideshow ---------- */
    function present() {
      finishText();
      let i = current;
      const show = document.createElement('div');
      show.className = 'pdm-show';
      show.tabIndex = 0;
      root.appendChild(show);
      const paintShow = () => {
        show.innerHTML = `<div class="pdm-show-slide" style="--ar:${deck.width / deck.height}">${slideHtml(deck.slides[i], deck)}</div><div class="pdm-show-hint">${i + 1} / ${deck.slides.length} · arrows to move, Esc to end</div>`;
      };
      const end = () => {
        document.removeEventListener('keydown', keys, true);
        if (document.fullscreenElement) document.exitFullscreen?.().catch(() => {});
        show.remove();
      };
      const keys = (e) => {
        if (['ArrowRight', 'ArrowDown', 'PageDown', ' ', 'Enter'].includes(e.key)) { e.preventDefault(); e.stopPropagation(); if (i < deck.slides.length - 1) { i++; paintShow(); } else end(); }
        else if (['ArrowLeft', 'ArrowUp', 'PageUp', 'Backspace'].includes(e.key)) { e.preventDefault(); e.stopPropagation(); if (i > 0) { i--; paintShow(); } }
        else if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); end(); }
      };
      show.addEventListener('click', () => { if (i < deck.slides.length - 1) { i++; paintShow(); } else end(); });
      document.addEventListener('keydown', keys, true);
      document.addEventListener('fullscreenchange', function onFs() { if (!document.fullscreenElement && show.isConnected) { document.removeEventListener('fullscreenchange', onFs); end(); } });
      paintShow();
      show.requestFullscreen?.().catch(() => {});
      show.focus();
    }

    this._deck = () => deck;
    this._teardown = () => document.removeEventListener('keydown', onKey);

    renderAll();
    const incoming = artifact || this._pending;
    if (incoming) this.setArtifact(incoming);
  },

  getArtifact() {
    const deck = this._deck?.();
    if (!deck) return null;
    const text = deck.slides.map((s, i) => [`## Slide ${i + 1}`, ...s.elements.filter(e => e.type === 'box').flatMap(e => e.paragraphs.map(p => `${p.bullet ? '- ' : ''}${p.runs.map(r => r.text).join('')}`)).filter(l => l.trim())].join('\n')).join('\n\n');
    return { kind: 'markdown', text };
  },

  async setArtifact(a) {
    if (!a) return;
    if (!this._shell) { this._pending = a; return; }
    if (!a.blob && !a.path && !(a.content instanceof Blob)) return; // Podium only opens real presentation files
    try { await this._shell.openArtifact(a); } catch (err) { console.warn('Podium could not open that file', err); }
  },

  destroy() {
    this._teardown?.();
    this._shell?.destroy();
    this._shell = this._deck = this._teardown = this._pending = null;
    document.querySelector('.pdm-show')?.remove();
  },
};
