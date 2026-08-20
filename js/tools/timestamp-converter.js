import { copyText } from '../utils.js';

function formatDate(date) {
  const pad = (n, d = 2) => String(n).padStart(d, '0');
  return `${date.getFullYear()}-${pad(date.getMonth()+1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

function relativeTime(date) {
  const now = new Date();
  const diffMs = date - now;
  const absDiff = Math.abs(diffMs);
  const past = diffMs < 0;
  const prefix = past ? '' : 'in ';
  const suffix = past ? ' ago' : '';

  const seconds = Math.floor(absDiff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours   = Math.floor(minutes / 60);
  const days    = Math.floor(hours / 24);

  if (seconds < 5) return 'just now';
  if (seconds < 60) return `${prefix}${seconds}s${suffix}`;
  if (minutes < 60) return `${prefix}${minutes}m${suffix}`;
  if (hours < 24)   return `${prefix}${hours}h${suffix}`;
  if (days < 30)    return `${prefix}${days}d${suffix}`;
  // Each step is bounded by the same unit it reports, so a date 364 days out
  // reads as 11 months rather than falling through to "0y".
  if (days < 365)   return `${prefix}${Math.floor(days / 30.44)}mo${suffix}`;
  return `${prefix}${Math.max(1, Math.floor(days / 365.25))}y${suffix}`;
}

let interval = null;

export default {
  render(container) {
    container.innerHTML = `
      <div class="tool-section">
        <label class="tool-label">Unix timestamp, in seconds</label>
        <div class="tool-row">
          <input type="text" class="tool-input" id="ts-unix" placeholder="e.g. 1700000000" style="flex:1;">
          <button class="btn btn-secondary btn-sm" id="ts-now">Now</button>
          <button class="copy-btn" id="ts-copy-unix">Copy</button>
        </div>
      </div>

      <div class="tool-section">
        <label class="tool-label">Date and time</label>
        <div class="tool-row">
          <input type="text" class="tool-input" id="ts-date" placeholder="YYYY-MM-DD HH:MM:SS" style="flex:1;">
          <button class="copy-btn" id="ts-copy-date">Copy</button>
        </div>
      </div>

      <div class="tool-section">
        <div class="timestamp-display" id="ts-info">
          <div><strong>ISO 8601:</strong> <span id="ts-iso">—</span></div>
          <div><strong>Relative:</strong> <span id="ts-relative">—</span></div>
          <div><strong>Day of week:</strong> <span id="ts-dow">—</span></div>
        </div>
      </div>

      <div class="tool-section" style="margin-top:20px;">
        <label class="tool-label">Right now</label>
        <div class="tool-output" id="ts-current" style="min-height:auto; padding:12px; text-align:center; font-size:1rem; font-weight:500;"></div>
      </div>
    `;

    const unixIn   = container.querySelector('#ts-unix');
    const dateIn   = container.querySelector('#ts-date');
    const isoEl    = container.querySelector('#ts-iso');
    const relEl    = container.querySelector('#ts-relative');
    const dowEl    = container.querySelector('#ts-dow');
    const currentEl = container.querySelector('#ts-current');

    const DAYS = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];

    function updateDisplay(date) {
      if (!date || isNaN(date.getTime())) {
        isoEl.textContent = '—';
        relEl.textContent = '—';
        dowEl.textContent = '—';
        return;
      }
      isoEl.textContent = date.toISOString();
      relEl.textContent = relativeTime(date);
      dowEl.textContent = DAYS[date.getDay()];
    }

    function fromUnix() {
      const val = unixIn.value.trim();
      if (!val) { updateDisplay(null); return; }
      let ts = parseFloat(val);
      // Auto-detect milliseconds vs seconds
      if (ts > 1e12) ts = ts / 1000;
      const date = new Date(ts * 1000);
      dateIn.value = formatDate(date);
      updateDisplay(date);
    }

    function fromDate() {
      const val = dateIn.value.trim();
      if (!val) { updateDisplay(null); return; }
      const date = new Date(val);
      if (isNaN(date.getTime())) { updateDisplay(null); return; }
      unixIn.value = Math.floor(date.getTime() / 1000);
      updateDisplay(date);
    }

    unixIn.addEventListener('input', fromUnix);
    dateIn.addEventListener('input', fromDate);

    container.querySelector('#ts-now').addEventListener('click', () => {
      const now = new Date();
      unixIn.value = Math.floor(now.getTime() / 1000);
      dateIn.value = formatDate(now);
      updateDisplay(now);
    });

    container.querySelector('#ts-copy-unix').addEventListener('click', (e) => {
      if (unixIn.value) copyText(unixIn.value, e.currentTarget);
    });

    container.querySelector('#ts-copy-date').addEventListener('click', (e) => {
      if (dateIn.value) copyText(dateIn.value, e.currentTarget);
    });

    // Live clock
    function tick() {
      const now = new Date();
      currentEl.textContent = `${Math.floor(now.getTime() / 1000)}  ·  ${formatDate(now)}`;
    }
    tick();
    interval = setInterval(tick, 1000);

    // Set initial value to now
    container.querySelector('#ts-now').click();
  },

  destroy() {
    if (interval) { clearInterval(interval); interval = null; }
  }
};
