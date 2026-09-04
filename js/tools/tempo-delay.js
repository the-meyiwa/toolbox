/* Tempo & Delay Times — the numbers you type into a plugin.

   Producers need delay and reverb times in milliseconds that line up
   with the track's tempo, and Hz for tempo-synced filter movement. Doing
   it by hand mid-session is a nuisance; this is the table you actually
   want, plus tap tempo for working out a track's BPM by ear. */

import { NOTE_VALUES, noteMs, tempoMark } from '../lib/music.js';
import { statGrid, dataTable, num } from '../lib/biz.js';

export default {
  render(container, { analytics } = {}) {
    const state = { bpm: 120, beats: 4 };

    container.innerHTML = `
      <div class="tmp">
        <div class="tmp-head">
          <div class="tmp-bpm">
            <input type="number" class="tool-input" id="td-bpm" value="120" min="20" max="300" step="0.1" aria-label="Tempo">
            <span>BPM</span>
          </div>
          <div class="tmp-meta">
            <span id="td-mark">Moderato</span>
            <button class="btn btn-sm" id="td-tap">Tap tempo</button>
            <span class="met-tap-hint" id="td-tap-hint"></span>
          </div>
        </div>

        <div id="td-summary"></div>

        <h3 class="cq-h" style="margin-top:24px;">Delay and note lengths</h3>
        <div id="td-table"></div>

        <h3 class="cq-h" style="margin-top:26px;">Bar and phrase lengths</h3>
        <div class="tool-row" style="align-items:flex-end; gap:14px; flex-wrap:wrap;">
          <label class="fz-ctl"><span>Time signature</span>
            <select class="tool-select" id="td-sig">
              ${[[4, '4/4'], [3, '3/4'], [6, '6/8'], [5, '5/4'], [7, '7/8'], [2, '2/4']]
                .map(([b, l]) => `<option value="${b}"${b === 4 ? ' selected' : ''}>${l}</option>`).join('')}
            </select></label>
        </div>
        <div id="td-bars"></div>

        <p class="biz-hint" style="margin-top:18px;">
          Dotted times are one and a half times the straight value; triplets are two thirds.
          For a delay that sits behind the beat rather than on it, dotted eighths are the usual choice.
        </p>
      </div>`;

    const $ = (id) => container.querySelector('#' + id);

    function render() {
      const bpm = state.bpm;
      if (!(bpm > 0)) return;

      const beatMs = 60000 / bpm;
      $('td-mark').textContent = tempoMark(bpm);

      $('td-summary').innerHTML = statGrid([
        { label: 'One beat', value: `${num(beatMs, 1)} ms` },
        { label: 'Beat frequency', value: `${num(bpm / 60, 3)} Hz` },
        { label: 'One bar', value: `${num(beatMs * state.beats, 0)} ms` },
        { label: 'Marking', value: tempoMark(bpm) },
      ]);

      $('td-table').innerHTML = dataTable(
        ['Note', 'Straight', 'Dotted', 'Triplet', 'Hz'],
        NOTE_VALUES.map(v => {
          const t = noteMs(bpm, v.beats);
          return [
            v.name,
            `${num(t.straight, 1)} ms`,
            `${num(t.dotted, 1)} ms`,
            `${num(t.triplet, 1)} ms`,
            `${num(1000 / t.straight, 2)} Hz`,
          ];
        }),
        { caption: `At ${num(bpm, 1)} BPM` },
      );

      const bars = [1, 2, 4, 8, 16, 32];
      $('td-bars').innerHTML = dataTable(
        ['Bars', 'Beats', 'Time'],
        bars.map(b => {
          const ms = beatMs * state.beats * b;
          const secs = ms / 1000;
          return [
            String(b),
            String(b * state.beats),
            secs >= 60
              ? `${Math.floor(secs / 60)} min ${num(secs % 60, 1)} s`
              : `${num(secs, 2)} s`,
          ];
        }),
        { caption: `In ${$('td-sig')?.selectedOptions?.[0]?.textContent || $('td-sig')?.options?.[0]?.textContent || '4/4'}` },
      );

      analytics?.completed({ resultCount: 1 });
    }

    $('td-bpm').addEventListener('input', (e) => {
      const v = Number(e.target.value);
      if (v >= 20 && v <= 300) { state.bpm = v; render(); }
    });

    $('td-sig').addEventListener('change', (e) => { state.beats = Number(e.target.value); render(); });

    /* ---------------- tap tempo ---------------- */

    let taps = [];
    $('td-tap').addEventListener('click', () => {
      const now = performance.now();
      // A long gap means the user started again, not a very slow track.
      if (taps.length && now - taps[taps.length - 1] > 2500) taps = [];
      taps.push(now);
      if (taps.length > 8) taps.shift();

      if (taps.length >= 2) {
        const gaps = taps.slice(1).map((t, i) => t - taps[i]);
        const avg = gaps.reduce((s, g) => s + g, 0) / gaps.length;
        const bpm = Math.min(300, Math.max(20, 60000 / avg));
        state.bpm = Math.round(bpm * 10) / 10;
        $('td-bpm').value = state.bpm;
        $('td-tap-hint').textContent = `${taps.length} taps`;
        render();
      } else {
        $('td-tap-hint').textContent = 'Keep tapping…';
      }
    });

    render();
    analytics?.started();
  },

  destroy() {},
};
