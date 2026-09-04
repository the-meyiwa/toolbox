/* Speed Test — download, upload, latency and jitter, read out in the
   app's pixel display face. Honest about what it measures. */

import {
  connectionInfo, measureLatency, measureDownload, measureUpload,
  verdict, latencyQuality,
} from '../lib/netspeed.js';

const fmtSpeed = (mbps) =>
  mbps >= 100 ? mbps.toFixed(0) : mbps >= 10 ? mbps.toFixed(1) : mbps.toFixed(2);

const fmtBytes = (n) =>
  n >= 1048576 ? `${(n / 1048576).toFixed(1)} MB` : `${Math.round(n / 1024)} KB`;

export default {
  render(container, { analytics } = {}) {
    // A fresh controller per run. Holding one for the tool's lifetime
    // meant Stop poisoned every later test: the signal stays aborted
    // forever, so the next run's fetches rejected immediately.
    this._abort = null;
    const newRun = () => (this._abort = new AbortController()).signal;

    container.innerHTML = `
      <div class="st">
        <div class="st-readout">
          <div class="st-phase" id="st-phase">Ready</div>
          <div class="st-big">
            <span class="st-value" id="st-value">—</span>
            <span class="st-unit">Mbps</span>
          </div>
          <div class="st-sub" id="st-sub">Measures the connection between this browser and the nearest Cloudflare edge</div>
          <div class="st-meter" id="st-meter"><i style="width:0%"></i></div>
        </div>

        <div class="st-grid">
          <div class="st-card" data-metric="down">
            <span class="st-card-l">Download</span>
            <span class="st-card-v" id="st-down">—</span>
            <span class="st-card-u">Mbps</span>
          </div>
          <div class="st-card" data-metric="up">
            <span class="st-card-l">Upload</span>
            <span class="st-card-v" id="st-up">—</span>
            <span class="st-card-u">Mbps</span>
          </div>
          <div class="st-card" data-metric="ping">
            <span class="st-card-l">Latency</span>
            <span class="st-card-v" id="st-ping">—</span>
            <span class="st-card-u">ms</span>
          </div>
          <div class="st-card" data-metric="jitter">
            <span class="st-card-l">Jitter</span>
            <span class="st-card-v" id="st-jitter">—</span>
            <span class="st-card-u">ms</span>
          </div>
        </div>

        <div class="tool-controls st-actions">
          <button class="btn btn-primary" id="st-go">Start test</button>
          <button class="btn btn-secondary btn-sm" id="st-stop" hidden>Stop</button>
          <label class="tool-checkbox"><input type="checkbox" id="st-thorough"> <span>Thorough (20s)</span></label>
        </div>

        <div class="st-verdict" id="st-verdict" hidden></div>
        <div class="st-conn" id="st-conn"></div>
        <p class="st-note">
          Every browser speed test measures the path to one nearby server, not the whole internet.
          Results move with the time of day, whether you are on Wi-Fi or cable, and what else is
          using the line. Run it twice before believing a bad number.
        </p>
      </div>`;

    const $ = (id) => container.querySelector('#' + id);
    const phaseEl = $('st-phase');
    const valueEl = $('st-value');
    const subEl = $('st-sub');
    const meterEl = $('st-meter').firstElementChild;
    const goBtn = $('st-go');
    const stopBtn = $('st-stop');
    const verdictEl = $('st-verdict');
    const connEl = $('st-conn');

    let running = false;

    const setPhase = (text, pct = 0) => {
      phaseEl.textContent = text;
      meterEl.style.width = `${Math.round(pct * 100)}%`;
    };
    const setBig = (v) => { valueEl.textContent = v; };
    const setCard = (id, v) => { $(id).textContent = v; };
    const mark = (metric, on) => {
      for (const c of container.querySelectorAll('.st-card')) {
        c.classList.toggle('is-live', on && c.dataset.metric === metric);
      }
    };

    /* Connection context loads immediately — it explains the numbers
       before any of them exist. */
    connectionInfo().then((info) => {
      connEl.innerHTML = `
        <div class="st-conn-row"><span>Your network</span><b>${info.isp ?? 'Unknown'}</b></div>
        <div class="st-conn-row"><span>Location</span><b>${[info.city, info.country].filter(Boolean).join(', ') || '—'}</b></div>
        <div class="st-conn-row"><span>Tested against</span><b>${info.edge ?? '—'}</b></div>
        <div class="st-conn-row"><span>Protocol</span><b>${info.protocol ?? '—'}</b></div>`;
      // A far-away edge is the usual explanation for a surprisingly slow result.
      if (info.edgeCountry && info.country && info.edgeCountry !== info.country) {
        connEl.insertAdjacentHTML('beforeend',
          `<p class="st-conn-note">Your traffic is being served from ${info.edge}, not from ${info.country}.
           That distance alone adds latency and caps what any speed test here can show.</p>`);
      }
    }).catch(() => {
      connEl.innerHTML = `<p class="st-conn-note">Connection details are unavailable.</p>`;
    });

    const run = async () => {
      if (running) return;
      running = true;
      analytics?.started();
      goBtn.disabled = true;
      goBtn.textContent = 'Testing…';
      stopBtn.hidden = false;
      verdictEl.hidden = true;
      for (const id of ['st-down', 'st-up', 'st-ping', 'st-jitter']) setCard(id, '—');

      const signal = newRun();
      const thorough = $('st-thorough').checked;
      const dur = thorough ? 10000 : 6000;
      const results = {};

      // Checked between phases as well as inside them, so Stop ends the
      // run at the next boundary instead of rolling into the next stage.
      const bailIfStopped = () => {
        if (signal.aborted) {
          const err = new Error('Measurement cancelled');
          err.name = 'AbortError';
          throw err;
        }
      };

      try {
        /* 1 — latency first: it is quick and frames everything else. */
        setPhase('Measuring latency', 0.05);
        mark('ping', true);
        subEl.textContent = 'Timing round trips';
        const lat = await measureLatency({
          samples: thorough ? 15 : 9,
          signal,
          onProgress: (p) => setPhase('Measuring latency', 0.05 + p * 0.1),
        });
        results.latency = lat;
        setBig(Math.round(lat.median));
        setCard('st-ping', Math.round(lat.median));
        setCard('st-jitter', lat.jitter.toFixed(1));

        bailIfStopped();

        /* 2 — download. */
        setPhase('Testing download', 0.18);
        mark('down', true);
        subEl.textContent = 'Pulling data on several connections';
        const down = await measureDownload({
          durationMs: dur, streams: 4, signal,
          onSample: (s) => {
            setBig(fmtSpeed(s.mbps));
            setCard('st-down', fmtSpeed(s.mbps));
            subEl.textContent = `${fmtBytes(s.bytes)} received`;
            setPhase('Testing download', 0.18 + s.progress * 0.44);
          },
        });
        results.down = down;
        setCard('st-down', fmtSpeed(down.mbps));

        bailIfStopped();

        /* 3 — upload. */
        setPhase('Testing upload', 0.64);
        mark('up', true);
        subEl.textContent = 'Sending data';
        // Concurrency is left to the engine's default: measured here,
        // three simultaneous POSTs mostly failed rather than sharing the
        // uplink, so more streams made the result worse, not better.
        const up = await measureUpload({
          durationMs: dur, signal,
          onSample: (s) => {
            setBig(fmtSpeed(s.mbps));
            setCard('st-up', fmtSpeed(s.mbps));
            subEl.textContent = `${fmtBytes(s.bytes)} sent`;
            setPhase('Testing upload', 0.64 + s.progress * 0.34);
          },
        });
        results.up = up;
        setCard('st-up', fmtSpeed(up.mbps));

        bailIfStopped();

        /* Done. */
        mark(null, false);
        setPhase('Done', 1);
        setBig(fmtSpeed(down.mbps));
        subEl.textContent = 'Download speed';

        const v = verdict(down.mbps, lat.median);
        verdictEl.hidden = false;
        verdictEl.innerHTML = `
          <strong>${v.grade}</strong>
          <span>${v.note} Latency is ${latencyQuality(lat.median)} at ${Math.round(lat.median)} ms.</span>`;

        analytics?.completed({
          resultCount: 1,
          durationMs: Math.round((down.seconds + up.seconds) * 1000),
        });
      } catch (err) {
        if (err.name === 'AbortError' || signal.aborted) {
          setPhase('Stopped', 0);
          subEl.textContent = 'Test cancelled';
        } else {
          mark(null, false);
          setPhase('Could not complete', 0);
          setBig('—');
          // Say which failure it was: blocked and offline need different actions.
          subEl.textContent = navigator.onLine
            ? 'The test server could not be reached. A VPN, firewall or content blocker will do this.'
            : 'You appear to be offline.';
          analytics?.error('measure_failed');
        }
      } finally {
        running = false;
        goBtn.disabled = false;
        goBtn.textContent = 'Test again';
        stopBtn.hidden = true;
        mark(null, false);
        this._abort = null;
      }
    };

    goBtn.addEventListener('click', run);
    stopBtn.addEventListener('click', () => this._abort?.abort());
  },

  destroy() {
    // Stop any in-flight streams the moment the user navigates away.
    this._abort?.abort();
    this._abort = null;
  },
};
