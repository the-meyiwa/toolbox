/* Chord & Scale Finder — how to play it, and what is in it.

   Shows the shape on a fretboard and a keyboard, spells out what each
   note is doing, and lists the chords that belong to a key. Every note
   is playable, because seeing a chord and hearing it are different
   kinds of understanding. */

import {
  SHARP_NAMES,
  FLAT_NAMES,
  SCALES,
  CHORDS,
  spellChord,
  spellScale,
  chordsInKey,
  TUNINGS,
  midiToFreq,
} from '../lib/music.js';
import { escapeHtml } from '../lib/biz.js';

export default {
  render(container, { analytics } = {}) {
    const state = {
      mode: 'chord',
      root: 0,
      chord: 'maj',
      scale: 'major',
      tuning: 'guitar-standard',
      flats: false,
    };

    container.innerHTML = `
      <div class="chd">
        <div class="chd-bar">
          <div class="btn-group t3d-seg" id="cd-mode">
            <button class="btn btn-sm is-active" data-mode="chord">Chord</button>
            <button class="btn btn-sm" data-mode="scale">Scale</button>
          </div>
          <select class="tool-select" id="cd-root" aria-label="Root note"></select>
          <select class="tool-select" id="cd-type" aria-label="Type"></select>
          <label class="tool-checkbox"><input type="checkbox" id="cd-flats"> <span>Use flats</span></label>
        </div>

        <div class="chd-title" id="cd-title"></div>
        <div class="chd-notes" id="cd-notes"></div>

        <h3 class="cq-h" style="margin-top:22px;">Keyboard</h3>
        <div class="chd-keys" id="cd-keys"></div>

        <div class="chd-fret-head">
          <h3 class="cq-h">Fretboard</h3>
          <select class="tool-select" id="cd-tuning" aria-label="Tuning">
            ${Object.entries(TUNINGS).filter(([, t]) => t.frets > 0)
              .map(([id, t]) => `<option value="${id}">${t.name}</option>`).join('')}
          </select>
        </div>
        <div class="chd-fret-wrap"><div class="chd-fret" id="cd-fret"></div></div>

        <div id="cd-key-chords"></div>

        <p class="biz-hint">Click any note or key to hear it. Root notes are filled in; the rest are outlined.</p>
      </div>`;

    const $ = (id) => container.querySelector('#' + id);
    let audio = null;

    const names = () => (state.flats ? FLAT_NAMES : SHARP_NAMES);

    function playMidi(midi) {
      audio ??= new (window.AudioContext || window.webkitAudioContext)();
      if (audio.state === 'suspended') audio.resume();
      const now = audio.currentTime;
      const osc = audio.createOscillator();
      const gain = audio.createGain();
      osc.type = 'triangle';
      osc.frequency.value = midiToFreq(midi);
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.exponentialRampToValueAtTime(0.22, now + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.9);
      osc.connect(gain).connect(audio.destination);
      osc.start(now);
      osc.stop(now + 0.95);
    }

    /** Play the current chord or scale as an arpeggio. */
    function playAll(pcs) {
      audio ??= new (window.AudioContext || window.webkitAudioContext)();
      if (audio.state === 'suspended') audio.resume();
      pcs.forEach((pc, i) => {
        setTimeout(() => playMidi(60 + ((pc - state.root + 12) % 12) + (state.root >= 0 ? state.root : 0)), i * 140);
      });
    }

    /* ---------------- selectors ---------------- */

    function fillSelectors() {
      $('cd-root').innerHTML = names().map((n, i) =>
        `<option value="${i}"${i === state.root ? ' selected' : ''}>${n}</option>`).join('');

      $('cd-type').innerHTML = state.mode === 'chord'
        ? Object.entries(CHORDS).map(([id, c]) =>
            `<option value="${id}"${id === state.chord ? ' selected' : ''}>${c.name}</option>`).join('')
        : Object.entries(SCALES).map(([id, s]) =>
            `<option value="${id}"${id === state.scale ? ' selected' : ''}>${s.name}</option>`).join('');
    }

    /* ---------------- rendering ---------------- */

    function current() {
      return state.mode === 'chord'
        ? spellChord(state.root, state.chord, { flats: state.flats })
        : spellScale(state.root, state.scale, { flats: state.flats });
    }

    function render() {
      const notes = current();
      const pcs = notes.map(n => n.pc);
      const rootName = names()[state.root];

      const label = state.mode === 'chord'
        ? `${rootName}${CHORDS[state.chord].suffix}`
        : `${rootName} ${SCALES[state.scale].name}`;

      $('cd-title').innerHTML = `
        <h2>${escapeHtml(label)}</h2>
        <button class="btn btn-sm" id="cd-play">Play</button>`;
      $('cd-play').addEventListener('click', () => playAll(pcs));

      $('cd-notes').innerHTML = notes.map(n => `
        <button class="chd-note${n.pc === state.root ? ' is-root' : ''}" data-pc="${n.pc}">
          <span class="chd-note-name">${escapeHtml(n.name)}</span>
          <span class="chd-note-deg">${escapeHtml(String(n.degree))}</span>
        </button>`).join('');

      renderKeys(pcs);
      renderFretboard(pcs);
      renderKeyChords();
    }

    /** Two octaves of piano, drawn as white keys with blacks overlaid. */
    function renderKeys(pcs) {
      const WHITE = [0, 2, 4, 5, 7, 9, 11];
      const BLACK_AFTER = { 0: 1, 2: 3, 5: 6, 7: 8, 9: 10 };
      let html = '';
      let whiteIndex = 0;

      for (let oct = 0; oct < 2; oct++) {
        for (const pc of WHITE) {
          const on = pcs.includes(pc);
          const midi = 60 + oct * 12 + pc;
          html += `<button class="chd-key chd-key-w${on ? ' is-on' : ''}${pc === state.root && on ? ' is-root' : ''}"
                     style="left:${whiteIndex * 40}px" data-midi="${midi}">
                     <span>${on ? names()[pc] : ''}</span></button>`;

          const black = BLACK_AFTER[pc];
          if (black !== undefined) {
            const bOn = pcs.includes(black);
            html += `<button class="chd-key chd-key-b${bOn ? ' is-on' : ''}${black === state.root && bOn ? ' is-root' : ''}"
                       style="left:${whiteIndex * 40 + 27}px" data-midi="${60 + oct * 12 + black}">
                       <span>${bOn ? names()[black] : ''}</span></button>`;
          }
          whiteIndex++;
        }
      }
      $('cd-keys').innerHTML = `<div class="chd-keys-inner" style="width:${whiteIndex * 40}px">${html}</div>`;
    }

    function renderFretboard(pcs) {
      const t = TUNINGS[state.tuning];
      const FRETS = 15;
      const MARKERS = [3, 5, 7, 9, 12, 15];

      // Strings are drawn high to low, the way a right-handed player sees
      // them looking down at the neck.
      const rows = [...t.strings].reverse().map((open, revIdx) => {
        const cells = Array.from({ length: FRETS + 1 }, (_, fret) => {
          const midi = open + fret;
          const pc = midi % 12;
          const on = pcs.includes(pc);
          const isRoot = pc === state.root;
          return `<div class="chd-cell${fret === 0 ? ' is-open' : ''}">
            ${on ? `<button class="chd-dot${isRoot ? ' is-root' : ''}" data-midi="${midi}">${names()[pc]}</button>` : ''}
          </div>`;
        }).join('');
        return `<div class="chd-string" data-s="${revIdx}">${cells}</div>`;
      }).join('');

      const nums = Array.from({ length: FRETS + 1 }, (_, f) =>
        `<div class="chd-fnum${MARKERS.includes(f) ? ' is-marker' : ''}">${f || ''}</div>`).join('');

      $('cd-fret').innerHTML = `<div class="chd-fret-inner">${rows}<div class="chd-fnums">${nums}</div></div>`;
    }

    function renderKeyChords() {
      if (state.mode !== 'scale' || SCALES[state.scale].steps.length !== 7) {
        $('cd-key-chords').innerHTML = '';
        return;
      }
      const chords = chordsInKey(state.root, state.scale, { flats: state.flats });
      $('cd-key-chords').innerHTML = `
        <h3 class="cq-h" style="margin-top:24px;">Chords in this key</h3>
        <div class="chd-key-chords">
          ${chords.map(c => `
            <button class="chd-kc" data-pcs="${c.pcs.join(',')}">
              <span class="chd-kc-num">${escapeHtml(c.numeral)}</span>
              <span class="chd-kc-sym">${escapeHtml(c.symbol)}</span>
              <span class="chd-kc-q">${c.quality}</span>
            </button>`).join('')}
        </div>
        <p class="biz-hint">These are the triads that fit without borrowing from another key.</p>`;
    }

    /* ---------------- events ---------------- */

    container.addEventListener('click', (e) => {
      const dot = e.target.closest('[data-midi]');
      if (dot) { playMidi(Number(dot.dataset.midi)); return; }

      const note = e.target.closest('[data-pc]');
      if (note) { playMidi(60 + Number(note.dataset.pc)); return; }

      const kc = e.target.closest('[data-pcs]');
      if (kc) {
        const pcs = kc.dataset.pcs.split(',').map(Number);
        pcs.forEach((pc, i) => setTimeout(() => playMidi(60 + pc), i * 90));
      }
    });

    $('cd-mode').addEventListener('click', (e) => {
      const b = e.target.closest('[data-mode]');
      if (!b) return;
      for (const x of container.querySelectorAll('#cd-mode .btn')) x.classList.toggle('is-active', x === b);
      state.mode = b.dataset.mode;
      fillSelectors();
      render();
    });

    $('cd-root').addEventListener('change', (e) => { state.root = Number(e.target.value); render(); });
    $('cd-type').addEventListener('change', (e) => {
      if (state.mode === 'chord') state.chord = e.target.value; else state.scale = e.target.value;
      render();
      analytics?.completed({ resultCount: 1 });
    });
    $('cd-flats').addEventListener('change', (e) => { state.flats = e.target.checked; fillSelectors(); render(); });
    $('cd-tuning').addEventListener('change', (e) => { state.tuning = e.target.value; render(); });

    fillSelectors();
    render();
    analytics?.started();

    this._close = () => audio?.close?.();
  },

  destroy() { this._close?.(); },
};
