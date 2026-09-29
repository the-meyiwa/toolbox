/* ============================================================
   Music Library widgets, drawn as SVG strings:
   staff (notation), piano keyboard, fretboard, circle of fifths.
   Interactive bits are data attributes the tool listens for.
   Styles: css/music-library.css
   ============================================================ */

import { LETTERS, midi, noteName, pc, parseNote, circleOfFifths } from './theory.js';

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const ACC = { '-2': '𝄫', '-1': '♭', 0: '', 1: '♯', 2: '𝄪' };
const ACC_GLYPH = { '-2': 'bb', '-1': 'b', 1: '#', 2: 'x' };
const diat = (n) => n.letter + 7 * n.oct;

/* ---------------- staff ---------------- */

const GAP = 10; // distance between staff lines
const TREBLE = 'M14 86c-6 2-9-7-2-8 5-1 6 4 5 9M17 87L12.5 18c-.5-9 8-14 9-5 1 8-9 16-13 24-5 9-3 25 9 27 10 1 12-12 4-15-7-2-10 6-5 9';
const BASS = 'M6 41c0-12 19-13 19 1 0 14-11 23-20 29';
const SHARPS = { treble: ['F5', 'C5', 'G5', 'D5', 'A4', 'E5', 'B4'], bass: ['F3', 'C3', 'G3', 'D3', 'A2', 'E3', 'B2'] };
const FLATS = { treble: ['B4', 'E5', 'A4', 'D5', 'G4', 'C5', 'F4'], bass: ['B2', 'E3', 'A2', 'D3', 'G2', 'C3', 'F2'] };

function accidentalSvg(acc, x, y) {
  const k = ACC_GLYPH[acc];
  if (!k) return '';
  if (k === '#') return `<g class="ms-acc" transform="translate(${x} ${y})"><path d="M-2.5-9v17M2.5-10v17"/><path d="M-5-2.5l10-3M-5 4.5l10-3" stroke-width="2.6"/></g>`;
  if (k === 'b') return `<g class="ms-acc" transform="translate(${x} ${y})"><path d="M-3-14v17c4-3 9-5 8-9-1-3-5-2-8 1"/></g>`;
  if (k === 'x') return `<g class="ms-acc" transform="translate(${x} ${y})"><path d="M-4-4l8 8M4-4l-8 8" stroke-width="2.4"/></g>`;
  return `<g class="ms-acc" transform="translate(${x} ${y})"><path d="M-6-14v17c4-3 8-5 7-9-1-3-4-2-7 1M1-14v17c4-3 8-5 7-9-1-3-4-2-7 1"/></g>`;
}

/**
 * Staff notation. notes: array of note objects (or strings), shown one after another;
 * chords: array of arrays, stacked. opts: { clef, keySig (fifths), labels: [text], highlight: index }
 */
export function staffSvg(items, { clef = null, keySig = 0, labels = [], width = null, title = '' } = {}) {
  const cols = items.map(it => (Array.isArray(it) ? it : [it]).map(n => (typeof n === 'string' ? parseNote(n) : n)));
  const all = cols.flat();
  const avg = all.length ? all.reduce((s, n) => s + midi(n), 0) / all.length : 72;
  const c = clef || (avg < 57 ? 'bass' : 'treble');
  const bottomLine = c === 'treble' ? 30 : 18; // diatonic index of the bottom line (E4 / G2)
  const hiDiat = Math.max(bottomLine + 8, ...all.map(diat));
  const loDiat = Math.min(bottomLine, ...all.map(diat));
  const top = 16 + Math.max(0, hiDiat - (bottomLine + 8)) * GAP / 2 + 8;
  const yOf = d => top + (bottomLine + 8 - d) * GAP / 2;
  const staffBottom = yOf(bottomLine);
  const H = staffBottom + 22 + Math.max(0, bottomLine - loDiat) * GAP / 2 + (labels.length ? 18 : 0);
  const sigCount = Math.abs(keySig);
  const startX = 42 + sigCount * 10 + 12;
  const colW = cols.some(col => col.length > 1) ? 46 : 36;
  const W = width || startX + cols.length * colW + 16;
  let out = '';
  for (let i = 0; i < 5; i++) out += `<path class="ms-line" pathLength="1" style="--l:${i}" d="M4 ${yOf(bottomLine + i * 2)}H${W - 4}"/>`;
  out += `<path class="ms-line ms-bar" pathLength="1" d="M4 ${yOf(bottomLine + 8)}V${staffBottom}M${W - 4} ${yOf(bottomLine + 8)}V${staffBottom}"/>`;
  // Clef, scaled so its G / F line sits on the staff line.
  if (c === 'treble') out += `<path class="ms-clef" pathLength="1" transform="translate(6 ${yOf(bottomLine + 2) - 60})" d="${TREBLE}"/>`;
  else out += `<g class="ms-clef" transform="translate(8 ${yOf(bottomLine + 6) - 41})"><path pathLength="1" d="${BASS}"/><circle cx="6" cy="41" r="3.2" class="ms-fill"/><circle cx="30" cy="35" r="2" class="ms-fill"/><circle cx="30" cy="47" r="2" class="ms-fill"/></g>`;
  // Key signature.
  const sig = (keySig > 0 ? SHARPS : FLATS)[c].slice(0, sigCount);
  if (sig.length) out += `<g class="ms-sig">${sig.map((n, i) => `<g class="ms-sig-i" style="--c:${i}">${accidentalSvg(keySig > 0 ? 1 : -1, 44 + i * 10, yOf(diat(parseNote(n))))}</g>`).join('')}</g>`;
  cols.forEach((col, ci) => {
    const x = startX + ci * colW + colW / 2;
    const sorted = [...col].sort((a, b) => diat(a) - diat(b));
    out += `<g class="ms-col" data-col="${ci}" style="--c:${ci}">`;
    // Ledger lines.
    const ds = sorted.map(diat);
    for (let d = bottomLine - 2; d >= Math.min(...ds); d -= 2) out += `<path class="ms-ledger" d="M${x - 11} ${yOf(d)}H${x + 11}"/>`;
    for (let d = bottomLine + 10; d <= Math.max(...ds); d += 2) out += `<path class="ms-ledger" d="M${x - 11} ${yOf(d)}H${x + 11}"/>`;
    let prev = null, shift = false;
    sorted.forEach((n, k) => {
      shift = prev !== null && diat(n) - prev === 1 ? !shift : false;
      prev = diat(n);
      const hx = x + (shift ? 11 : 0), y = yOf(diat(n));
      if (n.acc) out += accidentalSvg(n.acc, x - 15 - (k % 2) * 7 * (sorted.length > 2 ? 1 : 0), y);
      out += `<ellipse class="ms-head" cx="${hx}" cy="${y}" rx="6.4" ry="4.6" transform="rotate(-20 ${hx} ${y})"/><ellipse class="ms-hole" cx="${hx}" cy="${y}" rx="3.2" ry="2" transform="rotate(-50 ${hx} ${y})"/>`;
    });
    if (labels[ci]) out += `<text class="ms-label" x="${x}" y="${H - 5}" text-anchor="middle">${esc(labels[ci])}</text>`;
    out += '</g>';
  });
  return `<svg class="ms-staff" viewBox="0 0 ${W} ${H}" width="${W}" role="img" aria-label="${esc(title || all.map(n => noteName(n, { octave: true })).join(' '))}">${out}</svg>`;
}

/* ---------------- piano ---------------- */

const BLACK = new Set([1, 3, 6, 8, 10]);
/**
 * Piano keyboard from `from` to `to` (MIDI). marks: Map midi → { label, tone: 'root'|'on'|'alt' }.
 * Keys carry data-midi so the tool can play them.
 */
export function pianoSvg({ from = 48, to = 83, marks = new Map(), showC = true } = {}) {
  const whites = [];
  for (let m = from; m <= to; m++) if (!BLACK.has(((m % 12) + 12) % 12)) whites.push(m);
  const WW = 24, WH = 110, BW = 15, BH = 68;
  const W = whites.length * WW;
  let w = '', b = '';
  whites.forEach((m, i) => {
    const mk = marks.get(m);
    w += `<g class="mk-key mk-white${mk ? ` is-${mk.tone || 'on'}` : ''}" data-midi="${m}" style="--k:${i}" role="button" aria-label="${m}"><rect x="${i * WW + 0.5}" y="0.5" width="${WW - 1}" height="${WH}" rx="3"/>${mk?.label ? `<text x="${i * WW + WW / 2}" y="${WH - 10}" text-anchor="middle">${esc(mk.label)}</text>` : showC && m % 12 === 0 ? `<text class="mk-c" x="${i * WW + WW / 2}" y="${WH - 8}" text-anchor="middle">C${Math.floor(m / 12) - 1}</text>` : ''}</g>`;
    const next = m + 1;
    if (next <= to && BLACK.has(next % 12)) {
      const mk2 = marks.get(next);
      const x = (i + 1) * WW - BW / 2;
      b += `<g class="mk-key mk-black${mk2 ? ` is-${mk2.tone || 'on'}` : ''}" data-midi="${next}" style="--k:${i + 0.5}" role="button" aria-label="${next}"><rect x="${x}" y="0.5" width="${BW}" height="${BH}" rx="2.5"/>${mk2?.label ? `<text x="${x + BW / 2}" y="${BH - 8}" text-anchor="middle">${esc(mk2.label)}</text>` : ''}</g>`;
    }
  });
  return `<svg class="mk-piano" viewBox="0 0 ${W + 1} ${WH + 1}" width="${W + 1}" role="group" aria-label="Piano keyboard">${w}${b}</svg>`;
}

/* ---------------- fretboard ---------------- */

export const FRET_TUNINGS = {
  guitar: { name: 'Guitar (standard)', strings: [40, 45, 50, 55, 59, 64] },
  'guitar-dropd': { name: 'Guitar (drop D)', strings: [38, 45, 50, 55, 59, 64] },
  'guitar-dadgad': { name: 'Guitar (DADGAD)', strings: [38, 45, 50, 55, 57, 62] },
  bass: { name: 'Bass (4-string)', strings: [28, 33, 38, 43] },
  'bass5': { name: 'Bass (5-string)', strings: [23, 28, 33, 38, 43] },
  ukulele: { name: 'Ukulele (GCEA)', strings: [67, 60, 64, 69] },
  mandolin: { name: 'Mandolin (GDAE)', strings: [55, 62, 69, 76] },
  violin: { name: 'Violin (GDAE)', strings: [55, 62, 69, 76] },
  banjo: { name: 'Banjo (open G)', strings: [67, 50, 55, 59, 62] },
};

/**
 * Fretboard. pcs: Map pitch class → { label, tone }. Strings are drawn low (bottom) to high (top),
 * as a guitarist sees the neck. Positions carry data-midi.
 */
export function fretboardSvg({ tuning = 'guitar', frets = 12, pcs = new Map() } = {}) {
  const strs = FRET_TUNINGS[tuning]?.strings || FRET_TUNINGS.guitar.strings;
  const FW = 44, SG = 22, LEFT = 30, TOP = 16;
  const W = LEFT + (frets + 1) * FW, H = TOP * 2 + (strs.length - 1) * SG + 14;
  let out = '';
  const yOf = s => TOP + (strs.length - 1 - s) * SG;
  out += `<rect class="fb-board" x="${LEFT}" y="${TOP - 6}" width="${(frets + 1) * FW - FW + 2}" height="${(strs.length - 1) * SG + 12}" rx="3"/>`;
  for (let f = 0; f <= frets; f++) out += `<path class="${f === 0 ? 'fb-nut' : 'fb-fret'}" pathLength="1" style="--f:${f}" d="M${LEFT + f * FW} ${TOP - 6}V${yOf(0) + 6}"/>`;
  for (const f of [3, 5, 7, 9, 15, 17]) if (f <= frets) out += `<circle class="fb-dot" cx="${LEFT + (f - 0.5) * FW}" cy="${H - 7}" r="3"/>`;
  if (frets >= 12) out += `<circle class="fb-dot" cx="${LEFT + 11.5 * FW - 5}" cy="${H - 7}" r="3"/><circle class="fb-dot" cx="${LEFT + 11.5 * FW + 5}" cy="${H - 7}" r="3"/>`;
  strs.forEach((open, s) => {
    out += `<path class="fb-string" pathLength="1" style="--s:${s}" d="M${LEFT} ${yOf(s)}H${W - FW + 2}" stroke-width="${1 + (strs.length - 1 - s) * 0.25}"/>`;
    for (let f = 0; f <= frets; f++) {
      const m = open + f, mk = pcs.get(((m % 12) + 12) % 12);
      const x = f === 0 ? LEFT - 14 : LEFT + (f - 0.5) * FW;
      if (mk) out += `<g class="fb-note is-${mk.tone || 'on'}" data-midi="${m}" style="--n:${(f + s * 0.6).toFixed(1)}" role="button"><circle cx="${x}" cy="${yOf(s)}" r="9.5"/><text x="${x}" y="${yOf(s) + 3.5}" text-anchor="middle">${esc(mk.label ?? '')}</text></g>`;
    }
  });
  for (let f = 1; f <= frets; f++) if ([1, 3, 5, 7, 9, 12, 15].includes(f)) out += `<text class="fb-num" x="${LEFT + (f - 0.5) * FW}" y="${TOP - 8}" text-anchor="middle">${f}</text>`;
  return `<svg class="mk-fret" viewBox="0 0 ${W} ${H}" width="${W}" role="group" aria-label="${esc(FRET_TUNINGS[tuning]?.name || 'Fretboard')}">${out}</svg>`;
}

/* ---------------- circle of fifths ---------------- */

export function circleSvg({ selected = 0 } = {}) {
  const data = circleOfFifths();
  const R = 150, r1 = 102, r2 = 62, C = 160;
  const pt = (rad, a) => [C + rad * Math.sin(a), C - rad * Math.cos(a)];
  let out = '';
  data.forEach((k, i) => {
    const a0 = (i - 0.5) * Math.PI / 6, a1 = (i + 0.5) * Math.PI / 6;
    const seg = (ro, ri) => { const [x0, y0] = pt(ro, a0), [x1, y1] = pt(ro, a1), [x2, y2] = pt(ri, a1), [x3, y3] = pt(ri, a0); return `M${x0} ${y0}A${ro} ${ro} 0 0 1 ${x1} ${y1}L${x2} ${y2}A${ri} ${ri} 0 0 0 ${x3} ${y3}Z`; };
    const sel = i === selected;
    const near = [((selected + 11) % 12), ((selected + 1) % 12)].includes(i);
    out += `<g class="cf-seg${sel ? ' is-sel' : near ? ' is-near' : ''}" data-circle="${i}" style="--i:${i}" role="button" tabindex="0" aria-label="${esc(k.major)} major, ${esc(k.minor)}">
      <path class="cf-major" d="${seg(R, r1)}"/><path class="cf-minor" d="${seg(r1, r2)}"/>
      <text class="cf-t1" x="${pt((R + r1) / 2, i * Math.PI / 6)[0]}" y="${pt((R + r1) / 2, i * Math.PI / 6)[1] + 5}" text-anchor="middle">${esc(k.major)}</text>
      <text class="cf-t2" x="${pt((r1 + r2) / 2, i * Math.PI / 6)[0]}" y="${pt((r1 + r2) / 2, i * Math.PI / 6)[1] + 4}" text-anchor="middle">${esc(k.minor)}</text>
    </g>`;
  });
  const k = data[selected];
  out += `<circle class="cf-hub" cx="${C}" cy="${C}" r="${r2 - 4}"/><text class="cf-hub-t" x="${C}" y="${C - 4}" text-anchor="middle">${k.fifths === 0 ? 'no ♯/♭' : `${Math.abs(k.fifths)}${k.fifths > 0 ? '♯' : '♭'}`}</text><text class="cf-hub-s" x="${C}" y="${C + 14}" text-anchor="middle">${esc(k.major)} / ${esc(k.minor)}</text>`;
  return `<svg class="mk-circle" viewBox="0 0 320 320" role="group" aria-label="Circle of fifths">${out}</svg>`;
}

export const pitchClassOf = (n) => pc(n);
export { ACC, LETTERS };
