/* ============================================================
   Colour Blindness Simulator — see an image or a palette the way
   people with each kind of colour vision deficiency do, and find
   the colour pairs that stop being distinguishable.
   ============================================================ */

import { DEFICIENCIES, simulatePixels, simulateRgb, hexToRgb, rgbToHex, confusablePairs } from '../lib/transforms/color-vision.js';
import { attachFileInput, dropZone, decodeImage } from '../lib/file-engine.js';
import { esc, saveBlob } from '../lib/kit/form.js';

const MAX_SIDE = 900;
const DEFAULT_PALETTE = '#d62728, #2ca02c, #1f77b4, #ff7f0e, #9467bd, #8c564b';

export default {
  render(container) {
    container.innerHTML = `
      <div class="kit">
        <div class="pw-seg kit-modes" role="radiogroup" aria-label="Mode">
          <button type="button" role="radio" data-mode="image" aria-checked="true">Image</button>
          <button type="button" role="radio" data-mode="palette" aria-checked="false">Palette</button>
        </div>
        <section data-pane="image">
          ${dropZone('cbs-zone', { label: 'Drop an image, chart or screenshot', hint: 'or click to choose · you can also paste', accept: 'image/*', multiple: false })}
          <div class="kit-thumbs" id="cbs-out" style="margin-top:16px; grid-template-columns:repeat(auto-fill,minmax(260px,1fr))"></div>
        </section>
        <section data-pane="palette" hidden>
          <div class="kit-field is-wide"><label for="cbs-colours">Colours (hex, separated by commas or lines)</label>
            <textarea class="tool-input" id="cbs-colours" rows="2" spellcheck="false">${DEFAULT_PALETTE}</textarea></div>
          <div class="kit-swatches" id="cbs-swatches" style="margin-top:16px"></div>
          <div id="cbs-pairs" style="margin-top:16px"></div>
        </section>
      </div>`;

    const out = container.querySelector('#cbs-out');
    const panes = container.querySelectorAll('[data-pane]');
    container.querySelector('.kit-modes').addEventListener('click', (e) => {
      const b = e.target.closest('button'); if (!b) return;
      for (const x of b.parentElement.children) x.setAttribute('aria-checked', String(x === b));
      panes.forEach((p) => { p.hidden = p.dataset.pane !== b.dataset.mode; });
    });

    /* ---- image ---- */
    const renderImage = async (file) => {
      out.innerHTML = '<p class="kit-note">Working…</p>';
      const img = await decodeImage(file);
      const src = img.bitmap;
      const w0 = img.width; const h0 = img.height;
      const s = Math.min(1, MAX_SIDE / Math.max(w0, h0));
      const w = Math.round(w0 * s); const h = Math.round(h0 * s);
      const base = document.createElement('canvas'); base.width = w; base.height = h;
      const bctx = base.getContext('2d'); bctx.drawImage(src, 0, 0, w, h);
      const original = bctx.getImageData(0, 0, w, h);
      img.close?.();
      out.innerHTML = '';
      const add = (label, note, data) => {
        const fig = document.createElement('figure');
        const c = document.createElement('canvas'); c.width = w; c.height = h;
        c.getContext('2d').putImageData(data, 0, 0);
        fig.append(c);
        const cap = document.createElement('figcaption');
        cap.innerHTML = `<strong>${esc(label)}</strong>${note ? ` · ${esc(note)}` : ''} <button type="button" class="btn btn-ghost btn-sm">Save</button>`;
        cap.querySelector('button').onclick = () => c.toBlob((b) => b && saveBlob(b, `${label.toLowerCase().replace(/\s+/g, '-')}.png`));
        fig.append(cap); out.append(fig);
      };
      add('Original', '', original);
      for (const d of DEFICIENCIES) {
        const copy = new ImageData(new Uint8ClampedArray(original.data), w, h);
        simulatePixels(copy.data, d.id);
        add(d.label, d.note, copy);
        await new Promise((r) => setTimeout(r, 0));
      }
    };
    const zone = container.querySelector('#cbs-zone');
    const input = zone.querySelector('input[type="file"]');
    this._detach = attachFileInput(zone, input, (files) => files[0] && renderImage(files[0]).catch((e) => { out.innerHTML = `<p class="kit-error">${esc(e.message)}</p>`; }), { accept: 'image/*' });

    /* ---- palette ---- */
    const text = container.querySelector('#cbs-colours');
    const sw = container.querySelector('#cbs-swatches');
    const pairs = container.querySelector('#cbs-pairs');
    const renderPalette = () => {
      const hexes = text.value.split(/[\s,;]+/).map((h) => h.trim()).filter((h) => hexToRgb(h)).map((h) => (h.startsWith('#') ? h : `#${h}`));
      const row = (label, note, map) => `<div class="kit-swatch"><div>${hexes.map((h) => `<i style="background:${map(h)}" title="${map(h)}"></i>`).join('')}</div><span><strong>${esc(label)}</strong>${note ? ` · ${esc(note)}` : ''}</span></div>`;
      sw.innerHTML = row('Original', '', (h) => h) + DEFICIENCIES.map((d) => row(d.label, '', (h) => rgbToHex(simulateRgb(hexToRgb(h), d.id)))).join('');
      const issues = DEFICIENCIES.flatMap((d) => confusablePairs(hexes, d.id).map((p) => ({ ...p, d })));
      pairs.innerHTML = !hexes.length ? '' : issues.length
        ? `<h4 class="kit-h">Pairs that become hard to tell apart</h4><div class="kit-table-wrap"><table class="kit-table"><thead><tr><th>Colours</th><th>For</th><th>Difference (ΔE)</th></tr></thead><tbody>${
          issues.map((p) => `<tr><td><span style="display:inline-block;width:14px;height:14px;border-radius:3px;background:${p.a};vertical-align:middle"></span> ${esc(p.a)} &amp; <span style="display:inline-block;width:14px;height:14px;border-radius:3px;background:${p.b};vertical-align:middle"></span> ${esc(p.b)}</td><td>${esc(p.d.label)}</td><td class="num">${p.before.toFixed(0)} → ${p.after.toFixed(1)}</td></tr>`).join('')}</tbody></table></div><p class="kit-note">Under about 12 is hard to tell apart. Add labels, patterns or a lightness difference rather than relying on hue.</p>`
        : '<p class="kit-note"><span class="kit-badge is-ok">No problem pairs</span> Every pair stays distinguishable under all seven simulations.</p>';
    };
    text.addEventListener('input', renderPalette);
    renderPalette();
  },

  destroy() { this._detach?.(); },
};
