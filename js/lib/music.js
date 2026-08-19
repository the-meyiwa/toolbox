/* ============================================================
   Music theory and pitch maths.

   One source of truth for note names, frequencies, scales and chords,
   so the tuner, the metronome, the chord finder and the tempo tools
   cannot disagree about what an F♯ is.

   Concert pitch is a parameter, not a constant: orchestras tune to 442
   or 443, period ensembles to 415, and a tuner that assumes 440 is
   useless to them.
   ============================================================ */

export const SHARP_NAMES = ['C', 'C♯', 'D', 'D♯', 'E', 'F', 'F♯', 'G', 'G♯', 'A', 'A♯', 'B'];
export const FLAT_NAMES  = ['C', 'D♭', 'D', 'E♭', 'E', 'F', 'G♭', 'G', 'A♭', 'A', 'B♭', 'B'];

/** MIDI note 69 is A4 by definition; everything else follows from it. */
export const A4_MIDI = 69;

export const midiToFreq = (midi, a4 = 440) => a4 * 2 ** ((midi - A4_MIDI) / 12);

export const freqToMidi = (freq, a4 = 440) => A4_MIDI + 12 * Math.log2(freq / a4);

export function midiToName(midi, { flats = false } = {}) {
  const n = Math.round(midi);
  const names = flats ? FLAT_NAMES : SHARP_NAMES;
  return { name: names[((n % 12) + 12) % 12], octave: Math.floor(n / 12) - 1 };
}

/** Nearest note to a frequency, and how far off it is in cents. */
export function analysePitch(freq, a4 = 440, { flats = false } = {}) {
  if (!(freq > 0)) return null;
  const exact = freqToMidi(freq, a4);
  const nearest = Math.round(exact);
  const cents = Math.round((exact - nearest) * 100);
  const { name, octave } = midiToName(nearest, { flats });
  return { freq, midi: nearest, name, octave, cents, target: midiToFreq(nearest, a4) };
}

/** Parse "C#4", "Bb3", "F♯2" into a MIDI number. */
export function nameToMidi(text) {
  const m = String(text).trim().match(/^([A-Ga-g])([#♯b♭]?)(-?\d+)?$/);
  if (!m) return null;
  const base = { c: 0, d: 2, e: 4, f: 5, g: 7, a: 9, b: 11 }[m[1].toLowerCase()];
  const accidental = /[#♯]/.test(m[2]) ? 1 : /[b♭]/.test(m[2]) ? -1 : 0;
  const octave = m[3] === undefined ? 4 : Number(m[3]);
  return (octave + 1) * 12 + base + accidental;
}

/* ---------------- scales ---------------- */

export const SCALES = {
  major:            { name: 'Major (Ionian)', steps: [0, 2, 4, 5, 7, 9, 11] },
  naturalMinor:     { name: 'Natural minor (Aeolian)', steps: [0, 2, 3, 5, 7, 8, 10] },
  harmonicMinor:    { name: 'Harmonic minor', steps: [0, 2, 3, 5, 7, 8, 11] },
  melodicMinor:     { name: 'Melodic minor', steps: [0, 2, 3, 5, 7, 9, 11] },
  dorian:           { name: 'Dorian', steps: [0, 2, 3, 5, 7, 9, 10] },
  phrygian:         { name: 'Phrygian', steps: [0, 1, 3, 5, 7, 8, 10] },
  lydian:           { name: 'Lydian', steps: [0, 2, 4, 6, 7, 9, 11] },
  mixolydian:       { name: 'Mixolydian', steps: [0, 2, 4, 5, 7, 9, 10] },
  locrian:          { name: 'Locrian', steps: [0, 1, 3, 5, 6, 8, 10] },
  majorPentatonic:  { name: 'Major pentatonic', steps: [0, 2, 4, 7, 9] },
  minorPentatonic:  { name: 'Minor pentatonic', steps: [0, 3, 5, 7, 10] },
  blues:            { name: 'Blues', steps: [0, 3, 5, 6, 7, 10] },
  wholeTone:        { name: 'Whole tone', steps: [0, 2, 4, 6, 8, 10] },
  chromatic:        { name: 'Chromatic', steps: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11] },
};

/* ---------------- chords ---------------- */

export const CHORDS = {
  maj:     { name: 'Major', suffix: '', steps: [0, 4, 7] },
  min:     { name: 'Minor', suffix: 'm', steps: [0, 3, 7] },
  dim:     { name: 'Diminished', suffix: 'dim', steps: [0, 3, 6] },
  aug:     { name: 'Augmented', suffix: 'aug', steps: [0, 4, 8] },
  sus2:    { name: 'Suspended 2nd', suffix: 'sus2', steps: [0, 2, 7] },
  sus4:    { name: 'Suspended 4th', suffix: 'sus4', steps: [0, 5, 7] },
  maj6:    { name: 'Major 6th', suffix: '6', steps: [0, 4, 7, 9] },
  min6:    { name: 'Minor 6th', suffix: 'm6', steps: [0, 3, 7, 9] },
  dom7:    { name: 'Dominant 7th', suffix: '7', steps: [0, 4, 7, 10] },
  maj7:    { name: 'Major 7th', suffix: 'maj7', steps: [0, 4, 7, 11] },
  min7:    { name: 'Minor 7th', suffix: 'm7', steps: [0, 3, 7, 10] },
  min7b5:  { name: 'Half-diminished', suffix: 'm7♭5', steps: [0, 3, 6, 10] },
  dim7:    { name: 'Diminished 7th', suffix: 'dim7', steps: [0, 3, 6, 9] },
  add9:    { name: 'Added 9th', suffix: 'add9', steps: [0, 4, 7, 14] },
  dom9:    { name: 'Dominant 9th', suffix: '9', steps: [0, 4, 7, 10, 14] },
  maj9:    { name: 'Major 9th', suffix: 'maj9', steps: [0, 4, 7, 11, 14] },
  min9:    { name: 'Minor 9th', suffix: 'm9', steps: [0, 3, 7, 10, 14] },
  dom11:   { name: 'Dominant 11th', suffix: '11', steps: [0, 7, 10, 14, 17] },
  dom13:   { name: 'Dominant 13th', suffix: '13', steps: [0, 4, 7, 10, 14, 21] },
  five:    { name: 'Power chord', suffix: '5', steps: [0, 7] },
};

/** Interval names, used to label what each note is doing in a chord. */
const DEGREE = {
  0: 'root', 1: '♭9', 2: '9', 3: '♭3', 4: '3', 5: '11', 6: '♭5',
  7: '5', 8: '♯5', 9: '6', 10: '♭7', 11: '7', 14: '9', 17: '11', 21: '13',
};

export function spellChord(rootPc, chordId, { flats = false } = {}) {
  const chord = CHORDS[chordId];
  if (!chord) return null;
  const names = flats ? FLAT_NAMES : SHARP_NAMES;
  return chord.steps.map(step => ({
    pc: (rootPc + step) % 12,
    name: names[(rootPc + step) % 12],
    degree: DEGREE[step] ?? `+${step}`,
    step,
  }));
}

export function spellScale(rootPc, scaleId, { flats = false } = {}) {
  const scale = SCALES[scaleId];
  if (!scale) return null;
  const names = flats ? FLAT_NAMES : SHARP_NAMES;
  return scale.steps.map((step, i) => ({
    pc: (rootPc + step) % 12,
    name: names[(rootPc + step) % 12],
    degree: i + 1,
    step,
  }));
}

/** Diatonic triads built on each degree — the chords that fit a key. */
export function chordsInKey(rootPc, scaleId, { flats = false } = {}) {
  const scale = SCALES[scaleId];
  if (!scale || scale.steps.length !== 7) return [];
  const names = flats ? FLAT_NAMES : SHARP_NAMES;
  const numerals = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII'];

  return scale.steps.map((_, i) => {
    // Stack thirds within the scale: degrees i, i+2, i+4.
    const pcs = [0, 2, 4].map(off => (rootPc + scale.steps[(i + off) % 7]) % 12);
    const third = (pcs[1] - pcs[0] + 12) % 12;
    const fifth = (pcs[2] - pcs[0] + 12) % 12;

    let quality = '?', suffix = '', numeral = numerals[i];
    if (third === 4 && fifth === 7)      { quality = 'major'; }
    else if (third === 3 && fifth === 7) { quality = 'minor'; suffix = 'm'; numeral = numeral.toLowerCase(); }
    else if (third === 3 && fifth === 6) { quality = 'diminished'; suffix = 'dim'; numeral = numeral.toLowerCase() + '°'; }
    else if (third === 4 && fifth === 8) { quality = 'augmented'; suffix = 'aug'; numeral = numeral + '+'; }

    return { degree: i + 1, numeral, root: names[pcs[0]], symbol: names[pcs[0]] + suffix, quality, pcs };
  });
}

/* ---------------- key signatures ---------------- */

/** Circle of fifths: sharps clockwise from C, flats anticlockwise. */
export const KEY_SIGNATURES = [
  { major: 'C',  minor: 'Am',  accidentals: 0,  type: '' },
  { major: 'G',  minor: 'Em',  accidentals: 1,  type: '♯' },
  { major: 'D',  minor: 'Bm',  accidentals: 2,  type: '♯' },
  { major: 'A',  minor: 'F♯m', accidentals: 3,  type: '♯' },
  { major: 'E',  minor: 'C♯m', accidentals: 4,  type: '♯' },
  { major: 'B',  minor: 'G♯m', accidentals: 5,  type: '♯' },
  { major: 'F♯', minor: 'D♯m', accidentals: 6,  type: '♯' },
  { major: 'F',  minor: 'Dm',  accidentals: 1,  type: '♭' },
  { major: 'B♭', minor: 'Gm',  accidentals: 2,  type: '♭' },
  { major: 'E♭', minor: 'Cm',  accidentals: 3,  type: '♭' },
  { major: 'A♭', minor: 'Fm',  accidentals: 4,  type: '♭' },
  { major: 'D♭', minor: 'B♭m', accidentals: 5,  type: '♭' },
  { major: 'G♭', minor: 'E♭m', accidentals: 6,  type: '♭' },
];

/* ---------------- instruments ---------------- */

/** Open-string MIDI numbers, low to high. */
export const TUNINGS = {
  'guitar-standard':  { name: 'Guitar — standard (EADGBE)', strings: [40, 45, 50, 55, 59, 64], frets: 22 },
  'guitar-dropd':     { name: 'Guitar — drop D', strings: [38, 45, 50, 55, 59, 64], frets: 22 },
  'guitar-halfdown':  { name: 'Guitar — half step down', strings: [39, 44, 49, 54, 58, 63], frets: 22 },
  'guitar-dadgad':    { name: 'Guitar — DADGAD', strings: [38, 45, 50, 55, 57, 62], frets: 22 },
  'guitar-open-g':    { name: 'Guitar — open G', strings: [38, 43, 50, 55, 59, 62], frets: 22 },
  'bass-4':           { name: 'Bass — 4 string (EADG)', strings: [28, 33, 38, 43], frets: 24 },
  'bass-5':           { name: 'Bass — 5 string (BEADG)', strings: [23, 28, 33, 38, 43], frets: 24 },
  'ukulele':          { name: 'Ukulele — GCEA', strings: [67, 60, 64, 69], frets: 18 },
  'mandolin':         { name: 'Mandolin — GDAE', strings: [55, 62, 69, 76], frets: 20 },
  'violin':           { name: 'Violin — GDAE', strings: [55, 62, 69, 76], frets: 0 },
  'cello':            { name: 'Cello — CGDA', strings: [36, 43, 50, 57], frets: 0 },
};

/* ---------------- tempo ---------------- */

/** Note lengths as a multiple of a beat (a quarter note). */
export const NOTE_VALUES = [
  { id: '1',    name: 'Whole note',      beats: 4 },
  { id: '1/2',  name: 'Half note',       beats: 2 },
  { id: '1/4',  name: 'Quarter note',    beats: 1 },
  { id: '1/8',  name: 'Eighth note',     beats: 0.5 },
  { id: '1/16', name: 'Sixteenth note',  beats: 0.25 },
  { id: '1/32', name: 'Thirty-second',   beats: 0.125 },
];

/** Milliseconds for one note value at a tempo, straight / dotted / triplet. */
export function noteMs(bpm, beats) {
  const beatMs = 60000 / bpm;
  return {
    straight: beatMs * beats,
    dotted: beatMs * beats * 1.5,
    triplet: (beatMs * beats * 2) / 3,
  };
}

/** Italian tempo markings, for reading what a score is asking for. */
export const TEMPO_MARKS = [
  { name: 'Larghissimo', min: 0,   max: 24 },
  { name: 'Grave',       min: 25,  max: 45 },
  { name: 'Largo',       min: 40,  max: 60 },
  { name: 'Adagio',      min: 61,  max: 76 },
  { name: 'Andante',     min: 77,  max: 108 },
  { name: 'Moderato',    min: 109, max: 120 },
  { name: 'Allegro',     min: 121, max: 156 },
  { name: 'Vivace',      min: 157, max: 176 },
  { name: 'Presto',      min: 177, max: 200 },
  { name: 'Prestissimo', min: 201, max: 400 },
];

export const tempoMark = (bpm) =>
  TEMPO_MARKS.find(t => bpm >= t.min && bpm <= t.max)?.name ?? '—';
