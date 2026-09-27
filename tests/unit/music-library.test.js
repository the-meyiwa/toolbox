/* ============================================================
   Music Theory Library: the theory engine spells correctly, every
   cross-reference in the library resolves, and the Assistant's
   music tools answer from it.
   ============================================================ */

import test from 'node:test';
import assert from 'node:assert/strict';

const T = await import('../../js/lib/music/theory.js');
const L = await import('../../js/lib/music/library/index.js');
const { executeDomainTool } = await import('../../js/lib/assistant/domain-tools.js');
const names = (list) => list.map(n => T.noteName(n)).join(' ');

test('scales are spelled with one of each letter', () => {
  assert.equal(names(T.scaleNotes('F4', 'major')), 'F G A B♭ C D E');
  assert.equal(names(T.scaleNotes('G#4', 'harmonic-minor')), 'G♯ A♯ B C♯ D♯ E F𝄪');
  assert.equal(names(T.scaleNotes('D4', 'dorian')), 'D E F G A B C');
  assert.equal(names(T.scaleNotes('Eb4', 'natural-minor')), 'E♭ F G♭ A♭ B♭ C♭ D♭');
});

test('chords, chord naming and progressions', () => {
  assert.equal(names(T.chordNotes('Bbmaj7')), 'B♭ D F A');
  assert.equal(names(T.chordNotes('F#m7b5')), 'F♯ A C E');
  assert.equal(T.identifyChord(['G3', 'B3', 'D4', 'F4'].map(T.parseNote))[0].symbol, 'G7');
  assert.equal(T.identifyChord(['E3', 'G3', 'C4'].map(T.parseNote))[0].symbol, 'C/E');
  assert.deepEqual(T.progression('C4', 'ii V I', { sevenths: true }).map(c => c.symbol), ['Dm7', 'G7', 'Cmaj7']);
  assert.deepEqual(T.diatonicChords('C4').map(c => c.numeral), ['I', 'ii', 'iii', 'IV', 'V', 'vi', 'vii°']);
});

test('keys and intervals', () => {
  assert.equal(T.keySignature('A', 'minor').fifths, 0);
  assert.equal(T.keySignature('Eb').fifths, -3);
  assert.equal(T.intervalBetween(T.parseNote('C4'), T.parseNote('F#4')), 'A4');
  assert.equal(T.noteName(T.transpose(T.parseNote('E4'), 'M3')), 'G♯');
});

test('every library cross-reference resolves', () => {
  const ids = [];
  const scan = (v) => {
    if (typeof v === 'string') for (const m of v.matchAll(/\[\[([a-z0-9-]+)\|/g)) ids.push(m[1]);
    else if (Array.isArray(v)) v.forEach(scan);
    else if (v && typeof v === 'object') Object.values(v).forEach(scan);
  };
  scan(L.TOPICS); scan(L.INSTRUMENTS); scan(L.GLOSSARY);
  for (const t of L.TOPICS) ids.push(...(t.related || []));
  for (const i of L.INSTRUMENTS) ids.push(...(i.topics || []));
  const missing = [...new Set(ids)].filter(id => !L.resolveId(id));
  assert.deepEqual(missing, []);
  for (const t of L.TOPICS) assert.ok(L.SECTIONS.some(s => s.id === t.section), `${t.id} has a real section`);
  assert.ok(L.TOPICS.length >= 100 && L.INSTRUMENTS.length >= 25 && L.GLOSSARY.length >= 150);
});

test('Assistant music tools', async () => {
  const lib = await executeDomainTool('music_library', { query: 'how to play violin' });
  assert.equal(lib.kind, 'instrument');
  assert.equal(lib.open.instrument, 'violin');
  const topic = await executeDomainTool('music_library', { query: 'Dorian mode' });
  assert.equal(topic.id, 'modes');
  const chord = await executeDomainTool('music_theory', { action: 'identify', notes: ['E', 'G', 'C'] });
  assert.equal(chord.title, 'C/E');
  const key = await executeDomainTool('music_theory', { action: 'key', tonic: 'D' });
  assert.equal(key.relative, 'B minor');
  const bad = await executeDomainTool('music_theory', { action: 'chord', chord: 'H7' });
  assert.equal(bad.status, 'error');
});
