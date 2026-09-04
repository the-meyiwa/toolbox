/* ============================================================
   Music Theory & Audio Unit Tests
   ============================================================ */

import test from 'node:test';
import assert from 'node:assert/strict';
import { midiToFreq, freqToMidi, midiToName, nameToMidi, analysePitch, spellChord, spellScale, chordsInKey, noteMs, tempoMark, TUNINGS } from '../../js/lib/music.js';

test('Music: pitch conversions (A4 = 440 Hz)', () => {
  // A4 is MIDI 69
  assert.equal(midiToFreq(69), 440);
  assert.equal(freqToMidi(440), 69);

  // C4 is MIDI 60 -> ~261.63 Hz
  const c4Freq = midiToFreq(60);
  assert.ok(Math.abs(c4Freq - 261.63) < 0.1);

  // Note naming
  assert.deepEqual(midiToName(69), { name: 'A', octave: 4 });
  assert.deepEqual(midiToName(60), { name: 'C', octave: 4 });
  assert.deepEqual(midiToName(61, { flats: true }), { name: 'D♭', octave: 4 });
  assert.deepEqual(midiToName(61, { flats: false }), { name: 'C♯', octave: 4 });
});

test('Music: nameToMidi parses note strings', () => {
  assert.equal(nameToMidi('A4'), 69);
  assert.equal(nameToMidi('C4'), 60);
  assert.equal(nameToMidi('C#4'), 61);
  assert.equal(nameToMidi('Db4'), 61);
  assert.equal(nameToMidi('E2'), 40);
});

test('Music: analysePitch detects nearest note and cents offset', () => {
  // Exact 440Hz -> A4, 0 cents
  const a4 = analysePitch(440);
  assert.equal(a4.name, 'A');
  assert.equal(a4.octave, 4);
  assert.equal(a4.cents, 0);

  // Slightly sharp: 445Hz -> A4 with positive cents
  const sharp = analysePitch(445);
  assert.equal(sharp.name, 'A');
  assert.ok(sharp.cents > 0);
});

test('Music: spellChord generates correct pitch classes and interval degrees', () => {
  // C Major: C (0), E (4), G (7)
  const cMaj = spellChord(0, 'maj');
  assert.deepEqual(cMaj.map(n => n.name), ['C', 'E', 'G']);
  assert.deepEqual(cMaj.map(n => n.degree), ['root', '3', '5']);

  // A Minor: A (9), C (0), E (4)
  const aMin = spellChord(9, 'min');
  assert.deepEqual(aMin.map(n => n.name), ['A', 'C', 'E']);
  assert.deepEqual(aMin.map(n => n.degree), ['root', '♭3', '5']);
});

test('Music: chordsInKey generates diatonic triads', () => {
  // C Major scale: C (I), Dm (ii), Em (iii), F (IV), G (V), Am (vi), Bdim (vii°)
  const chords = chordsInKey(0, 'major');
  assert.equal(chords.length, 7);
  assert.equal(chords[0].symbol, 'C');
  assert.equal(chords[1].symbol, 'Dm');
  assert.equal(chords[2].symbol, 'Em');
  assert.equal(chords[3].symbol, 'F');
  assert.equal(chords[4].symbol, 'G');
  assert.equal(chords[5].symbol, 'Am');
  assert.equal(chords[6].symbol, 'Bdim');
});

test('Music: tempo and delay time calculations', () => {
  // 120 BPM: 1 beat = 500ms
  const quarter120 = noteMs(120, 1);
  assert.equal(quarter120.straight, 500);
  assert.equal(quarter120.dotted, 750);
  assert.ok(Math.abs(quarter120.triplet - 333.33) < 0.1);

  assert.equal(tempoMark(120), 'Moderato');
  assert.equal(tempoMark(140), 'Allegro');
});

test('Music: standard guitar tuning matches known pitch values', () => {
  const guitar = TUNINGS['guitar-standard'];
  assert.deepEqual(guitar.strings, [40, 45, 50, 55, 59, 64]); // E2, A2, D3, G3, B3, E4
});
