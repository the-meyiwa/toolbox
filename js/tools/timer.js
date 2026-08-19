/* Timer & Stopwatch — the tab you leave open.

   Two things a browser timer usually gets wrong: it drifts, because it
   counts setInterval ticks instead of reading the clock; and it goes
   silent when the tab is backgrounded, because throttled timers stop
   firing accurately. Both are handled here — elapsed time is always
   derived from timestamps, and the title bar carries the countdown so it
   is readable from another tab. */

const pad = (n) => String(n).padStart(2, '0');

function clock(ms) {
  // Only mark time as negative once a whole second has passed zero.
  // Otherwise the readout flicks to "-00:00" the instant it lands.
  const neg = ms <= -1000;
  const t = neg ? Math.abs(ms) : Math.max(ms, 0);
  const h = Math.floor(t / 3600000);
  const m = Math.floor(t / 60000) % 60;
  const s = Math.floor(t / 1000) % 60;
  const cs = Math.floor(t / 10) % 100;
  return { text: h ? `${h}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`, cs: pad(cs), neg };
}

const PRESETS = [
  { label: '1 min', ms: 60000 },
  { label: '3 min', ms: 180000 },
  { label: '5 min', ms: 300000 },
  { label: '10 min', ms: 600000 },
  { label: '25 min', ms: 1500000 },
  { label: '1 hour', ms: 3600000 },
];

export default {
  render(container, { analytics } = {}) {
    container.innerHTML = `
      <div class="tm">
        <div class="btn-group t3d-seg tm-mode" id="tm-mode">
          <button class="btn btn-sm is-active" data-mode="countdown">Countdown</button>
          <button class="btn btn-sm" data-mode="stopwatch">Stopwatch</button>
        </div>

        <div class="tm-face" id="tm-face">
          <div class="tm-time"><span id="tm-main">05:00</span><small id="tm-cs">00</small></div>
          <div class="tm-state" id="tm-state">Ready</div>
        </div>

        <div class="tm-presets" id="tm-presets">
          ${PRESETS.map(p => `<button class="btn btn-sm" data-ms="${p.ms}">${p.label}</button>`).join('')}
        </div>

        <div class="tool-controls fz-controls" id="tm-set">
          <label class="fz-ctl"><span>Minutes</span><input type="number" class="tool-input" id="tm-min" value="5" min="0" max="999"></label>
          <label class="fz-ctl"><span>Seconds</span><input type="number" class="tool-input" id="tm-sec" value="0" min="0" max="59"></label>
        </div>

        <div class="tool-controls">
          <button class="btn btn-primary" id="tm-start">Start</button>
          <button class="btn btn-secondary" id="tm-lap" hidden>Lap</button>
          <button class="btn btn-secondary btn-sm" id="tm-reset">Reset</button>
          <label class="tool-checkbox"><input type="checkbox" id="tm-sound" checked> <span>Chime when done</span></label>
        </div>

        <div class="tm-laps" id="tm-laps"></div>
      </div>`;

    const $ = (id) => container.querySelector('#' + id);
    const mainEl = $('tm-main'), csEl = $('tm-cs'), stateEl = $('tm-state'), faceEl = $('tm-face');
    const startBtn = $('tm-start'), lapBtn = $('tm-lap');

    let mode = 'countdown';
    let running = false;
    let startedAt = 0;        // wall-clock reference
    let accumulated = 0;      // ms already counted before the current run
    let targetMs = 300000;
    let fired = false;
    let laps = [];
    let raf = null;
    let alarmId = null;
    let ticker = null;

    const originalTitle = document.title;

    const setTarget = () => {
      targetMs = (Number($('tm-min').value) || 0) * 60000 + (Number($('tm-sec').value) || 0) * 1000;
    };

    function currentMs() {
      const elapsed = accumulated + (running ? Date.now() - startedAt : 0);
      return mode === 'countdown' ? targetMs - elapsed : elapsed;
    }

    /* A short chime built in code — no asset to load, no autoplay issue,
       because it is only ever created from a user-initiated timer. */
    function chime() {
      if (!$('tm-sound').checked) return;
      try {
        const ctx = new (window.AudioContext || window.webkitAudioContext)();
        const now = ctx.currentTime;
        for (const [i, freq] of [880, 1174.7, 1567.98].entries()) {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'sine';
          osc.frequency.value = freq;
          gain.gain.setValueAtTime(0, now + i * 0.16);
          gain.gain.linearRampToValueAtTime(0.22, now + i * 0.16 + 0.02);
          gain.gain.exponentialRampToValueAtTime(0.0001, now + i * 0.16 + 0.5);
          osc.connect(gain).connect(ctx.destination);
          osc.start(now + i * 0.16);
          osc.stop(now + i * 0.16 + 0.55);
        }
        setTimeout(() => ctx.close(), 1400);
      } catch { /* audio unavailable — the visual state still changes */ }
    }

    function paint() {
      const ms = currentMs();
      const c = clock(ms);
      mainEl.textContent = (c.neg && mode === 'countdown' ? '-' : '') + c.text;
      csEl.textContent = c.cs;

      // Readable from another tab, which is the point of a timer.
      document.title = running ? `${c.text} · Toolbox` : originalTitle;

      const done = mode === 'countdown' && ms <= 0;
      faceEl.classList.toggle('is-done', done);
      faceEl.classList.toggle('is-running', running && !done);

      if (done && fired) {
        stateEl.textContent = 'Time is up';
      } else if (running) {
        stateEl.textContent = mode === 'countdown' ? 'Counting down' : 'Running';
      }

      if (running) raf = requestAnimationFrame(paint);
    }

    /* The alarm is scheduled as a real timeout, not left to the paint
       loop. requestAnimationFrame is paused entirely in a background
       tab, so a timer that only chimed from its render loop would stay
       silent exactly when you had switched away — which is the whole
       situation a countdown exists for. */
    function scheduleAlarm() {
      clearTimeout(alarmId);
      if (!running || mode !== 'countdown') return;
      const remaining = currentMs();
      if (remaining <= 0) return;
      alarmId = setTimeout(() => {
        if (!running || fired) return;
        fired = true;
        stateEl.textContent = 'Time is up';
        faceEl.classList.add('is-done');
        faceEl.classList.remove('is-running');
        document.title = 'Time is up · Toolbox';
        chime();
        analytics?.completed({ durationMs: targetMs });
        paintOnce();
      }, remaining);
    }

    function start() {
      if (running) {                       // pause
        accumulated += Date.now() - startedAt;
        running = false;
        cancelAnimationFrame(raf);
        clearTimeout(alarmId);
        startBtn.textContent = 'Resume';
        stateEl.textContent = 'Paused';
        faceEl.classList.remove('is-running');
        document.title = originalTitle;
        paintOnce();
        return;
      }
      if (mode === 'countdown') {
        setTarget();
        if (targetMs <= 0) return;
        if (fired || accumulated >= targetMs) { accumulated = 0; fired = false; }
      }
      running = true;
      startedAt = Date.now();
      startBtn.textContent = 'Pause';
      analytics?.started();
      scheduleAlarm();
      clearInterval(ticker);
      ticker = setInterval(paintOnce, 250);
      paint();
    }

    function paintOnce() {
      const ms = currentMs();
      const c = clock(ms);
      mainEl.textContent = (c.neg && mode === 'countdown' ? '-' : '') + c.text;
      csEl.textContent = c.cs;
      if (running && !fired) {
        document.title = `${c.text} · Toolbox`;
        faceEl.classList.add('is-running');
        stateEl.textContent = mode === 'countdown' ? 'Counting down' : 'Running';
      }
    }

    function reset() {
      running = false;
      cancelAnimationFrame(raf);
      clearTimeout(alarmId);
      clearInterval(ticker);
      accumulated = 0;
      fired = false;
      laps = [];
      $('tm-laps').innerHTML = '';
      startBtn.textContent = 'Start';
      stateEl.textContent = 'Ready';
      faceEl.classList.remove('is-running', 'is-done');
      document.title = originalTitle;
      if (mode === 'countdown') setTarget();
      paintOnce();
    }

    $('tm-mode').addEventListener('click', (e) => {
      const btn = e.target.closest('[data-mode]');
      if (!btn) return;
      for (const b of container.querySelectorAll('#tm-mode .btn')) b.classList.toggle('is-active', b === btn);
      mode = btn.dataset.mode;
      $('tm-set').hidden = mode === 'stopwatch';
      $('tm-presets').hidden = mode === 'stopwatch';
      lapBtn.hidden = mode === 'countdown';
      reset();
    });

    $('tm-presets').addEventListener('click', (e) => {
      const ms = e.target.dataset.ms;
      if (!ms) return;
      $('tm-min').value = Math.floor(Number(ms) / 60000);
      $('tm-sec').value = 0;
      reset();
    });

    for (const id of ['tm-min', 'tm-sec']) $(id).addEventListener('input', () => { if (!running) reset(); });

    startBtn.addEventListener('click', start);
    $('tm-reset').addEventListener('click', reset);

    lapBtn.addEventListener('click', () => {
      if (!running) return;
      const ms = currentMs();
      const prev = laps.length ? laps[laps.length - 1].total : 0;
      laps.push({ total: ms, split: ms - prev });
      $('tm-laps').innerHTML = [...laps].reverse().map((l, i) => {
        const n = laps.length - i;
        return `<div class="tm-lap"><span>Lap ${n}</span><b>${clock(l.split).text}.${clock(l.split).cs}</b><small>${clock(l.total).text}</small></div>`;
      }).join('');
    });

    this._cleanupTitle = () => { document.title = originalTitle; };
    // Repaint the moment the tab comes back, so returning to a
    // throttled timer never shows a stale number.
    const onVisible = () => { if (!document.hidden && running) paintOnce(); };
    document.addEventListener('visibilitychange', onVisible);

    this._stop = () => {
      running = false;
      cancelAnimationFrame(raf);
      clearTimeout(alarmId);
      clearInterval(ticker);
      document.removeEventListener('visibilitychange', onVisible);
    };

    setTarget();
    paintOnce();
  },

  destroy() {
    this._stop?.();
    this._cleanupTitle?.();
  },
};
