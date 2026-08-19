/* Ohm's Law & Power — fill in any two, get the other two.

   Written the way the calculation is actually used on a bench: you know
   two quantities and want the rest, so the tool solves from whichever
   pair you filled rather than demanding a fixed set. */

import { field, statGrid, num, liveCompute, escapeHtml } from '../lib/biz.js';

const eng = (v, unit) => {
  if (!Number.isFinite(v)) return '—';
  const a = Math.abs(v);
  if (a === 0) return `0 ${unit}`;
  const steps = [
    [1e9, 'G'], [1e6, 'M'], [1e3, 'k'], [1, ''], [1e-3, 'm'], [1e-6, 'µ'], [1e-9, 'n'], [1e-12, 'p'],
  ];
  for (const [mag, pre] of steps) {
    if (a >= mag) return `${num(v / mag, v / mag >= 100 ? 1 : 3)} ${pre}${unit}`;
  }
  return `${num(v, 4)} ${unit}`;
};

export default {
  render(container, { analytics } = {}) {
    container.innerHTML = `
      <div class="tool-split">
        <div class="tool-section">
          <p class="biz-hint" style="margin-bottom:14px;">
            Enter any <strong>two</strong> values and the other two are worked out.
            Leave the ones you do not know empty.
          </p>
          ${field('Voltage', 'ol-v', '', { suffix: 'V', min: 0, placeholder: 'e.g. 12' })}
          ${field('Current', 'ol-i', '', { suffix: 'A', min: 0, placeholder: 'e.g. 0.5' })}
          ${field('Resistance', 'ol-r', '', { suffix: 'Ω', min: 0, placeholder: 'e.g. 24' })}
          ${field('Power', 'ol-p', '', { suffix: 'W', min: 0, placeholder: 'e.g. 6' })}
          <button class="btn btn-secondary btn-sm" id="ol-clear" style="margin-top:14px;">Clear all</button>
        </div>

        <div class="tool-section">
          <div id="ol-out"></div>
          <div id="ol-explain"></div>

          <h3 class="cq-h" style="margin-top:26px;">Series and parallel resistance</h3>
          <div class="biz-field">
            <label class="tool-label" for="ol-list">Resistor values</label>
            <input type="text" class="tool-input" id="ol-list" value="220, 330, 470" placeholder="220, 330, 470">
            <p class="biz-hint">Comma separated, in ohms.</p>
          </div>
          <div id="ol-combo"></div>
        </div>
      </div>`;

    const $ = (id) => container.querySelector('#' + id);
    const inputs = ['ol-v', 'ol-i', 'ol-r', 'ol-p'].map($);
    let started = false;

    const readVal = (el) => {
      const raw = el.value.trim();
      if (!raw) return null;
      const n = Number(raw);
      return Number.isFinite(n) && n >= 0 ? n : null;
    };

    function compute() {
      let [V, I, R, P] = inputs.map(readVal);
      const given = [V, I, R, P].filter(v => v !== null).length;

      if (given < 2) {
        $('ol-out').innerHTML = '';
        $('ol-explain').innerHTML = `<p class="biz-explain">Fill in any two boxes above.</p>`;
        return;
      }

      let used = '';
      // Solve from whichever pair the user actually supplied.
      if (V !== null && I !== null)       { R = I ? V / I : Infinity; P = V * I; used = 'R = V ÷ I and P = V × I'; }
      else if (V !== null && R !== null)  { I = R ? V / R : Infinity; P = R ? (V * V) / R : Infinity; used = 'I = V ÷ R and P = V² ÷ R'; }
      else if (V !== null && P !== null)  { I = V ? P / V : Infinity; R = P ? (V * V) / P : Infinity; used = 'I = P ÷ V and R = V² ÷ P'; }
      else if (I !== null && R !== null)  { V = I * R; P = I * I * R; used = 'V = I × R and P = I² × R'; }
      else if (I !== null && P !== null)  { V = I ? P / I : Infinity; R = I ? P / (I * I) : Infinity; used = 'V = P ÷ I and R = P ÷ I²'; }
      else if (R !== null && P !== null)  { V = Math.sqrt(P * R); I = R ? Math.sqrt(P / R) : Infinity; used = 'V = √(P × R) and I = √(P ÷ R)'; }

      $('ol-out').innerHTML = statGrid([
        { label: 'Voltage', value: eng(V, 'V') },
        { label: 'Current', value: eng(I, 'A') },
        { label: 'Resistance', value: eng(R, 'Ω') },
        { label: 'Power', value: eng(P, 'W') },
      ]);

      // A resistor's power rating is the thing people forget until it burns.
      const rating = P > 0
        ? [0.125, 0.25, 0.5, 1, 2, 5, 10, 25, 50].find(r => r >= P * 2)
        : null;

      $('ol-explain').innerHTML = `
        <p class="biz-explain">Using ${escapeHtml(used)}.</p>
        ${rating ? `<p class="biz-explain">At ${eng(P, 'W')} dissipation, fit a resistor rated at least
          <strong>${rating} W</strong> — twice the calculated power is the usual derating rule.</p>` : ''}
        ${P > 0 && P < 1e12 ? `<p class="biz-explain">Running continuously that is
          ${num(P * 24 / 1000, 3)} kWh per day.</p>` : ''}`;

      if (!started) { started = true; analytics?.started(); }
      analytics?.completed({ resultCount: 1 });
    }

    function combos() {
      const vals = $('ol-list').value.split(/[,\s]+/).map(Number).filter(n => Number.isFinite(n) && n > 0);
      if (vals.length < 2) { $('ol-combo').innerHTML = ''; return; }
      const series = vals.reduce((s, r) => s + r, 0);
      const parallel = 1 / vals.reduce((s, r) => s + 1 / r, 0);
      $('ol-combo').innerHTML = statGrid([
        { label: `In series (${vals.length})`, value: eng(series, 'Ω') },
        { label: 'In parallel', value: eng(parallel, 'Ω') },
      ]);
    }

    liveCompute(container, () => { compute(); combos(); });

    $('ol-clear').addEventListener('click', () => {
      for (const el of inputs) el.value = '';
      compute();
    });
  },

  destroy() {},
};
