/* Algorithm Lab — watch an algorithm actually run.

   The bars are drawn from frames the algorithm itself yields, so what
   you see is the real execution rather than a re-enactment. Step through
   it, scrub the timeline, or feed it your own numbers. */

import { ALGORITHMS } from '../lib/algorithms.js';

const randomArray = (n, max = 99) =>
  Array.from({ length: n }, () => 1 + Math.floor(Math.random() * max));

export default {
  render(container, { analytics } = {}) {
    const state = {
      algo: 'bubble',
      data: randomArray(18),
      target: 42,
      frames: [],
      index: 0,
      playing: false,
      speed: 6,
    };

    const groups = [...new Set(Object.values(ALGORITHMS).map(a => a.group))];

    container.innerHTML = `
      <div class="alab">
        <div class="alab-bar">
          <select class="tool-select" id="al-algo" aria-label="Algorithm">
            ${groups.map(g => `<optgroup label="${g}">${
              Object.entries(ALGORITHMS).filter(([, a]) => a.group === g)
                .map(([id, a]) => `<option value="${id}">${a.name}</option>`).join('')
            }</optgroup>`).join('')}
          </select>
          <label class="fz-ctl alab-target" id="al-target-wrap" hidden>
            <span>Find</span>
            <input type="number" class="tool-input" id="al-target" value="42">
          </label>
          <div class="alab-bar-right">
            <button class="btn btn-sm" id="al-shuffle">Shuffle</button>
            <button class="btn btn-sm" id="al-nearly">Nearly sorted</button>
            <button class="btn btn-sm" id="al-reversed">Reversed</button>
          </div>
        </div>

        <div class="alab-stage" id="al-stage"></div>

        <div class="alab-note" id="al-note"></div>

        <div class="alab-transport">
          <button class="btn btn-sm" id="al-first" aria-label="First step">⏮</button>
          <button class="btn btn-sm" id="al-prev" aria-label="Previous step">◀</button>
          <button class="btn btn-primary" id="al-play">Play</button>
          <button class="btn btn-sm" id="al-next" aria-label="Next step">▶</button>
          <button class="btn btn-sm" id="al-last" aria-label="Last step">⏭</button>
          <input type="range" class="tool-range alab-scrub" id="al-scrub" min="0" max="0" value="0" aria-label="Timeline">
          <span class="alab-count" id="al-count">0 / 0</span>
          <label class="fz-ctl alab-speed"><span>Speed</span>
            <input type="range" class="tool-range" id="al-speed" min="1" max="12" value="6" aria-label="Speed">
          </label>
        </div>

        <div class="alab-facts" id="al-facts"></div>

        <div class="tool-section">
          <label class="tool-label" for="al-input">Your own numbers</label>
          <input type="text" class="tool-input" id="al-input" placeholder="e.g. 8, 3, 91, 12, 45">
          <p class="biz-hint">Comma or space separated. Up to 60 values.</p>
        </div>
      </div>`;

    const $ = (id) => container.querySelector('#' + id);
    const stage = $('al-stage'), noteEl = $('al-note'), scrub = $('al-scrub');
    const countEl = $('al-count'), playBtn = $('al-play');

    /* ---------------- building & drawing ---------------- */

    function build() {
      const algo = ALGORITHMS[state.algo];
      const gen = algo.needsTarget ? algo.fn(state.data, state.target) : algo.fn(state.data);
      state.frames = [...gen];
      state.index = 0;
      scrub.max = String(Math.max(state.frames.length - 1, 0));
      scrub.value = '0';
      draw();
      renderFacts();
      analytics?.started();
    }

    function draw() {
      const f = state.frames[state.index];
      if (!f) { stage.innerHTML = ''; return; }

      const max = Math.max(...f.array, 1);
      const compare = new Set(f.compare || []);
      const swap = new Set(f.swap || []);
      const sorted = new Set(f.sorted || []);
      const inRange = f.range ? (i) => i >= f.range[0] && i <= f.range[1] : () => true;

      stage.innerHTML = f.array.map((v, i) => {
        const cls = [
          'alab-bar-item',
          swap.has(i) ? 'is-swap' : compare.has(i) ? 'is-compare' : '',
          sorted.has(i) ? 'is-sorted' : '',
          f.pivot === i ? 'is-pivot' : '',
          f.range && !inRange(i) ? 'is-dim' : '',
        ].filter(Boolean).join(' ');
        // Show the value only when the bars are wide enough to read it.
        const label = f.array.length <= 30 ? `<span>${v}</span>` : '';
        return `<div class="${cls}" style="height:${Math.round((v / max) * 100)}%">${label}</div>`;
      }).join('');

      noteEl.textContent = f.note || '';
      countEl.textContent = `${state.index + 1} / ${state.frames.length}`;
      scrub.value = String(state.index);
    }

    function renderFacts() {
      const a = ALGORITHMS[state.algo];
      $('al-facts').innerHTML = `
        <p class="alab-about">${a.about}</p>
        <div class="alab-complexity">
          <div><span>Best</span><b>${a.best}</b></div>
          <div><span>Average</span><b>${a.average}</b></div>
          <div><span>Worst</span><b>${a.worst}</b></div>
          <div><span>Memory</span><b>${a.space}</b></div>
          ${a.stable === null ? '' : `<div><span>Stable</span><b>${a.stable ? 'Yes' : 'No'}</b></div>`}
        </div>`;
    }

    /* ---------------- transport ---------------- */

    let timer = null;

    function stop() {
      state.playing = false;
      clearTimeout(timer);
      playBtn.textContent = 'Play';
      playBtn.classList.remove('is-stop');
    }

    function tick() {
      if (!state.playing) return;
      if (state.index >= state.frames.length - 1) {
        stop();
        analytics?.completed({ resultCount: state.frames.length });
        return;
      }
      state.index++;
      draw();
      // Speed 1 is a slow walk-through, 12 is a blur.
      timer = setTimeout(tick, Math.round(700 / state.speed));
    }

    playBtn.addEventListener('click', () => {
      if (state.playing) { stop(); return; }
      if (state.index >= state.frames.length - 1) state.index = 0;
      state.playing = true;
      playBtn.textContent = 'Pause';
      playBtn.classList.add('is-stop');
      tick();
    });

    const go = (i) => { stop(); state.index = Math.max(0, Math.min(i, state.frames.length - 1)); draw(); };
    $('al-first').addEventListener('click', () => go(0));
    $('al-prev').addEventListener('click', () => go(state.index - 1));
    $('al-next').addEventListener('click', () => go(state.index + 1));
    $('al-last').addEventListener('click', () => go(state.frames.length - 1));
    scrub.addEventListener('input', () => go(Number(scrub.value)));
    $('al-speed').addEventListener('input', (e) => { state.speed = Number(e.target.value); });

    /* ---------------- inputs ---------------- */

    $('al-algo').addEventListener('change', (e) => {
      stop();
      state.algo = e.target.value;
      $('al-target-wrap').hidden = !ALGORITHMS[state.algo].needsTarget;
      build();
    });

    $('al-target').addEventListener('input', (e) => {
      state.target = Number(e.target.value) || 0;
      stop(); build();
    });

    const setData = (arr) => { stop(); state.data = arr; $('al-input').value = arr.join(', '); build(); };

    $('al-shuffle').addEventListener('click', () => setData(randomArray(state.data.length)));
    $('al-nearly').addEventListener('click', () => {
      // Nearly-sorted input is where bubble and insertion sort suddenly win.
      const arr = randomArray(state.data.length).sort((a, b) => a - b);
      for (let k = 0; k < Math.max(1, Math.floor(arr.length / 8)); k++) {
        const i = Math.floor(Math.random() * arr.length);
        const j = Math.min(arr.length - 1, i + 1);
        [arr[i], arr[j]] = [arr[j], arr[i]];
      }
      setData(arr);
    });
    $('al-reversed').addEventListener('click', () =>
      setData(randomArray(state.data.length).sort((a, b) => b - a)));

    $('al-input').addEventListener('change', (e) => {
      const nums = e.target.value.split(/[,\s]+/).map(Number).filter(n => Number.isFinite(n) && n > 0);
      if (nums.length >= 2) setData(nums.slice(0, 60));
    });

    /* ---------------- go ---------------- */

    $('al-input').value = state.data.join(', ');
    build();

    this._stop = stop;
  },

  destroy() { this._stop?.(); },
};
