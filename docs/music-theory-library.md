# Music Theory Library

`#music-theory-library` is a reference and teaching tool. It covers music theory from first notes to expert analysis, world traditions and 25 instrument guides. It has five tabs:

- **Learn**: 20 sections and 108 topics.
- **Instruments**: 25 guides.
- **Roadmaps**: learning paths for theory and for each instrument.
- **Labs**: 15 interactive labs.
- **Glossary**: 181 terms.

A **Beginner / Expert** switch changes the depth of each page. Expert opens the "In depth" sections. The choice is saved in `localStorage['toolbox.music.level']`.

## Files

| Path | What it is |
| --- | --- |
| `js/lib/music/theory.js` | The theory engine. Notes carry a letter, accidental and octave, so everything is spelled correctly (G♯ harmonic minor has F𝄪). It covers intervals, 26 scales, about 37 chord types, chord parsing and naming, keys and signatures, diatonic chords, Roman-numeral progressions, meter, the harmonic series, just intonation and transposing instruments. |
| `js/lib/music/audio.js` | Web Audio piano voice: chords, sequences, progressions, rhythms and a metronome. |
| `js/lib/music/widgets.js` | SVG staff (treble/bass clefs, key signatures, ledger lines), piano, fretboard and circle of fifths. |
| `js/lib/music/library/*.js` | Content. Topic files by area; `instruments-a.js` and `instruments-b.js`; `glossary.js`; `index.js` joins them and provides search. |
| `js/tools/music-theory-library.js` | The tool: views, labs and demos. |
| `css/music-library.css` | Tool styles, plus the Assistant music cards. Classes use the `mtl-` prefix; `ml-` belongs to Mail. |

## Content format

A topic is `{ id, section, title, level (1–4), summary, simple: [blocks], deep: [blocks], related: [ids], demo? }`.

Blocks can be:

- a paragraph string;
- `{list}`, `{steps}`, `{tip}` or `{table: {head, rows}}`;
- `{roadmap: [{stage, items}]}`.

Inline markup:

- `**bold**` and `*italic*`;
- `[[id|text]]` links to a topic or instrument.

An instrument guide covers:

- overview, sound, range and tuning;
- parts;
- how to play (holding and producing a sound, not advanced technique);
- first lessons, practice, common mistakes and care;
- a roadmap from beginner to advanced;
- grades and related topics.

It is written so an instructor can use it as a reference.

## Opening a page from elsewhere

Set `localStorage['toolbox.music.focus']` to one of these, then go to `#music-theory-library`:

- `{ topic }`
- `{ instrument }`
- `{ lab, demo }`
- `{ query }`

## Assistant

There are two tools, in the `music` tool group (`js/lib/assistant/domain-tools.js`):

- `music_library({ query, level })` searches topics, instruments and terms. It returns the text to teach from and shows a card with **Open in library** and related links.
- `music_theory({ action, … })` gives exact answers for: `scale`, `chord`, `identify`, `progression`, `key`, `interval` and `transpose`. The card draws the notes on a staff and keyboard. **Play** plays them, and each key and chord can be tapped.

## Tests

`tests/unit/music-library.test.js` checks:

- the theory engine's spelling;
- that every `[[link]]`, `related` and `topics` reference resolves;
- the Assistant tools.

With `npm run dev`, `/tests/browser/domain-cards.html` renders the Assistant cards.
