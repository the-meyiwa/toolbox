/* Contrast Checker — WCAG ratios, and a suggestion when you fail.

   Most checkers tell you that you failed and stop. Failing is the easy
   part; the useful part is the nearest colour that passes, which is what
   the "fix it" control does. */

import { copyText } from '../utils.js';

/* ---------------- colour maths ---------------- */

function parseColor(str) {
  const s = String(str).trim().toLowerCase();
  let m = s.match(/^#?([0-9a-f]{3})$/i);
  if (m) return [...m[1]].map(c => parseInt(c + c, 16));
  m = s.match(/^#?([0-9a-f]{6})$/i);
  if (m) return [0, 2, 4].map(i => parseInt(m[1].slice(i, i + 2), 16));
  m = s.match(/^rgba?\(([^)]+)\)$/);
  if (m) {
    const p = m[1].split(/[,\s/]+/).filter(Boolean).map(Number);
    if (p.length >= 3 && p.slice(0, 3).every(n => Number.isFinite(n))) return p.slice(0, 3);
  }
  return null;
}

const toHex = (rgb) => '#' + rgb.map(v => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, '0')).join('');

/* WCAG relative luminance. The 0.03928 branch linearises sRGB. */
function luminance([r, g, b]) {
  const f = (v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}

function ratio(a, b) {
  const la = luminance(a), lb = luminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

/** Walk a colour toward black or white until it clears the target. */
function nudgeToPass(fg, bg, target) {
  const bgLum = luminance(bg);
  // Move away from the background: darken on light grounds, lighten on dark.
  const toward = bgLum > 0.5 ? [0, 0, 0] : [255, 255, 255];
  let best = fg;
  for (let t = 0; t <= 1.0001; t += 0.02) {
    const candidate = fg.map((c, i) => c + (toward[i] - c) * t);
    best = candidate;
    if (ratio(candidate.map(Math.round), bg) >= target) break;
  }
  return best.map(Math.round);
}

const LEVELS = [
  { id: 'aa-normal',  label: 'AA · normal text',  need: 4.5 },
  { id: 'aa-large',   label: 'AA · large text',   need: 3.0 },
  { id: 'aaa-normal', label: 'AAA · normal text', need: 7.0 },
  { id: 'aaa-large',  label: 'AAA · large text',  need: 4.5 },
  { id: 'ui',         label: 'UI components',     need: 3.0 },
];

export default {
  render(container, { analytics } = {}) {
    container.innerHTML = `
      <div class="cc">
        <div class="cc-controls">
          <div class="cc-field">
            <label class="tool-label" for="cc-fg">Text colour</label>
            <div class="cc-input-row">
              <input type="color" id="cc-fg-swatch" value="#767676" aria-label="Pick text colour">
              <input type="text" class="tool-input" id="cc-fg" value="#767676" spellcheck="false">
            </div>
          </div>
          <button class="btn btn-sm" id="cc-swap" title="Swap the two colours" aria-label="Swap colours">⇅</button>
          <div class="cc-field">
            <label class="tool-label" for="cc-bg">Background</label>
            <div class="cc-input-row">
              <input type="color" id="cc-bg-swatch" value="#ffffff" aria-label="Pick background colour">
              <input type="text" class="tool-input" id="cc-bg" value="#ffffff" spellcheck="false">
            </div>
          </div>
        </div>

        <div class="cc-preview" id="cc-preview">
          <p class="cc-sample-lg" id="cc-sample-lg">Large text, 24px</p>
          <p class="cc-sample" id="cc-sample">Body text at a normal size — the sentence you would actually have to read.</p>
        </div>

        <div class="cc-score">
          <div class="cc-ratio"><span id="cc-ratio">—</span><small>: 1</small></div>
          <div class="cc-levels" id="cc-levels"></div>
        </div>

        <div id="cc-fix"></div>
      </div>`;

    const $ = (id) => container.querySelector('#' + id);
    const fgIn = $('cc-fg'), bgIn = $('cc-bg');
    const fgSw = $('cc-fg-swatch'), bgSw = $('cc-bg-swatch');
    let announced = false;

    function update() {
      const fg = parseColor(fgIn.value);
      const bg = parseColor(bgIn.value);
      const levelsEl = $('cc-levels');

      if (!fg || !bg) {
        $('cc-ratio').textContent = '—';
        levelsEl.innerHTML = `<p class="cc-invalid">Enter a colour as hex (#336699) or rgb(51, 102, 153).</p>`;
        $('cc-fix').innerHTML = '';
        return;
      }

      fgSw.value = toHex(fg);
      bgSw.value = toHex(bg);

      const r = ratio(fg, bg);
      $('cc-ratio').textContent = r.toFixed(2);

      const preview = $('cc-preview');
      preview.style.background = toHex(bg);
      preview.style.color = toHex(fg);

      levelsEl.innerHTML = LEVELS.map(l => {
        const pass = r >= l.need;
        return `<div class="cc-level ${pass ? 'is-pass' : 'is-fail'}">
          <span class="cc-level-mark">${pass ? '✓' : '✕'}</span>
          <span class="cc-level-name">${l.label}</span>
          <span class="cc-level-need">${l.need}</span>
        </div>`;
      }).join('');

      // Only offer a fix when it would actually change something.
      const target = 4.5;
      if (r < target) {
        const fixed = nudgeToPass(fg, bg, target);
        const fixedRatio = ratio(fixed, bg);
        $('cc-fix').innerHTML = `
          <div class="cc-suggest">
            <div>
              <strong>Nearest passing text colour</strong>
              <span>${toHex(fixed)} reaches ${fixedRatio.toFixed(2)}:1, clearing AA for normal text.</span>
            </div>
            <div class="cc-suggest-actions">
              <span class="cc-chip" style="background:${toHex(fixed)}"></span>
              <button class="btn btn-sm" id="cc-apply">Use it</button>
              <button class="btn btn-sm" id="cc-copy">Copy</button>
            </div>
          </div>`;
        $('cc-apply').addEventListener('click', () => {
          fgIn.value = toHex(fixed);
          update();
        });
        $('cc-copy').addEventListener('click', (e) => copyText(toHex(fixed), e.target));
      } else {
        $('cc-fix').innerHTML = '';
      }

      if (!announced) { announced = true; analytics?.started(); }
      analytics?.completed({ resultCount: 1 });
    }

    for (const el of [fgIn, bgIn]) el.addEventListener('input', update);
    fgSw.addEventListener('input', () => { fgIn.value = fgSw.value; update(); });
    bgSw.addEventListener('input', () => { bgIn.value = bgSw.value; update(); });
    $('cc-swap').addEventListener('click', () => {
      const t = fgIn.value; fgIn.value = bgIn.value; bgIn.value = t;
      update();
    });

    update();
  },

  destroy() {},
};
