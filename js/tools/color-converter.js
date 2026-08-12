import { copyText } from '../utils.js';

// --- Conversion helpers ---
function hexToRgb(hex) {
  hex = hex.replace(/^#/, '');
  if (hex.length === 3) hex = hex.split('').map(c => c + c).join('');
  if (hex.length !== 6) return null;
  const n = parseInt(hex, 16);
  if (isNaN(n)) return null;
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

function rgbToHex(r, g, b) {
  return '#' + [r, g, b].map(v => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('');
}

function rgbToHsl(r, g, b) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h = 0, s = 0, l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
    else if (max === g) h = ((b - r) / d + 2) / 6;
    else h = ((r - g) / d + 4) / 6;
  }
  return { h: Math.round(h * 360), s: Math.round(s * 100), l: Math.round(l * 100) };
}

function hslToRgb(h, s, l) {
  h /= 360; s /= 100; l /= 100;
  let r, g, b;
  if (s === 0) {
    r = g = b = l;
  } else {
    const hue2rgb = (p, q, t) => {
      if (t < 0) t += 1;
      if (t > 1) t -= 1;
      if (t < 1/6) return p + (q - p) * 6 * t;
      if (t < 1/2) return q;
      if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
      return p;
    };
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    r = hue2rgb(p, q, h + 1/3);
    g = hue2rgb(p, q, h);
    b = hue2rgb(p, q, h - 1/3);
  }
  return { r: Math.round(r * 255), g: Math.round(g * 255), b: Math.round(b * 255) };
}

export default {
  render(container) {
    container.innerHTML = `
      <div class="tool-section">
        <div class="color-swatch" id="clr-swatch" style="background:#3b82f6;"></div>
      </div>

      <div class="tool-section">
        <label class="tool-label">HEX</label>
        <div class="tool-row">
          <input type="text" class="tool-input" id="clr-hex" value="#3b82f6" style="flex:1; font-family:var(--mono);">
          <button class="copy-btn" id="clr-hex-copy">Copy</button>
        </div>
      </div>

      <div class="tool-section">
        <label class="tool-label">RGB</label>
        <div class="color-inputs">
          <div class="color-input-group">
            <label class="tool-label">R</label>
            <input type="number" class="tool-input" id="clr-r" value="59" min="0" max="255">
          </div>
          <div class="color-input-group">
            <label class="tool-label">G</label>
            <input type="number" class="tool-input" id="clr-g" value="130" min="0" max="255">
          </div>
          <div class="color-input-group">
            <label class="tool-label">B</label>
            <input type="number" class="tool-input" id="clr-b" value="246" min="0" max="255">
          </div>
        </div>
      </div>

      <div class="tool-section">
        <label class="tool-label">HSL</label>
        <div class="color-inputs">
          <div class="color-input-group">
            <label class="tool-label">H</label>
            <input type="number" class="tool-input" id="clr-h" value="217" min="0" max="360">
          </div>
          <div class="color-input-group">
            <label class="tool-label">S</label>
            <input type="number" class="tool-input" id="clr-s" value="91" min="0" max="100">
          </div>
          <div class="color-input-group">
            <label class="tool-label">L</label>
            <input type="number" class="tool-input" id="clr-l" value="60" min="0" max="100">
          </div>
        </div>
      </div>
    `;

    const swatch = container.querySelector('#clr-swatch');
    const hexIn  = container.querySelector('#clr-hex');
    const rIn = container.querySelector('#clr-r');
    const gIn = container.querySelector('#clr-g');
    const bIn = container.querySelector('#clr-b');
    const hIn = container.querySelector('#clr-h');
    const sIn = container.querySelector('#clr-s');
    const lIn = container.querySelector('#clr-l');

    function updateFromHex() {
      const rgb = hexToRgb(hexIn.value);
      if (!rgb) return;
      rIn.value = rgb.r; gIn.value = rgb.g; bIn.value = rgb.b;
      const hsl = rgbToHsl(rgb.r, rgb.g, rgb.b);
      hIn.value = hsl.h; sIn.value = hsl.s; lIn.value = hsl.l;
      swatch.style.backgroundColor = hexIn.value.startsWith('#') ? hexIn.value : '#' + hexIn.value;
    }

    function updateFromRgb() {
      const r = parseInt(rIn.value) || 0;
      const g = parseInt(gIn.value) || 0;
      const b = parseInt(bIn.value) || 0;
      hexIn.value = rgbToHex(r, g, b);
      const hsl = rgbToHsl(r, g, b);
      hIn.value = hsl.h; sIn.value = hsl.s; lIn.value = hsl.l;
      swatch.style.backgroundColor = hexIn.value;
    }

    function updateFromHsl() {
      const h = parseInt(hIn.value) || 0;
      const s = parseInt(sIn.value) || 0;
      const l = parseInt(lIn.value) || 0;
      const rgb = hslToRgb(h, s, l);
      rIn.value = rgb.r; gIn.value = rgb.g; bIn.value = rgb.b;
      hexIn.value = rgbToHex(rgb.r, rgb.g, rgb.b);
      swatch.style.backgroundColor = hexIn.value;
    }

    hexIn.addEventListener('input', updateFromHex);
    [rIn, gIn, bIn].forEach(el => el.addEventListener('input', updateFromRgb));
    [hIn, sIn, lIn].forEach(el => el.addEventListener('input', updateFromHsl));

    container.querySelector('#clr-hex-copy').addEventListener('click', (e) => {
      copyText(hexIn.value, e.currentTarget);
    });
  },

  destroy() {}
};
