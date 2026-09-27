/* ============================================================
   Colour vision deficiency simulation.

   Machado, Oliveira & Fernandes (2009) matrices at full severity for
   the dichromacies and anomalous trichromacies, applied in linear RGB
   (sRGB is decoded first, which the naive versions skip). Achromatopsia
   uses Rec. 709 luminance.
   ============================================================ */

export const DEFICIENCIES = [
  { id: 'protanopia', label: 'Protanopia', note: 'No red cones · about 1% of men', m: [[0.152286, 1.052583, -0.204868], [0.114503, 0.786281, 0.099216], [-0.003882, -0.048116, 1.051998]] },
  { id: 'deuteranopia', label: 'Deuteranopia', note: 'No green cones · about 1% of men', m: [[0.367322, 0.860646, -0.227968], [0.280085, 0.672501, 0.047413], [-0.011820, 0.042940, 0.968881]] },
  { id: 'tritanopia', label: 'Tritanopia', note: 'No blue cones · rare', m: [[1.255528, -0.076749, -0.178779], [-0.078411, 0.930809, 0.147602], [0.004733, 0.691367, 0.303900]] },
  { id: 'protanomaly', label: 'Protanomaly', note: 'Weak red · about 1% of men', m: [[0.458064, 0.679578, -0.137642], [0.092785, 0.846313, 0.060902], [-0.007494, -0.016807, 1.024301]] },
  { id: 'deuteranomaly', label: 'Deuteranomaly', note: 'Weak green · the most common, about 5% of men', m: [[0.547494, 0.607765, -0.155259], [0.181692, 0.781742, 0.036566], [-0.010410, 0.027275, 0.983136]] },
  { id: 'tritanomaly', label: 'Tritanomaly', note: 'Weak blue · rare', m: [[1.017277, 0.027029, -0.044306], [-0.006113, 0.958479, 0.047634], [0.006379, 0.248708, 0.744913]] },
  { id: 'achromatopsia', label: 'Achromatopsia', note: 'No colour · very rare', m: [[0.2126, 0.7152, 0.0722], [0.2126, 0.7152, 0.0722], [0.2126, 0.7152, 0.0722]] },
];
export const BY_ID = Object.fromEntries(DEFICIENCIES.map((d) => [d.id, d]));

const LIN = new Float32Array(256);
for (let i = 0; i < 256; i++) { const c = i / 255; LIN[i] = c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; }
const toSrgb = (v) => { const c = v <= 0 ? 0 : v >= 1 ? 1 : v <= 0.0031308 ? v * 12.92 : 1.055 * v ** (1 / 2.4) - 0.055; return Math.round(c * 255); };

export function simulateRgb([r, g, b], id) {
  const m = BY_ID[id]?.m;
  if (!m) return [r, g, b];
  const R = LIN[r]; const G = LIN[g]; const B = LIN[b];
  return m.map((row) => toSrgb(row[0] * R + row[1] * G + row[2] * B));
}

/** In place over ImageData.data (RGBA). */
export function simulatePixels(data, id) {
  const m = BY_ID[id]?.m;
  if (!m) return data;
  const [a, b, c] = m;
  for (let i = 0; i < data.length; i += 4) {
    const R = LIN[data[i]]; const G = LIN[data[i + 1]]; const B = LIN[data[i + 2]];
    data[i] = toSrgb(a[0] * R + a[1] * G + a[2] * B);
    data[i + 1] = toSrgb(b[0] * R + b[1] * G + b[2] * B);
    data[i + 2] = toSrgb(c[0] * R + c[1] * G + c[2] * B);
  }
  return data;
}

export function hexToRgb(hex) {
  let h = String(hex).trim().replace(/^#/, '');
  if (h.length === 3) h = [...h].map((c) => c + c).join('');
  if (!/^[0-9a-f]{6}$/i.test(h)) return null;
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
}
export const rgbToHex = (rgb) => `#${rgb.map((v) => v.toString(16).padStart(2, '0')).join('')}`;

/** CIE76 distance in Lab: under ~10 reads as "hard to tell apart". */
export function deltaE(a, b) {
  const lab = (rgb) => {
    const [R, G, B] = rgb.map((v) => LIN[v]);
    const f = (t) => (t > 216 / 24389 ? Math.cbrt(t) : (24389 / 27 * t + 16) / 116);
    const x = f((0.4124 * R + 0.3576 * G + 0.1805 * B) / 0.95047); const y = f(0.2126 * R + 0.7152 * G + 0.0722 * B); const z = f((0.0193 * R + 0.1192 * G + 0.9505 * B) / 1.08883);
    return [116 * y - 16, 500 * (x - y), 200 * (y - z)];
  };
  const p = lab(a); const q = lab(b);
  return Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]);
}

/** Pairs in a palette that become hard to tell apart under a deficiency. */
export function confusablePairs(hexes, id, threshold = 12) {
  const cols = hexes.map((h) => ({ hex: h, rgb: hexToRgb(h) })).filter((c) => c.rgb);
  const out = [];
  for (let i = 0; i < cols.length; i++) for (let j = i + 1; j < cols.length; j++) {
    const before = deltaE(cols[i].rgb, cols[j].rgb);
    const after = deltaE(simulateRgb(cols[i].rgb, id), simulateRgb(cols[j].rgb, id));
    if (after < threshold && before >= threshold) out.push({ a: cols[i].hex, b: cols[j].hex, before, after });
  }
  return out;
}
