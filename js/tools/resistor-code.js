/* Resistor Colour Code — read the bands, or find the bands for a value.

   Works in both directions, because both are real needs: you have a
   resistor and cannot read it, or you need a value and want to know what
   to look for in the drawer. */

import { statGrid, num, escapeHtml } from '../lib/biz.js';

const BANDS = [
  { name: 'Black',  hex: '#111111', digit: 0, mult: 1e0,  text: '#fff' },
  { name: 'Brown',  hex: '#8b5a2b', digit: 1, mult: 1e1,  tol: 1,    ppm: 100, text: '#fff' },
  { name: 'Red',    hex: '#c0392b', digit: 2, mult: 1e2,  tol: 2,    ppm: 50,  text: '#fff' },
  { name: 'Orange', hex: '#e07b39', digit: 3, mult: 1e3,  ppm: 15 },
  { name: 'Yellow', hex: '#e8c33a', digit: 4, mult: 1e4,  ppm: 25 },
  { name: 'Green',  hex: '#2e7d52', digit: 5, mult: 1e5,  tol: 0.5,  text: '#fff' },
  { name: 'Blue',   hex: '#2f6f9f', digit: 6, mult: 1e6,  tol: 0.25, text: '#fff' },
  { name: 'Violet', hex: '#7d5ba6', digit: 7, mult: 1e7,  tol: 0.1,  text: '#fff' },
  { name: 'Grey',   hex: '#8a8f94', digit: 8, mult: 1e8,  tol: 0.05, text: '#fff' },
  { name: 'White',  hex: '#f2f2f0', digit: 9, mult: 1e9 },
  { name: 'Gold',   hex: '#c9a227', mult: 1e-1, tol: 5 },
  { name: 'Silver', hex: '#b8bcc0', mult: 1e-2, tol: 10 },
];

const digits = BANDS.filter(b => b.digit !== undefined);
const mults  = BANDS.filter(b => b.mult !== undefined);
const tols   = BANDS.filter(b => b.tol !== undefined);

/** E24 series — the values a resistor is actually made in. */
const E24 = [10, 11, 12, 13, 15, 16, 18, 20, 22, 24, 27, 30, 33, 36, 39, 43, 47, 51, 56, 62, 68, 75, 82, 91];

const fmtOhms = (v) => {
  if (!Number.isFinite(v)) return '—';
  if (v >= 1e9) return `${num(v / 1e9, 2)} GΩ`;
  if (v >= 1e6) return `${num(v / 1e6, 2)} MΩ`;
  if (v >= 1e3) return `${num(v / 1e3, 2)} kΩ`;
  if (v >= 1)   return `${num(v, 2)} Ω`;
  return `${num(v, 3)} Ω`;
};

export default {
  render(container, { analytics } = {}) {
    const state = { count: 4, bands: [1, 0, 2, 10] };   // brown-black-red-gold = 1 kΩ ±5%

    const swatch = (i, list, selected) => `
      <div class="rc-col">
        <label class="tool-label">${['1st digit', '2nd digit', '3rd digit', 'Multiplier', 'Tolerance', 'Temp. coeff.'][i]}</label>
        <div class="rc-swatches" data-band="${i}">
          ${list.map(b => {
            const idx = BANDS.indexOf(b);
            return `<button class="rc-sw${idx === selected ? ' is-on' : ''}" data-val="${idx}"
                     title="${b.name}" style="background:${b.hex}${b.name === 'White' ? ';border-color:#ccc' : ''}"></button>`;
          }).join('')}
        </div>
      </div>`;

    container.innerHTML = `
      <div class="rc">
        <div class="btn-group t3d-seg" id="rc-count">
          ${[3, 4, 5, 6].map(n => `<button class="btn btn-sm${n === 4 ? ' is-active' : ''}" data-count="${n}">${n} bands</button>`).join('')}
        </div>

        <svg class="rc-body" viewBox="0 0 340 90" aria-hidden="true">
          <line x1="0" y1="45" x2="340" y2="45" stroke="#9aa0a6" stroke-width="3"/>
          <rect x="60" y="18" width="220" height="54" rx="16" fill="#d8c9a3" stroke="#b9a87f"/>
          <g id="rc-bands"></g>
        </svg>

        <div class="rc-grid" id="rc-grid"></div>
        <div id="rc-out"></div>

        <h3 class="cq-h" style="margin-top:28px;">Find the bands for a value</h3>
        <div class="tool-row">
          <div class="biz-field" style="flex:1;">
            <label class="tool-label" for="rc-value">Resistance</label>
            <input type="text" class="tool-input" id="rc-value" placeholder="e.g. 4k7, 220, 1M, 3300">
            <p class="biz-hint">Understands 4k7, 4.7k, 4700 and 1M.</p>
          </div>
        </div>
        <div id="rc-reverse"></div>
      </div>`;

    const $ = (id) => container.querySelector('#' + id);
    let started = false;

    function bandSlots() {
      // 3 band: d,d,mult · 4: d,d,mult,tol · 5: d,d,d,mult,tol · 6: +tempco
      if (state.count === 3) return [digits, digits, mults];
      if (state.count === 4) return [digits, digits, mults, tols];
      if (state.count === 5) return [digits, digits, digits, mults, tols];
      return [digits, digits, digits, mults, tols, BANDS.filter(b => b.ppm !== undefined)];
    }

    function value() {
      const n = state.count;
      const digitCount = n >= 5 ? 3 : 2;
      let significant = 0;
      for (let i = 0; i < digitCount; i++) significant = significant * 10 + (BANDS[state.bands[i]]?.digit ?? 0);
      const mult = BANDS[state.bands[digitCount]]?.mult ?? 1;
      const tol = n === 3 ? 20 : (BANDS[state.bands[digitCount + 1]]?.tol ?? null);
      const ppm = n === 6 ? (BANDS[state.bands[5]]?.ppm ?? null) : null;
      return { ohms: significant * mult, tol, ppm };
    }

    function render() {
      const slots = bandSlots();
      // keep selections valid for the current band count
      state.bands = slots.map((list, i) => {
        const cur = state.bands[i];
        return list.includes(BANDS[cur]) ? cur : BANDS.indexOf(list[0]);
      });

      $('rc-grid').innerHTML = slots.map((list, i) => {
        const labelIdx = state.count >= 5 ? i : (i < 2 ? i : i + 1);
        return swatch(labelIdx, list, state.bands[i]).replace('data-band="' + labelIdx + '"', 'data-band="' + i + '"');
      }).join('');

      const gap = 200 / slots.length;
      $('rc-bands').innerHTML = slots.map((_, i) => {
        const b = BANDS[state.bands[i]];
        return `<rect x="${72 + i * gap}" y="18" width="14" height="54" fill="${b.hex}"
                      stroke="${b.name === 'White' ? '#ccc' : 'none'}"/>`;
      }).join('');

      const { ohms, tol, ppm } = value();
      const spread = tol ? ohms * tol / 100 : 0;
      $('rc-out').innerHTML = statGrid([
        { label: 'Value', value: fmtOhms(ohms) },
        { label: 'Tolerance', value: tol === null ? '—' : `± ${tol}%` },
        ...(tol ? [{ label: 'Range', value: `${fmtOhms(ohms - spread)} – ${fmtOhms(ohms + spread)}` }] : []),
        ...(ppm ? [{ label: 'Temp. coefficient', value: `${ppm} ppm/°C` }] : []),
      ]);

      if (!started) { started = true; analytics?.started(); }
      analytics?.completed({ resultCount: 1 });
    }

    $('rc-grid').addEventListener('click', (e) => {
      const sw = e.target.closest('[data-val]');
      if (!sw) return;
      const band = Number(sw.closest('[data-band]').dataset.band);
      state.bands[band] = Number(sw.dataset.val);
      render();
    });

    $('rc-count').addEventListener('click', (e) => {
      const b = e.target.closest('[data-count]');
      if (!b) return;
      for (const x of container.querySelectorAll('#rc-count .btn')) x.classList.toggle('is-active', x === b);
      state.count = Number(b.dataset.count);
      render();
    });

    /* ---------------- value → bands ---------------- */

    $('rc-value').addEventListener('input', (e) => {
      const raw = e.target.value.trim().toLowerCase().replace(/\s|ω|ohms?/g, '');
      // Accept 4k7 as well as 4.7k — both are how people actually write it.
      const m = raw.match(/^(\d*\.?\d*)([rkmg]?)(\d*)$/);
      if (!m || !raw) { $('rc-reverse').innerHTML = ''; return; }

      const scale = { '': 1, r: 1, k: 1e3, m: 1e6, g: 1e9 }[m[2]] ?? 1;
      const base = m[3] ? Number(`${m[1]}.${m[3]}`) : Number(m[1]);
      const ohms = base * scale;
      if (!Number.isFinite(ohms) || ohms <= 0) { $('rc-reverse').innerHTML = ''; return; }

      const exp = Math.floor(Math.log10(ohms));
      const sig = Math.round(ohms / 10 ** (exp - 1));
      const d1 = Math.floor(sig / 10), d2 = sig % 10;
      const multExp = exp - 1;
      const mult = mults.find(b => Math.abs(Math.log10(b.mult) - multExp) < 0.01);

      const nearestE24 = E24.reduce((best, e) => {
        const cand = e * 10 ** (exp - 1);
        return Math.abs(cand - ohms) < Math.abs(best - ohms) ? cand : best;
      }, E24[0] * 10 ** (exp - 1));

      $('rc-reverse').innerHTML = mult ? `
        <div class="rc-result">
          <div class="rc-chips">
            ${[digits[d1], digits[d2], mult, tols.find(t => t.tol === 5)].map(b => `
              <span class="rc-chip" style="background:${b.hex};color:${b.text || '#111'}">${b.name}</span>`).join('')}
          </div>
          <p class="biz-explain">${fmtOhms(ohms)} reads ${escapeHtml(digits[d1].name.toLowerCase())},
            ${escapeHtml(digits[d2].name.toLowerCase())}, ${escapeHtml(mult.name.toLowerCase())} — plus gold for ±5%.</p>
          ${Math.abs(nearestE24 - ohms) > ohms * 0.01
            ? `<p class="biz-explain">Nearest standard E24 value is <strong>${fmtOhms(nearestE24)}</strong> — ${fmtOhms(ohms)} is not a value resistors are made in.</p>`
            : `<p class="biz-explain">That is a standard E24 value, so it will be on the shelf.</p>`}
        </div>` : `<p class="biz-explain">That value is outside the range the colour code covers.</p>`;
    });

    render();
  },

  destroy() {},
};
