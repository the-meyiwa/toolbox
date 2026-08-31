/* Metronome — accurate enough to actually practise to.

   Timing is the whole product here, so it does not use setInterval to
   make sounds. A JavaScript timer drifts by milliseconds and stalls
   entirely in a background tab, which is audible within a few bars.

   Instead a coarse timer wakes up every 25 ms and schedules any clicks
   falling inside the next 100 ms directly on the Web Audio clock, which
   runs on the audio thread and does not drift. The timer only has to be
   roughly on time; the sound is sample-accurate regardless. */

import { tempoMark } from '../lib/music.js';

const LOOKAHEAD_MS = 25;
const SCHEDULE_AHEAD = 0.1;   // seconds

const SUBDIVISIONS = [
  { id: 1, name: 'Quarter notes', label: '' },
  { id: 2, name: 'Eighths', label: '' },
  { id: 3, name: 'Triplets', label: '³' },
  { id: 4, name: 'Sixteenths', label: '' },
];

const SOUNDS = {
  click: { name: 'Click', accent: 1600, beat: 1000, sub: 800, type: 'square', decay: 0.03 },
  wood:  { name: 'Woodblock', accent: 1200, beat: 800, sub: 640, type: 'triangle', decay: 0.05 },
  beep:  { name: 'Beep', accent: 880, beat: 660, sub: 520, type: 'sine', decay: 0.08 },
};

export default {
  render(container, { analytics } = {}) {
    const state = {
      bpm: 100,
      beats: 4,          // beats per bar
      subdiv: 1,
      sound: 'click',
      accentFirst: true,
      volume: 0.7,
      muted: [],         // beat indices the user has silenced
      running: false,
      bar: 0,
      beat: 0,
    };

    container.innerHTML = `
      <div class="met">
        <div class="met-readout">
          <div class="met-bpm">
            <button class="met-step" id="mt-down" aria-label="Slower">−</button>
            <div class="met-bpm-value">
              <span id="mt-bpm">100</span>
              <small>BPM</small>
            </div>
            <button class="met-step" id="mt-up" aria-label="Faster">+</button>
          </div>
          <div class="met-mark" id="mt-mark">Moderato</div>
          <input type="range" class="tool-range met-slider" id="mt-slider" min="20" max="300" value="100" aria-label="Tempo">
          <div class="met-beats" id="mt-beats"></div>
        </div>

        <div class="tool-controls met-actions">
          <button class="btn btn-primary met-play" id="mt-play">Start</button>
          <button class="btn btn-secondary" id="mt-tap">Tap tempo</button>
          <span class="met-tap-hint" id="mt-tap-hint"></span>
        </div>

        <div class="met-grid">
          <label class="fz-ctl"><span>Beats per bar</span>
            <select class="tool-select" id="mt-beats-sel">
              ${[2, 3, 4, 5, 6, 7, 9, 12].map(n => `<option value="${n}"${n === 4 ? ' selected' : ''}>${n}/4</option>`).join('')}
            </select></label>

          <label class="fz-ctl"><span>Subdivision</span>
            <select class="tool-select" id="mt-subdiv">
              ${SUBDIVISIONS.map(s => `<option value="${s.id}">${s.name}</option>`).join('')}
            </select></label>

          <label class="fz-ctl"><span>Sound</span>
            <select class="tool-select" id="mt-sound">
              ${Object.entries(SOUNDS).map(([id, s]) => `<option value="${id}">${s.name}</option>`).join('')}
            </select></label>

          <label class="fz-ctl"><span>Volume</span>
            <input type="range" class="tool-range" id="mt-vol" min="0" max="100" value="70"></label>
        </div>

        <div class="tool-controls">
          <label class="tool-checkbox"><input type="checkbox" id="mt-accent" checked> <span>Accent the first beat</span></label>
          <div class="btn-group t3d-seg" id="mt-presets">
            ${[60, 80, 100, 120, 140, 160].map(b => `<button class="btn btn-sm" data-bpm="${b}">${b}</button>`).join('')}
          </div>
        </div>

        <p class="biz-hint">
          Click any beat dot to silence it — useful for practising a pattern where you only want
          the downbeat, or for internalising the pulse without leaning on every click.
          Timing runs on the audio clock, so it stays accurate in a background tab.
        </p>
      </div>`;

    const $ = (id) => container.querySelector('#' + id);
    let ctx = null;
    let nextNoteTime = 0;
    let noteInBar = 0;         // counts subdivisions
    let timer = null;
    const drawQueue = [];

    /* ---------------- audio ---------------- */

    function ensureContext() {
      // Created on a real gesture, which is what browsers require.
      ctx ??= new (window.AudioContext || window.webkitAudioContext)();
      if (ctx.state === 'suspended') ctx.resume();
      return ctx;
    }

    function scheduleClick(time, kind) {
      const s = SOUNDS[state.sound];
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const freq = kind === 'accent' ? s.accent : kind === 'beat' ? s.beat : s.sub;
      const level = (kind === 'sub' ? 0.35 : kind === 'accent' ? 1 : 0.75) * state.volume;

      osc.type = s.type;
      osc.frequency.setValueAtTime(freq, time);
      // A short exponential decay reads as a click rather than a tone.
      gain.gain.setValueAtTime(0.0001, time);
      gain.gain.exponentialRampToValueAtTime(Math.max(level, 0.0002), time + 0.002);
      gain.gain.exponentialRampToValueAtTime(0.0001, time + s.decay);

      osc.connect(gain).connect(ctx.destination);
      osc.start(time);
      osc.stop(time + s.decay + 0.02);
    }

    function advance() {
      // One "note" is a subdivision, so the interval shrinks as
      // subdivisions increase while the beat itself stays put.
      nextNoteTime += (60 / state.bpm) / state.subdiv;
      noteInBar = (noteInBar + 1) % (state.beats * state.subdiv);
    }

    function scheduler() {
      while (nextNoteTime < ctx.currentTime + SCHEDULE_AHEAD) {
        const beatIndex = Math.floor(noteInBar / state.subdiv);
        const isBeat = noteInBar % state.subdiv === 0;
        const isFirst = noteInBar === 0;

        if (!state.muted.includes(beatIndex)) {
          if (isFirst && state.accentFirst) scheduleClick(nextNoteTime, 'accent');
          else if (isBeat) scheduleClick(nextNoteTime, 'beat');
          else scheduleClick(nextNoteTime, 'sub');
        }
        if (isBeat) drawQueue.push({ beat: beatIndex, time: nextNoteTime });
        advance();
      }
    }

    /* The visual flash is driven separately from the audio, comparing the
       audio clock against queued beats — so the dots follow the sound
       rather than the other way round. */
    let raf = null;
    let shown = -1;
    function draw() {
      if (!state.running) return;
      while (drawQueue.length && drawQueue[0].time < ctx.currentTime) {
        shown = drawQueue.shift().beat;
      }
      const dots = container.querySelectorAll('.met-dot');
      dots.forEach((d, i) => d.classList.toggle('is-active', i === shown));
      raf = requestAnimationFrame(draw);
    }

    function start() {
      ensureContext();
      state.running = true;
      noteInBar = 0;
      drawQueue.length = 0;
      shown = -1;
      nextNoteTime = ctx.currentTime + 0.06;
      timer = setInterval(scheduler, LOOKAHEAD_MS);
      raf = requestAnimationFrame(draw);
      $('mt-play').textContent = 'Stop';
      $('mt-play').classList.add('is-stop');
      analytics?.started();
    }

    function stop() {
      state.running = false;
      clearInterval(timer);
      cancelAnimationFrame(raf);
      timer = null;
      $('mt-play').textContent = 'Start';
      $('mt-play').classList.remove('is-stop');
      for (const d of container.querySelectorAll('.met-dot')) d.classList.remove('is-active');
    }

    /* ---------------- display ---------------- */

    function renderBeats() {
      $('mt-beats').innerHTML = Array.from({ length: state.beats }, (_, i) => `
        <button class="met-dot${state.muted.includes(i) ? ' is-muted' : ''}${i === 0 && state.accentFirst ? ' is-accent' : ''}"
                data-beat="${i}" aria-label="Beat ${i + 1}">${i + 1}</button>`).join('');
    }

    function setBpm(v) {
      state.bpm = Math.max(20, Math.min(300, Math.round(v)));
      $('mt-bpm').textContent = state.bpm;
      $('mt-slider').value = state.bpm;
      $('mt-mark').textContent = tempoMark(state.bpm);
    }

    /* ---------------- controls ---------------- */

    $('mt-play').addEventListener('click', () => (state.running ? stop() : start()));
    $('mt-up').addEventListener('click', () => setBpm(state.bpm + 1));
    $('mt-down').addEventListener('click', () => setBpm(state.bpm - 1));
    $('mt-slider').addEventListener('input', (e) => setBpm(Number(e.target.value)));

    $('mt-presets').addEventListener('click', (e) => {
      const b = e.target.dataset.bpm;
      if (b) setBpm(Number(b));
    });

    $('mt-beats-sel').addEventListener('change', (e) => {
      state.beats = Number(e.target.value);
      state.muted = state.muted.filter(i => i < state.beats);
      noteInBar = 0;
      renderBeats();
    });

    $('mt-subdiv').addEventListener('change', (e) => { state.subdiv = Number(e.target.value); noteInBar = 0; });
    $('mt-sound').addEventListener('change', (e) => { state.sound = e.target.value; });
    $('mt-vol').addEventListener('input', (e) => { state.volume = Number(e.target.value) / 100; });

    $('mt-accent').addEventListener('change', (e) => {
      state.accentFirst = e.target.checked;
      renderBeats();
    });

    $('mt-beats').addEventListener('click', (e) => {
      const b = e.target.closest('[data-beat]');
      if (!b) return;
      const i = Number(b.dataset.beat);
      state.muted = state.muted.includes(i) ? state.muted.filter(x => x !== i) : [...state.muted, i];
      renderBeats();
    });

    /* ---------------- tap tempo ---------------- */

    let taps = [];
    $('mt-tap').addEventListener('click', () => {
      const now = performance.now();
      // A long gap means a new attempt, not a very slow tempo.
      if (taps.length && now - taps[taps.length - 1] > 2500) taps = [];
      taps.push(now);
      if (taps.length > 6) taps.shift();

      if (taps.length >= 2) {
        const gaps = taps.slice(1).map((t, i) => t - taps[i]);
        const avg = gaps.reduce((s, g) => s + g, 0) / gaps.length;
        setBpm(60000 / avg);
        $('mt-tap-hint').textContent = `${taps.length} taps`;
      } else {
        $('mt-tap-hint').textContent = 'Keep tapping…';
      }
    });

    /* Space bar starts and stops, because reaching for the mouse mid-practice
       defeats the point. */
    this._onKey = (e) => {
      if (e.code !== 'Space') return;
      if (/^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement?.tagName)) return;
      e.preventDefault();
      state.running ? stop() : start();
    };
    document.addEventListener('keydown', this._onKey);

    renderBeats();
    setBpm(100);

    this._stop = () => { stop(); ctx?.close?.(); };
  },

  destroy() {
    this._stop?.();
    document.removeEventListener('keydown', this._onKey);
  },
};
