/* ============================================================
   Music theory engine — spelled correctly.

   Notes carry a letter (C D E F G A B), an accidental (−2…+2) and
   an octave, so every interval, scale and chord is spelled the way
   musicians write it: F major has B♭ (not A♯), the leading note of
   G♯ minor is F𝄪, a C augmented triad is C–E–G♯.

   Used by the Music Theory Library and the Assistant.
   ============================================================ */

export const LETTERS = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];
const LETTER_PC = [0, 2, 4, 5, 7, 9, 11];
const ACC_TEXT = { '-2': '𝄫', '-1': '♭', 0: '', 1: '♯', 2: '𝄪' };
const ACC_ASCII = { '-2': 'bb', '-1': 'b', 0: '', 1: '#', 2: 'x' };
const mod = (n, m) => ((n % m) + m) % m;

/* ---------------- notes ---------------- */

/** Parse "C", "F#4", "Bb3", "E♭", "Gx", "Abb2". Octave defaults to 4. */
export function parseNote(text) {
  const m = String(text).trim().match(/^([A-Ga-g])(𝄪|𝄫|##|bb|x|#|♯|b|♭)?(-?\d+)?$/);
  if (!m) return null;
  const acc = { '#': 1, '♯': 1, '##': 2, x: 2, '𝄪': 2, b: -1, '♭': -1, bb: -2, '𝄫': -2 }[m[2] || ''] ?? 0;
  return { letter: LETTERS.indexOf(m[1].toUpperCase()), acc, oct: m[3] !== undefined ? Number(m[3]) : 4 };
}

export const pc = (n) => mod(LETTER_PC[n.letter] + n.acc, 12);
/** MIDI number (C4 = 60). */
export const midi = (n) => (n.oct + 1) * 12 + LETTER_PC[n.letter] + n.acc;
export const noteName = (n, { ascii = false, octave = false } = {}) => `${LETTERS[n.letter]}${(ascii ? ACC_ASCII : ACC_TEXT)[n.acc] ?? ''}${octave ? n.oct : ''}`;
export const freq = (n, a4 = 440) => a4 * 2 ** ((midi(n) - 69) / 12);

/* ---------------- intervals ---------------- */

// Semitones of the major/perfect interval for each generic number 1–7.
const BASE = [0, 2, 4, 5, 7, 9, 11];
const PERFECT = new Set([1, 4, 5]);
const QUALITY_NAMES = { P: 'perfect', M: 'major', m: 'minor', A: 'augmented', d: 'diminished', AA: 'doubly augmented', dd: 'doubly diminished' };
const NUMBER_NAMES = ['', 'unison', 'second', 'third', 'fourth', 'fifth', 'sixth', 'seventh', 'octave', 'ninth', 'tenth', 'eleventh', 'twelfth', 'thirteenth', 'fourteenth', 'double octave'];

/** Parse "M3", "P5", "m7", "A4", "d5", "M9", "P11", "m13". */
export function parseInterval(text) {
  const m = String(text).trim().match(/^(P|M|m|AA|A|dd|d)(\d{1,2})$/);
  if (!m) return null;
  const q = m[1], num = Number(m[2]);
  const simple = ((num - 1) % 7) + 1, octaves = Math.floor((num - 1) / 7);
  const base = BASE[simple - 1] + 12 * octaves;
  const perfect = PERFECT.has(simple);
  const offset = perfect
    ? { P: 0, A: 1, AA: 2, d: -1, dd: -2 }[q]
    : { M: 0, m: -1, A: 1, AA: 2, d: -2, dd: -3 }[q];
  if (offset === undefined) return null;
  return { quality: q, number: num, semitones: base + offset };
}

export function intervalLongName(text) {
  const i = parseInterval(text);
  if (!i) return text;
  const n = i.number === 8 ? 'octave' : NUMBER_NAMES[i.number] || `${i.number}th`;
  return `${QUALITY_NAMES[i.quality]} ${n}`.replace('perfect unison', 'unison').replace('perfect octave', 'octave');
}

/** Transpose a note up (or down, dir −1) by an interval, keeping the spelling. */
export function transpose(note, interval, dir = 1) {
  const i = typeof interval === 'string' ? parseInterval(interval) : interval;
  if (!i) throw new Error(`Unknown interval ${interval}`);
  const steps = (i.number - 1) * dir;
  const letterAbs = note.letter + steps;
  const letter = mod(letterAbs, 7);
  const oct = note.oct + Math.floor(letterAbs / 7);
  const target = midi(note) + i.semitones * dir;
  const natural = (oct + 1) * 12 + LETTER_PC[letter];
  return { letter, acc: target - natural, oct };
}

/** Name of the interval from a up to b, e.g. "M3", "A4", "m10". */
export function intervalBetween(a, b) {
  let lo = a, hi = b;
  if (midi(b) < midi(a)) { lo = b; hi = a; }
  const number = (hi.letter + 7 * hi.oct) - (lo.letter + 7 * lo.oct) + 1;
  const semis = midi(hi) - midi(lo);
  const simple = ((number - 1) % 7) + 1, octaves = Math.floor((number - 1) / 7);
  const diff = semis - (BASE[simple - 1] + 12 * octaves);
  const q = PERFECT.has(simple)
    ? { '-2': 'dd', '-1': 'd', 0: 'P', 1: 'A', 2: 'AA' }[diff]
    : { '-3': 'dd', '-2': 'd', '-1': 'm', 0: 'M', 1: 'A', 2: 'AA' }[diff];
  return q ? `${q}${number}` : `?${number}`;
}

export const INTERVALS = [
  { id: 'P1', semis: 0, name: 'Unison', sound: 'The same note.', song: '' },
  { id: 'm2', semis: 1, name: 'Minor second', sound: 'Tense, crunchy: the “Jaws” theme.', song: 'Jaws (film theme)' },
  { id: 'M2', semis: 2, name: 'Major second', sound: 'A step: the start of a scale.', song: 'Happy Birthday (“Hap-py”)' },
  { id: 'm3', semis: 3, name: 'Minor third', sound: 'Sad or soft; the basis of minor chords.', song: 'Greensleeves' },
  { id: 'M3', semis: 4, name: 'Major third', sound: 'Bright; the basis of major chords.', song: 'When the Saints Go Marching In' },
  { id: 'P4', semis: 5, name: 'Perfect fourth', sound: 'Open, rising: a call to attention.', song: 'Here Comes the Bride' },
  { id: 'A4', semis: 6, name: 'Tritone (augmented fourth / diminished fifth)', sound: 'Unstable, wanting to resolve.', song: 'Maria (West Side Story)' },
  { id: 'P5', semis: 7, name: 'Perfect fifth', sound: 'Strong, hollow: power chords.', song: 'Twinkle Twinkle Little Star' },
  { id: 'm6', semis: 8, name: 'Minor sixth', sound: 'Bittersweet.', song: 'The Entertainer (opening leap)' },
  { id: 'M6', semis: 9, name: 'Major sixth', sound: 'Warm, open.', song: 'My Bonnie Lies over the Ocean' },
  { id: 'm7', semis: 10, name: 'Minor seventh', sound: 'Bluesy, unresolved.', song: 'Somewhere (There’s a Place for Us)' },
  { id: 'M7', semis: 11, name: 'Major seventh', sound: 'Dreamy and tense, one step below the octave.', song: 'Take On Me (chorus leap)' },
  { id: 'P8', semis: 12, name: 'Octave', sound: 'The same note higher.', song: 'Somewhere over the Rainbow' },
];

/* ---------------- scales ---------------- */

/** Each scale is a list of intervals above the tonic; spelling follows the interval numbers. */
export const SCALES = {
  major:             { name: 'Major (Ionian)', family: 'Diatonic', steps: ['P1', 'M2', 'M3', 'P4', 'P5', 'M6', 'M7'], mood: 'Bright, stable, resolved.', uses: 'Most Western folk, pop, classical and church music.' },
  'natural-minor':   { name: 'Natural minor (Aeolian)', family: 'Diatonic', steps: ['P1', 'M2', 'm3', 'P4', 'P5', 'm6', 'm7'], mood: 'Sad, serious, introspective.', uses: 'Minor-key songs of every style; rock and pop ballads.' },
  'harmonic-minor':  { name: 'Harmonic minor', family: 'Minor', steps: ['P1', 'M2', 'm3', 'P4', 'P5', 'm6', 'M7'], mood: 'Dramatic, “exotic” because of the augmented second between 6 and 7.', uses: 'Classical minor harmony (it provides the V chord), metal, Middle Eastern and klezmer colour.' },
  'melodic-minor':   { name: 'Melodic minor (ascending / jazz minor)', family: 'Minor', steps: ['P1', 'M2', 'm3', 'P4', 'P5', 'M6', 'M7'], mood: 'Minor with a smooth, bright top.', uses: 'Classical melodies going up (they descend in natural minor); in jazz used both ways.' },
  dorian:            { name: 'Dorian', family: 'Mode of the major scale', steps: ['P1', 'M2', 'm3', 'P4', 'P5', 'M6', 'm7'], mood: 'Minor but hopeful; the raised 6th is its colour.', uses: 'Funk, soul, jazz (minor ii chords), Celtic folk, “So What”.' },
  phrygian:          { name: 'Phrygian', family: 'Mode of the major scale', steps: ['P1', 'm2', 'm3', 'P4', 'P5', 'm6', 'm7'], mood: 'Dark, Spanish; the flat 2nd is its colour.', uses: 'Flamenco, metal, film scores.' },
  lydian:            { name: 'Lydian', family: 'Mode of the major scale', steps: ['P1', 'M2', 'M3', 'A4', 'P5', 'M6', 'M7'], mood: 'Dreamy, floating; the raised 4th is its colour.', uses: 'Film music (flying, wonder), jazz on maj7♯11 chords.' },
  mixolydian:        { name: 'Mixolydian', family: 'Mode of the major scale', steps: ['P1', 'M2', 'M3', 'P4', 'P5', 'M6', 'm7'], mood: 'Major but relaxed and bluesy; the flat 7th is its colour.', uses: 'Rock, blues, folk, highlife and afrobeat grooves over dominant chords.' },
  locrian:           { name: 'Locrian', family: 'Mode of the major scale', steps: ['P1', 'm2', 'm3', 'P4', 'd5', 'm6', 'm7'], mood: 'Unstable: its tonic chord is diminished.', uses: 'Over m7♭5 chords in jazz; rare as a home key.' },
  'major-pentatonic':{ name: 'Major pentatonic', family: 'Pentatonic', steps: ['P1', 'M2', 'M3', 'P5', 'M6'], mood: 'Open and happy, with no half steps to clash.', uses: 'Folk music worldwide, pop melodies, country, gospel, West African and Chinese music.' },
  'minor-pentatonic':{ name: 'Minor pentatonic', family: 'Pentatonic', steps: ['P1', 'm3', 'P4', 'P5', 'm7'], mood: 'Earthy, bluesy.', uses: 'Blues and rock solos, R&B, much African and Asian folk music.' },
  blues:             { name: 'Blues (minor blues scale)', family: 'Pentatonic', steps: ['P1', 'm3', 'P4', 'd5', 'P5', 'm7'], mood: 'Gritty; the ♭5 “blue note” bends the sound.', uses: 'Blues, rock, jazz, soul.' },
  'major-blues':     { name: 'Major blues', family: 'Pentatonic', steps: ['P1', 'M2', 'm3', 'M3', 'P5', 'M6'], mood: 'Sweet with a bluesy slide from ♭3 to 3.', uses: 'Country, gospel, jazz and blues in major keys.' },
  'whole-tone':      { name: 'Whole tone', family: 'Symmetric', steps: ['P1', 'M2', 'M3', 'A4', 'A5', 'm7'], mood: 'Floating, dreamlike, no pull to a tonic.', uses: 'Debussy, film dream sequences, over augmented and 7♯5 chords.' },
  'diminished-hw':   { name: 'Diminished (half–whole)', family: 'Symmetric', steps: ['P1', 'm2', 'm3', 'M3', 'A4', 'P5', 'M6', 'm7'], mood: 'Tense and angular.', uses: 'Jazz over 7♭9 dominant chords.' },
  'diminished-wh':   { name: 'Diminished (whole–half)', family: 'Symmetric', steps: ['P1', 'M2', 'm3', 'P4', 'd5', 'm6', 'M6', 'M7'], mood: 'Dark and symmetrical.', uses: 'Jazz over diminished seventh chords; horror film scores.' },
  chromatic:         { name: 'Chromatic', family: 'Symmetric', steps: ['P1', 'm2', 'M2', 'm3', 'M3', 'P4', 'A4', 'P5', 'm6', 'M6', 'm7', 'M7'], mood: 'All twelve notes.', uses: 'Passing notes, runs, twelve-tone music.' },
  'lydian-dominant': { name: 'Lydian dominant (Lydian ♭7)', family: 'Mode of melodic minor', steps: ['P1', 'M2', 'M3', 'A4', 'P5', 'M6', 'm7'], mood: 'Bright with a bluesy ♭7 and dreamy ♯4.', uses: 'Jazz on 7♯11 chords, the “Simpsons” theme.' },
  altered:           { name: 'Altered (super-Locrian)', family: 'Mode of melodic minor', steps: ['P1', 'm2', 'A2', 'M3', 'd5', 'm6', 'm7'], mood: 'Maximum tension over a dominant chord.', uses: 'Jazz over 7alt chords resolving to I.' },
  'phrygian-dominant': { name: 'Phrygian dominant', family: 'Mode of harmonic minor', steps: ['P1', 'm2', 'M3', 'P4', 'P5', 'm6', 'm7'], mood: 'Middle Eastern, flamenco, klezmer.', uses: 'Hijaz maqam relatives, flamenco, metal, Jewish and Arabic music.' },
  'hungarian-minor': { name: 'Hungarian minor (double harmonic minor)', family: 'Exotic', steps: ['P1', 'M2', 'm3', 'A4', 'P5', 'm6', 'M7'], mood: 'Dramatic, with two augmented seconds.', uses: 'Eastern European and Romani music, Liszt.' },
  'double-harmonic': { name: 'Double harmonic major (Byzantine)', family: 'Exotic', steps: ['P1', 'm2', 'M3', 'P4', 'P5', 'm6', 'M7'], mood: 'Intense and ornate.', uses: 'Arabic (maqam Hijaz Kar), Indian (Bhairav thaat), film scores.' },
  'bebop-dominant':  { name: 'Bebop dominant', family: 'Bebop', steps: ['P1', 'M2', 'M3', 'P4', 'P5', 'M6', 'm7', 'M7'], mood: 'Mixolydian with a passing major 7th, so chord tones fall on the beat.', uses: 'Jazz lines over dominant chords.' },
  hirajoshi:         { name: 'Hirajōshi', family: 'World', steps: ['P1', 'M2', 'm3', 'P5', 'm6'], mood: 'Japanese, gentle and melancholy.', uses: 'Koto music; film and game scores.' },
  in:                { name: 'In (Miyako-bushi)', family: 'World', steps: ['P1', 'm2', 'P4', 'P5', 'm6'], mood: 'Japanese, austere.', uses: 'Japanese traditional music, shakuhachi.' },
  'egyptian':        { name: 'Egyptian (suspended pentatonic)', family: 'Pentatonic', steps: ['P1', 'M2', 'P4', 'P5', 'm7'], mood: 'Open and ambiguous, neither major nor minor.', uses: 'Folk music across Africa and Asia.' },
};

export function scaleNotes(tonic, scaleId) {
  const s = SCALES[scaleId];
  if (!s) throw new Error(`Unknown scale ${scaleId}`);
  const t = typeof tonic === 'string' ? parseNote(tonic) : tonic;
  return s.steps.map(i => transpose(t, i));
}

export const DEGREE_NAMES = ['Tonic', 'Supertonic', 'Mediant', 'Subdominant', 'Dominant', 'Submediant', 'Leading note'];

/* ---------------- chords ---------------- */

export const CHORDS = {
  '':      { name: 'Major triad', steps: ['P1', 'M3', 'P5'], family: 'Triad' },
  m:       { name: 'Minor triad', steps: ['P1', 'm3', 'P5'], family: 'Triad' },
  dim:     { name: 'Diminished triad', steps: ['P1', 'm3', 'd5'], family: 'Triad' },
  aug:     { name: 'Augmented triad', steps: ['P1', 'M3', 'A5'], family: 'Triad' },
  sus2:    { name: 'Suspended second', steps: ['P1', 'M2', 'P5'], family: 'Suspended' },
  sus4:    { name: 'Suspended fourth', steps: ['P1', 'P4', 'P5'], family: 'Suspended' },
  5:       { name: 'Power chord (fifth)', steps: ['P1', 'P5'], family: 'Dyad' },
  6:       { name: 'Major sixth', steps: ['P1', 'M3', 'P5', 'M6'], family: 'Sixth' },
  m6:      { name: 'Minor sixth', steps: ['P1', 'm3', 'P5', 'M6'], family: 'Sixth' },
  '6/9':   { name: 'Six-nine', steps: ['P1', 'M3', 'P5', 'M6', 'M9'], family: 'Sixth' },
  add9:    { name: 'Added ninth', steps: ['P1', 'M3', 'P5', 'M9'], family: 'Added note' },
  madd9:   { name: 'Minor added ninth', steps: ['P1', 'm3', 'P5', 'M9'], family: 'Added note' },
  7:       { name: 'Dominant seventh', steps: ['P1', 'M3', 'P5', 'm7'], family: 'Seventh' },
  maj7:    { name: 'Major seventh', steps: ['P1', 'M3', 'P5', 'M7'], family: 'Seventh' },
  m7:      { name: 'Minor seventh', steps: ['P1', 'm3', 'P5', 'm7'], family: 'Seventh' },
  m7b5:    { name: 'Half-diminished seventh (m7♭5)', steps: ['P1', 'm3', 'd5', 'm7'], family: 'Seventh' },
  dim7:    { name: 'Diminished seventh', steps: ['P1', 'm3', 'd5', 'd7'], family: 'Seventh' },
  mMaj7:   { name: 'Minor-major seventh', steps: ['P1', 'm3', 'P5', 'M7'], family: 'Seventh' },
  aug7:    { name: 'Augmented seventh (7♯5)', steps: ['P1', 'M3', 'A5', 'm7'], family: 'Seventh' },
  augMaj7: { name: 'Augmented major seventh', steps: ['P1', 'M3', 'A5', 'M7'], family: 'Seventh' },
  '7sus4': { name: 'Dominant seventh suspended fourth', steps: ['P1', 'P4', 'P5', 'm7'], family: 'Seventh' },
  9:       { name: 'Dominant ninth', steps: ['P1', 'M3', 'P5', 'm7', 'M9'], family: 'Extended' },
  maj9:    { name: 'Major ninth', steps: ['P1', 'M3', 'P5', 'M7', 'M9'], family: 'Extended' },
  m9:      { name: 'Minor ninth', steps: ['P1', 'm3', 'P5', 'm7', 'M9'], family: 'Extended' },
  11:      { name: 'Dominant eleventh', steps: ['P1', 'M3', 'P5', 'm7', 'M9', 'P11'], family: 'Extended' },
  m11:     { name: 'Minor eleventh', steps: ['P1', 'm3', 'P5', 'm7', 'M9', 'P11'], family: 'Extended' },
  'maj7#11': { name: 'Major seventh sharp eleventh (Lydian)', steps: ['P1', 'M3', 'P5', 'M7', 'A11'], family: 'Extended' },
  13:      { name: 'Dominant thirteenth', steps: ['P1', 'M3', 'P5', 'm7', 'M9', 'M13'], family: 'Extended' },
  maj13:   { name: 'Major thirteenth', steps: ['P1', 'M3', 'P5', 'M7', 'M9', 'M13'], family: 'Extended' },
  m13:     { name: 'Minor thirteenth', steps: ['P1', 'm3', 'P5', 'm7', 'M9', 'M13'], family: 'Extended' },
  '7b9':   { name: 'Dominant seventh flat nine', steps: ['P1', 'M3', 'P5', 'm7', 'm9'], family: 'Altered' },
  '7#9':   { name: 'Dominant seventh sharp nine (“Hendrix chord”)', steps: ['P1', 'M3', 'P5', 'm7', 'A9'], family: 'Altered' },
  '7#11':  { name: 'Dominant seventh sharp eleven', steps: ['P1', 'M3', 'P5', 'm7', 'A11'], family: 'Altered' },
  '7b13':  { name: 'Dominant seventh flat thirteen', steps: ['P1', 'M3', 'P5', 'm7', 'm13'], family: 'Altered' },
  '7b5':   { name: 'Dominant seventh flat five', steps: ['P1', 'M3', 'd5', 'm7'], family: 'Altered' },
  '7alt':  { name: 'Altered dominant (7♭9♯9♭5♭13 family)', steps: ['P1', 'M3', 'm7', 'm9', 'A9', 'd5', 'm13'], family: 'Altered' },
};

const QUALITY_ALIASES = { M: '', maj: '', min: 'm', '-': 'm', mi: 'm', o: 'dim', '°': 'dim', '+': 'aug', 'ø': 'm7b5', 'ø7': 'm7b5', '-7': 'm7', mi7: 'm7', min7: 'm7', Δ: 'maj7', 'Δ7': 'maj7', M7: 'maj7', ma7: 'maj7', o7: 'dim7', '°7': 'dim7', '+7': 'aug7', '7#5': 'aug7', 'm(maj7)': 'mMaj7', mM7: 'mMaj7', '-Δ7': 'mMaj7', sus: 'sus4', 69: '6/9', '7sus': '7sus4', dom7: '7', M9: 'maj9', M13: 'maj13', '-9': 'm9', '-11': 'm11', '-13': 'm13', alt: '7alt' };

/** Parse a chord symbol: "C", "F#m7", "Bbmaj7", "Dø", "G7b9", "C/E". */
export function parseChord(symbol) {
  const m = String(symbol).trim().replace(/♯/g, '#').replace(/♭/g, 'b').match(/^([A-G](?:#|b)?)(.*?)(?:\/([A-G](?:#|b)?))?$/);
  if (!m) return null;
  let q = m[2];
  if (!(q in CHORDS)) q = QUALITY_ALIASES[q] ?? null;
  if (q === null || !(q in CHORDS)) return null;
  const root = parseNote(`${m[1]}4`);
  return { root, quality: q, bass: m[3] ? parseNote(`${m[3]}3`) : null, symbol: `${noteName(root)}${q}${m[3] ? '/' + noteName(parseNote(m[3])) : ''}` };
}

export function chordNotes(symbolOrRoot, quality) {
  const c = quality === undefined ? parseChord(symbolOrRoot) : { root: typeof symbolOrRoot === 'string' ? parseNote(symbolOrRoot) : symbolOrRoot, quality };
  if (!c) throw new Error(`Unknown chord ${symbolOrRoot}`);
  return CHORDS[c.quality].steps.map(i => transpose(c.root, i));
}

/** Names the chords made by a set of notes (any order, any octave). */
export function identifyChord(notes) {
  const pcs = [...new Set(notes.map(n => (typeof n === 'number' ? mod(n, 12) : pc(n))))];
  if (pcs.length < 2) return [];
  const bassPc = typeof notes[0] === 'number' ? mod(Math.min(...notes), 12) : pc(notes.reduce((a, b) => (midi(a) <= midi(b) ? a : b)));
  const out = [];
  for (const rootPc of pcs) {
    for (const [q, def] of Object.entries(CHORDS)) {
      if (q === '7alt') continue;
      const set = new Set(def.steps.map(s => mod(rootPc + parseInterval(s).semitones, 12)));
      if (set.size !== pcs.length || !pcs.every(p => set.has(p))) continue;
      const root = spellPc(rootPc);
      const bass = rootPc !== bassPc ? spellPc(bassPc) : null;
      out.push({ symbol: `${noteName(root)}${q}${bass ? '/' + noteName(bass) : ''}`, name: `${noteName(root)} ${def.name.toLowerCase()}${bass ? `, ${noteName(bass)} in the bass` : ''}`, rootPosition: !bass, family: def.family });
    }
  }
  return out.sort((a, b) => Number(b.rootPosition) - Number(a.rootPosition) || a.symbol.length - b.symbol.length);
}

const COMMON_SPELLING = ['C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'];
export const spellPc = (p, oct = 4) => parseNote(`${COMMON_SPELLING[mod(p, 12)]}${oct}`);

/* ---------------- keys ---------------- */

/** Major keys in circle-of-fifths order with their signatures (positive = sharps). */
export const MAJOR_KEYS = [
  { key: 'C', fifths: 0 }, { key: 'G', fifths: 1 }, { key: 'D', fifths: 2 }, { key: 'A', fifths: 3 }, { key: 'E', fifths: 4 }, { key: 'B', fifths: 5 }, { key: 'F#', fifths: 6 }, { key: 'C#', fifths: 7 },
  { key: 'F', fifths: -1 }, { key: 'Bb', fifths: -2 }, { key: 'Eb', fifths: -3 }, { key: 'Ab', fifths: -4 }, { key: 'Db', fifths: -5 }, { key: 'Gb', fifths: -6 }, { key: 'Cb', fifths: -7 },
];
const SHARP_ORDER = ['F', 'C', 'G', 'D', 'A', 'E', 'B'];
const FLAT_ORDER = ['B', 'E', 'A', 'D', 'G', 'C', 'F'];

/** Key signature of a major key or of its relative minor ("A minor" → 0). */
export function keySignature(tonic, mode = 'major') {
  let t = typeof tonic === 'string' ? parseNote(tonic) : tonic;
  if (mode === 'minor') t = transpose(t, 'm3');
  const name = noteName(t, { ascii: true });
  const k = MAJOR_KEYS.find(x => x.key === name);
  if (!k) return null;
  const list = k.fifths > 0 ? SHARP_ORDER.slice(0, k.fifths).map(l => `${l}♯`) : FLAT_ORDER.slice(0, -k.fifths).map(l => `${l}♭`);
  return { fifths: k.fifths, accidentals: list, text: k.fifths === 0 ? 'No sharps or flats' : `${Math.abs(k.fifths)} ${k.fifths > 0 ? 'sharp' : 'flat'}${Math.abs(k.fifths) > 1 ? 's' : ''}: ${list.join(' ')}` };
}

/** The circle of fifths: twelve positions with major and relative minor. */
export function circleOfFifths() {
  const names = ['C', 'G', 'D', 'A', 'E', 'B', 'F#/Gb', 'Db', 'Ab', 'Eb', 'Bb', 'F'];
  const minors = ['A', 'E', 'B', 'F#', 'C#', 'G#', 'D#/Eb', 'Bb', 'F', 'C', 'G', 'D'];
  const fifths = [0, 1, 2, 3, 4, 5, 6, -5, -4, -3, -2, -1];
  return names.map((n, i) => ({ major: n.replace(/#/g, '♯').replace(/b/g, '♭'), minor: `${minors[i].replace(/#/g, '♯').replace(/b(?!\/)/g, '♭')}m`, fifths: fifths[i] }));
}

const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII'];
const FUNCTION = ['Tonic', 'Predominant', 'Tonic (weak)', 'Predominant', 'Dominant', 'Tonic substitute', 'Dominant'];

/** Diatonic chords of a key: triads or sevenths, with Roman numerals and function. */
export function diatonicChords(tonic, scaleId = 'major', { sevenths = false } = {}) {
  const notes = scaleNotes(tonic, scaleId);
  const n = notes.length;
  if (n !== 7) return [];
  return notes.map((root, i) => {
    // Stack thirds from the scale, moving notes that wrap past the top of the scale up an octave.
    const fixed = [0, 2, 4, 6].slice(0, sevenths ? 4 : 3).map(k => { const x = notes[(i + k) % n]; return { ...x, oct: x.oct + Math.floor((i + k) / n) }; });
    const ints = fixed.map(x => intervalBetween(fixed[0], x));
    const q = Object.entries(CHORDS).find(([, d]) => d.steps.length === ints.length && d.steps.every((s, j) => s === ints[j]))?.[0];
    const minorish = q !== undefined && /^(m|dim|m7|m7b5|dim7|mMaj7)$/.test(q);
    let numeral = ROMAN[i];
    if (minorish) numeral = numeral.toLowerCase();
    if (q === 'dim') numeral += '°';
    else if (q === 'aug') numeral += '+';
    else if (q === 'm7b5') numeral += 'ø7';
    else if (q === 'dim7') numeral += '°7';
    else if (q === 'maj7') numeral += 'maj7';
    else if (q === '7' || q === 'm7') numeral += '7';
    else if (q === 'mMaj7') numeral += '(maj7)';
    else if (q === 'aug7' || q === 'augMaj7') numeral += '+7';
    return { degree: i + 1, numeral, root, quality: q ?? '?', symbol: `${noteName(root)}${q ?? ''}`, notes: fixed, function: scaleId === 'major' || scaleId === 'natural-minor' || scaleId === 'harmonic-minor' ? FUNCTION[i] : '' };
  });
}

/** Chords for a progression written in Roman numerals ("ii V I", "I V vi IV", "i bVI bIII bVII"). */
export function progression(tonic, numerals, { sevenths = false } = {}) {
  const t = typeof tonic === 'string' ? parseNote(tonic) : tonic;
  const tokens = String(numerals).trim().split(/[\s–—-]+/).filter(Boolean);
  return tokens.map(tok => {
    const m = tok.match(/^(b|♭|#|♯)?(VII|VI|V|IV|III|II|I|vii|vi|v|iv|iii|ii|i)(°|o|ø|\+)?(maj7|7)?$/);
    if (!m) return { numeral: tok, error: true };
    const deg = ROMAN.indexOf(m[2].toUpperCase());
    const upper = m[2] === m[2].toUpperCase();
    let root = transpose(t, ['P1', 'M2', 'M3', 'P4', 'P5', 'M6', 'M7'][deg]);
    if (m[1] === 'b' || m[1] === '♭') root = { ...root, acc: root.acc - 1 };
    if (m[1] === '#' || m[1] === '♯') root = { ...root, acc: root.acc + 1 };
    let q = upper ? '' : 'm';
    if (m[3] === '°' || m[3] === 'o') q = m[4] === '7' ? 'dim7' : 'dim';
    else if (m[3] === 'ø') q = 'm7b5';
    else if (m[3] === '+') q = 'aug';
    else if (m[4] === 'maj7') q = upper ? 'maj7' : 'mMaj7';
    else if (m[4] === '7' || sevenths) q = upper ? (m[4] === '7' || deg === 4 ? '7' : 'maj7') : 'm7';
    return { numeral: tok, root, quality: q, symbol: `${noteName(root)}${q}`, notes: chordNotes(root, q) };
  });
}

/* ---------------- rhythm ---------------- */

export const NOTE_VALUES = [
  { id: 'whole', us: 'Whole note', uk: 'Semibreve', beats: 4 },
  { id: 'half', us: 'Half note', uk: 'Minim', beats: 2 },
  { id: 'quarter', us: 'Quarter note', uk: 'Crotchet', beats: 1 },
  { id: 'eighth', us: 'Eighth note', uk: 'Quaver', beats: 0.5 },
  { id: 'sixteenth', us: 'Sixteenth note', uk: 'Semiquaver', beats: 0.25 },
  { id: 'thirty-second', us: 'Thirty-second note', uk: 'Demisemiquaver', beats: 0.125 },
  { id: 'sixty-fourth', us: 'Sixty-fourth note', uk: 'Hemidemisemiquaver', beats: 0.0625 },
];

/** Describes a time signature: "6/8" → compound duple. */
export function describeMeter(text) {
  const m = String(text).match(/^(\d+)\s*\/\s*(\d+)$/);
  if (!m) return null;
  const top = Number(m[1]), bottom = Number(m[2]);
  const unit = { 1: 'whole note', 2: 'half note', 4: 'quarter note', 8: 'eighth note', 16: 'sixteenth note' }[bottom] || `1/${bottom} note`;
  const beatUnit = { 4: 'half note', 8: 'quarter note', 16: 'eighth note' }[bottom] || 'beat';
  const compound = top % 3 === 0 && top > 3 && bottom >= 8;
  const beats = compound ? top / 3 : top;
  const kind = { 2: 'duple', 3: 'triple', 4: 'quadruple' }[beats] || (beats === 1 ? 'single' : 'irregular (asymmetric)');
  return {
    meter: `${top}/${bottom}`, simple: !compound, beats, kind,
    text: compound
      ? `Compound ${kind}: ${beats} beats in a bar, each a dotted ${beatUnit} split into three ${unit}s.`
      : kind.startsWith('irregular')
        ? `Irregular: ${top} ${unit}s grouped unevenly (for example ${top === 5 ? '3+2 or 2+3' : top === 7 ? '2+2+3 or 3+2+2' : 'in 2s and 3s'}).`
        : `Simple ${kind}: ${top} ${unit} beats in a bar, each split into two.`,
  };
}

/* ---------------- tuning ---------------- */

export const cents = (ratio) => 1200 * Math.log2(ratio);

/** The first n harmonics of a fundamental, with the nearest equal-tempered note and its error. */
export function harmonicSeries(fundamental = 'C2', n = 16) {
  const f = typeof fundamental === 'string' ? parseNote(fundamental) : fundamental;
  const base = midi(f);
  return Array.from({ length: n }, (_, i) => {
    const h = i + 1, exact = base + 12 * Math.log2(h), nearest = Math.round(exact);
    const note = spellPc(nearest, Math.floor(nearest / 12) - 1);
    return { harmonic: h, hz: +(freq(f) * h).toFixed(2), note: noteName(note, { octave: true }), centsOff: Math.round((exact - nearest) * 100) };
  });
}

/** Just intonation ratios for the major scale and their distance from equal temperament. */
export const JUST_MAJOR = [['P1', 1, 1], ['M2', 9, 8], ['M3', 5, 4], ['P4', 4, 3], ['P5', 3, 2], ['M6', 5, 3], ['M7', 15, 8], ['P8', 2, 1]]
  .map(([id, a, b]) => { const c = cents(a / b); const et = parseInterval(id).semitones * 100; return { id, ratio: `${a}:${b}`, cents: +c.toFixed(1), vsEqual: +(c - et).toFixed(1) }; });

/* ---------------- transposing instruments ---------------- */

export const TRANSPOSING = {
  'B♭ clarinet':  { interval: 'M2', dir: -1, note: 'Sounds a major second lower than written.' },
  'B♭ trumpet':   { interval: 'M2', dir: -1, note: 'Sounds a major second lower than written.' },
  'B♭ tenor saxophone': { interval: 'M9', dir: -1, note: 'Sounds a major ninth lower than written.' },
  'E♭ alto saxophone':  { interval: 'M6', dir: -1, note: 'Sounds a major sixth lower than written.' },
  'E♭ baritone saxophone': { interval: 'M13', dir: -1, note: 'Sounds an octave and a major sixth lower than written.' },
  'F horn':       { interval: 'P5', dir: -1, note: 'Sounds a perfect fifth lower than written.' },
  'A clarinet':   { interval: 'm3', dir: -1, note: 'Sounds a minor third lower than written.' },
  'Guitar':       { interval: 'P8', dir: -1, note: 'Written an octave higher than it sounds.' },
  'Double bass':  { interval: 'P8', dir: -1, note: 'Written an octave higher than it sounds.' },
  'Piccolo':      { interval: 'P8', dir: 1, note: 'Sounds an octave higher than written.' },
};

/** Concert pitch of a written note for a transposing instrument (and back with dir flipped). */
export function writtenToConcert(written, instrument) {
  const t = TRANSPOSING[instrument];
  if (!t) return null;
  const n = typeof written === 'string' ? parseNote(written) : written;
  return transpose(n, t.interval, t.dir);
}
