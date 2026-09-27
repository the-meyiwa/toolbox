/* ============================================================
   Music Theory Library — content index and search.

   Topic: { id, section, title, level (1 beginner – 4 expert), summary,
            simple: [blocks], deep: [blocks], related: [ids] }
   Instrument: { id, name, family, overview, sound, range, tuning, parts,
            howToPlay, firstLessons, practice, mistakes, care, roadmap, topics }
   Blocks: 'paragraph' | { list } | { steps } | { table: { head, rows } }
           | { tip } | { example: demo } | { roadmap: [{ stage, items }] }
   Inline text: **bold**, *italic*, [[topic-id|link text]].
   ============================================================ */

import foundations from './foundations.js';
import pitch from './pitch.js';
import harmony from './harmony.js';
import form from './form.js';
import styles from './styles.js';
import advanced from './advanced.js';
import musicianship from './musicianship.js';
import instrumentsA from './instruments-a.js';
import instrumentsB from './instruments-b.js';
import glossary from './glossary.js';

export const SECTIONS = [
  { id: 'foundations', title: 'Foundations', blurb: 'Sound, pitch, note names and what music is made of.' },
  { id: 'notation', title: 'Reading and notation', blurb: 'Staff, clefs, accidentals, marks and charts.' },
  { id: 'rhythm', title: 'Rhythm and meter', blurb: 'Beat, note values, time signatures, syncopation, polyrhythm.' },
  { id: 'intervals', title: 'Intervals', blurb: 'The distances between notes, and how they sound.' },
  { id: 'scales', title: 'Scales and modes', blurb: 'Major, minor, modes, pentatonic, symmetric and world scales.' },
  { id: 'keys', title: 'Keys', blurb: 'Key signatures, the circle of fifths, related keys.' },
  { id: 'chords', title: 'Chords', blurb: 'Triads to altered dominants, symbols and voicings.' },
  { id: 'harmony', title: 'Harmony', blurb: 'Function, cadences, progressions, chromatic harmony, counterpoint.' },
  { id: 'melody', title: 'Melody and phrasing', blurb: 'Contour, motifs, phrases and periods.' },
  { id: 'form', title: 'Form and texture', blurb: 'How pieces are built, from songs to sonatas.' },
  { id: 'composition', title: 'Composition and production', blurb: 'Songwriting, arranging, film music and producing.' },
  { id: 'jazz', title: 'Jazz', blurb: 'ii–V–I, chord–scale theory, reharmonisation, bebop and modal jazz.' },
  { id: 'styles', title: 'Styles', blurb: 'Blues, rock and pop, gospel and R&B, modern genres.' },
  { id: 'world', title: 'World traditions', blurb: 'African, Latin, Indian, Arabic, Indonesian, East Asian and flamenco.' },
  { id: 'modern', title: '20th century and beyond', blurb: 'Impressionism, atonality, serialism, minimalism.' },
  { id: 'acoustics', title: 'Tuning and acoustics', blurb: 'Harmonics, timbre, temperaments and microtones.' },
  { id: 'musicianship', title: 'Musicianship', blurb: 'Ear training, solfège, practice and improvisation.' },
  { id: 'instruments', title: 'Instruments (general)', blurb: 'Families, ranges and transposition.' },
  { id: 'history', title: 'History', blurb: 'From chant to Afrobeats.' },
  { id: 'roadmaps', title: 'Roadmaps', blurb: 'Where to start and what to learn next.' },
];

export const LEVELS = { 1: 'Beginner', 2: 'Intermediate', 3: 'Advanced', 4: 'Expert' };

export const TOPICS = [...foundations, ...pitch, ...harmony, ...form, ...styles, ...advanced, ...musicianship];
export const INSTRUMENTS = [...instrumentsA, ...instrumentsB];
export const GLOSSARY = glossary.map(([term, def, topic]) => ({ term, def, topic }));

const TOPIC = new Map(TOPICS.map(t => [t.id, t]));
const INSTRUMENT = new Map(INSTRUMENTS.map(i => [i.id, i]));

export const getTopic = (id) => TOPIC.get(id) || null;
export const getInstrument = (id) => INSTRUMENT.get(id) || null;
/** A topic or an instrument, whichever the id names. */
export const resolveId = (id) => (TOPIC.has(id) ? { kind: 'topic', item: TOPIC.get(id) } : INSTRUMENT.has(id) ? { kind: 'instrument', item: INSTRUMENT.get(id) } : null);
export const topicsIn = (section) => TOPICS.filter(t => t.section === section);

/** Plain text of a block list (for search and the Assistant). */
export function blocksText(blocks = []) {
  return blocks.map(b => {
    if (typeof b === 'string') return b;
    if (b.list) return b.list.join(' ');
    if (b.steps) return b.steps.join(' ');
    if (b.tip) return b.tip;
    if (b.table) return [b.table.head.join(' '), ...b.table.rows.map(r => r.join(' '))].join(' ');
    if (b.roadmap) return b.roadmap.map(s => `${s.stage}: ${s.items.join(', ')}`).join(' ');
    return '';
  }).join(' ').replace(/\[\[[a-z0-9-]+\|([^\]]+)\]\]/g, '$1').replace(/\*\*?([^*]+)\*\*?/g, '$1');
}

export function instrumentText(i) {
  return [i.overview, i.sound, i.range, i.tuning, ...(i.howToPlay || []).map(h => `${h.h}: ${h.text}`), ...(i.firstLessons || []), ...(i.roadmap || []).map(r => `${r.stage}: ${r.goals.join(', ')}`)].join(' ').replace(/\*\*?([^*]+)\*\*?/g, '$1');
}

const norm = (s) => String(s || '').toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/♯/g, '#').replace(/♭/g, 'b');
let index = null;
function buildIndex() {
  index = [
    ...TOPICS.map(t => ({ kind: 'topic', id: t.id, title: t.title, head: norm(`${t.title} ${t.summary}`), body: norm(`${blocksText(t.simple)} ${blocksText(t.deep)}`) })),
    ...INSTRUMENTS.map(i => ({ kind: 'instrument', id: i.id, title: i.name, head: norm(`${i.name} ${i.family} how to play ${i.name} roadmap`), body: norm(instrumentText(i)) })),
    ...GLOSSARY.map((g, n) => ({ kind: 'term', id: `term-${n}`, title: g.term, head: norm(g.term), body: norm(g.def), topic: g.topic, def: g.def })),
  ];
}

/** Ranked search over topics, instruments and glossary terms. */
export function searchLibrary(query, { limit = 20 } = {}) {
  if (!index) buildIndex();
  const words = norm(query).split(/[^a-z0-9#]+/).filter(w => w.length > 1 && !['the', 'and', 'what', 'how', 'is', 'a', 'of', 'to', 'in', 'do', 'i', 'on'].includes(w));
  if (!words.length) return [];
  const phrase = norm(query).trim();
  return index.map(e => {
    let s = 0;
    if (norm(e.title) === phrase) s += 20;
    if (e.head.includes(phrase)) s += 8;
    for (const w of words) {
      if (norm(e.title).split(/\s+/).some(t => t.startsWith(w))) s += 5;
      else if (e.head.includes(w)) s += 3;
      else if (e.body.includes(w)) s += 1;
    }
    if (e.kind === 'term') s *= 0.8;
    return { ...e, score: s };
  }).filter(e => e.score >= Math.min(3, words.length * 2)).sort((a, b) => b.score - a.score).slice(0, limit);
}
