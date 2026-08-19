/* Instrument Tuner — listens through the microphone.

   Pitch is found by autocorrelation rather than by picking the loudest
   FFT bin. An FFT peak lands on whichever harmonic is strongest, which
   on a guitar is often the second or third — so a naive tuner tells you
   a low E is a B. Autocorrelation finds the period of the waveform, so
   it tracks the fundamental even when it is quieter than its overtones.

   Audio never leaves the device: there is no recording, no upload, and
   the stream is released the moment you stop or navigate away. */

import { analysePitch, midiToFreq, midiToName, TUNINGS } from '../lib/music.js';

/* Below this the signal is noise, and reporting a pitch for it makes the
   needle twitch constantly when nobody is playing. */
const RMS_GATE = 0.008;
const CLARITY_GATE = 0.92;

export default {
  render(container, { analytics } = {}) {
    const state = { a4: 440, tuning: 'guitar-standard', running: false, held: null };

    container.innerHTML = `
      <div class="tun">
        <div class="tun-display" id="tn-display">
          <div class="tun-note">
            <span class="tun-name" id="tn-name">—</span>
            <span class="tun-oct" id="tn-oct"></span>
          </div>
          <div class="tun-meter">
            <div class="tun-scale">
              ${[-50, -25, 0, 25, 50].map(c => `<span style="left:${50 + c}%">${c > 0 ? '+' : ''}${c}</span>`).join('')}
            </div>
            <div class="tun-track">
              <div class="tun-centre"></div>
              <div class="tun-needle" id="tn-needle"></div>
            </div>
          </div>
          <div class="tun-readout">
            <span id="tn-cents">Waiting for sound</span>
            <span id="tn-hz"></span>
          </div>
        </div>

        <div class="tool-controls">
          <button class="btn btn-primary" id="tn-start">Start listening</button>
          <label class="fz-ctl"><span>Reference A4</span>
            <input type="number" class="tool-input" id="tn-a4" value="440" min="390" max="470" step="1"></label>
          <label class="fz-ctl"><span>Instrument</span>
            <select class="tool-select" id="tn-tuning">
              ${Object.entries(TUNINGS).map(([id, t]) =>
                `<option value="${id}"${id === 'guitar-standard' ? ' selected' : ''}>${t.name}</option>`).join('')}
            </select></label>
        </div>

        <p class="tun-status" id="tn-status"></p>

        <h3 class="cq-h" style="margin-top:22px;">Open strings</h3>
        <div class="tun-strings" id="tn-strings"></div>
        <p class="biz-hint">
          Tap a string to hear its reference pitch. The nearest string lights up while you play,
          so you can see at a glance which one the tuner has locked onto.
        </p>
      </div>`;

    const $ = (id) => container.querySelector('#' + id);
    let ctx = null, stream = null, analyser = null, raf = null, buffer = null;

    /* ---------------- pitch detection ---------------- */

    /**
     * Normalised autocorrelation. Returns the fundamental frequency and a
     * clarity score, or null when the signal is too quiet or too noisy to
     * be trusted — which is better than reporting a confident wrong note.
     */
    function detectPitch(buf, sampleRate) {
      const n = buf.length;

      let rms = 0;
      for (let i = 0; i < n; i++) rms += buf[i] * buf[i];
      rms = Math.sqrt(rms / n);
      if (rms < RMS_GATE) return null;

      // Trim near-silent head and tail so the correlation is not diluted.
      let start = 0, end = n - 1;
      const threshold = 0.2;
      while (start < n / 2 && Math.abs(buf[start]) < threshold) start++;
      while (end > n / 2 && Math.abs(buf[end]) < threshold) end--;
      const slice = buf.slice(start, end);
      const len = slice.length;
      if (len < 512) return null;

      const corr = new Float32Array(len).fill(0);
      for (let lag = 0; lag < len; lag++) {
        let sum = 0;
        for (let i = 0; i < len - lag; i++) sum += slice[i] * slice[i + lag];
        corr[lag] = sum;
      }

      // Walk past the initial descent, then take the first strong peak —
      // that is the fundamental period, not an overtone.
      let d = 0;
      while (d < len - 1 && corr[d] > corr[d + 1]) d++;

      let best = -1, bestVal = -1;
      for (let lag = d; lag < len; lag++) {
        if (corr[lag] > bestVal) { bestVal = corr[lag]; best = lag; }
      }
      if (best <= 0) return null;

      const clarity = corr[0] > 0 ? bestVal / corr[0] : 0;
      if (clarity < CLARITY_GATE * 0.5) return null;

      // Parabolic interpolation around the peak for sub-sample accuracy;
      // without it the reading quantises badly at high frequencies.
      const y1 = corr[best - 1] ?? bestVal, y2 = bestVal, y3 = corr[best + 1] ?? bestVal;
      const a = (y1 + y3 - 2 * y2) / 2;
      const b = (y3 - y1) / 2;
      const shift = a ? -b / (2 * a) : 0;
      const period = best + shift;

      const freq = sampleRate / period;
      if (!(freq > 25 && freq < 4200)) return null;
      return { freq, clarity, rms };
    }

    /* ---------------- loop ---------------- */

    let smoothed = null;

    function tick() {
      if (!state.running) return;
      analyser.getFloatTimeDomainData(buffer);
      const result = detectPitch(buffer, ctx.sampleRate);

      if (result) {
        // Light smoothing: a raw reading jitters by a few cents and makes
        // the needle unusable, but too much smoothing hides real drift.
        smoothed = smoothed === null ? result.freq : smoothed * 0.7 + result.freq * 0.3;
        showPitch(smoothed);
      } else if (smoothed !== null) {
        smoothed = null;
        idle();
      }
      raf = requestAnimationFrame(tick);
    }

    function showPitch(freq) {
      const p = analysePitch(freq, state.a4);
      if (!p) return;

      $('tn-name').textContent = p.name;
      $('tn-oct').textContent = p.octave;
      $('tn-hz').textContent = `${freq.toFixed(1)} Hz · target ${p.target.toFixed(1)} Hz`;

      const cents = Math.max(-50, Math.min(50, p.cents));
      $('tn-needle').style.left = `${50 + cents}%`;

      const inTune = Math.abs(p.cents) <= 5;
      $('tn-display').classList.toggle('is-intune', inTune);
      $('tn-cents').textContent = inTune
        ? 'In tune'
        : `${p.cents > 0 ? '+' : ''}${p.cents} cents — ${p.cents > 0 ? 'tune down' : 'tune up'}`;

      // Highlight whichever open string this is closest to.
      const strings = TUNINGS[state.tuning].strings;
      let nearest = -1, bestDist = Infinity;
      strings.forEach((midi, i) => {
        const dist = Math.abs(midi - p.midi);
        if (dist < bestDist) { bestDist = dist; nearest = i; }
      });
      for (const el of container.querySelectorAll('.tun-string')) {
        el.classList.toggle('is-near', bestDist <= 1 && Number(el.dataset.i) === nearest);
      }
    }

    function idle() {
      $('tn-cents').textContent = 'Waiting for sound';
      $('tn-hz').textContent = '';
      $('tn-name').textContent = '—';
      $('tn-oct').textContent = '';
      $('tn-needle').style.left = '50%';
      $('tn-display').classList.remove('is-intune');
      for (const el of container.querySelectorAll('.tun-string')) el.classList.remove('is-near');
    }

    /* ---------------- microphone ---------------- */

    async function start() {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            // Every one of these would fight a tuner: they shape, gate and
            // level the signal, which is exactly what must not happen.
            echoCancellation: false,
            noiseSuppression: false,
            autoGainControl: false,
          },
        });
      } catch (err) {
        $('tn-status').textContent = err.name === 'NotAllowedError'
          ? 'Microphone access was refused. Allow it in your browser’s address bar, then try again.'
          : err.name === 'NotFoundError'
            ? 'No microphone was found.'
            : `Could not open the microphone: ${err.message}`;
        analytics?.error('mic_denied');
        return;
      }

      ctx = new (window.AudioContext || window.webkitAudioContext)();
      const source = ctx.createMediaStreamSource(stream);
      analyser = ctx.createAnalyser();
      analyser.fftSize = 4096;
      buffer = new Float32Array(analyser.fftSize);
      source.connect(analyser);

      state.running = true;
      $('tn-start').textContent = 'Stop listening';
      $('tn-start').classList.add('is-stop');
      $('tn-status').textContent = 'Listening. Audio is analysed on your device and never recorded or sent anywhere.';
      analytics?.started();
      tick();
    }

    function stop() {
      state.running = false;
      cancelAnimationFrame(raf);
      // Release the microphone properly, so the browser's recording
      // indicator goes out and the device is not held open.
      stream?.getTracks().forEach(t => t.stop());
      ctx?.close?.();
      stream = null; ctx = null; analyser = null;
      $('tn-start').textContent = 'Start listening';
      $('tn-start').classList.remove('is-stop');
      $('tn-status').textContent = '';
      idle();
    }

    $('tn-start').addEventListener('click', () => (state.running ? stop() : start()));
    $('tn-a4').addEventListener('input', (e) => {
      const v = Number(e.target.value);
      if (v >= 390 && v <= 470) { state.a4 = v; renderStrings(); }
    });
    $('tn-tuning').addEventListener('change', (e) => { state.tuning = e.target.value; renderStrings(); });

    /* ---------------- reference tones ---------------- */

    function renderStrings() {
      const t = TUNINGS[state.tuning];
      $('tn-strings').innerHTML = t.strings.map((midi, i) => {
        const { name, octave } = midiToName(midi);
        return `<button class="tun-string" data-i="${i}" data-midi="${midi}">
          <span class="tun-string-name">${name}${octave}</span>
          <span class="tun-string-hz">${midiToFreq(midi, state.a4).toFixed(1)} Hz</span>
        </button>`;
      }).join('');
    }

    let toneCtx = null;
    $('tn-strings').addEventListener('click', (e) => {
      const b = e.target.closest('[data-midi]');
      if (!b) return;
      toneCtx ??= new (window.AudioContext || window.webkitAudioContext)();
      if (toneCtx.state === 'suspended') toneCtx.resume();

      const now = toneCtx.currentTime;
      const osc = toneCtx.createOscillator();
      const gain = toneCtx.createGain();
      osc.type = 'triangle';
      osc.frequency.value = midiToFreq(Number(b.dataset.midi), state.a4);
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.exponentialRampToValueAtTime(0.25, now + 0.02);
      gain.gain.setValueAtTime(0.25, now + 1.4);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 1.8);
      osc.connect(gain).connect(toneCtx.destination);
      osc.start(now);
      osc.stop(now + 1.85);
    });

    renderStrings();
    idle();

    this._stop = () => { stop(); toneCtx?.close?.(); };
  },

  destroy() { this._stop?.(); },
};
