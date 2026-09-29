/* ============================================================
   Music Library sound: a light Web Audio piano-like voice for
   playing notes, chords, arpeggios, scales and rhythms. One shared
   AudioContext, created on the first user gesture.
   ============================================================ */

let ctx = null, master = null;
const active = new Set();

function audio() {
  if (!ctx) {
    const AC = globalThis.AudioContext || globalThis.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    master = ctx.createDynamicsCompressor();
    master.threshold.value = -14; master.ratio.value = 3;
    const out = ctx.createGain(); out.gain.value = 0.7;
    master.connect(out).connect(ctx.destination);
  }
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}

const hz = (midi) => 440 * 2 ** ((midi - 69) / 12);

/** One note: a few partials with a quick attack and a piano-like decay. */
function voice(midi, when, dur, vel = 0.8) {
  const ac = ctx;
  const f = hz(midi);
  const gain = ac.createGain();
  const filter = ac.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.setValueAtTime(Math.min(12000, f * 9), when);
  filter.frequency.exponentialRampToValueAtTime(Math.max(400, f * 2.5), when + Math.min(dur, 1.6));
  const peak = 0.22 * vel;
  gain.gain.setValueAtTime(0.0001, when);
  gain.gain.exponentialRampToValueAtTime(peak, when + 0.008);
  gain.gain.exponentialRampToValueAtTime(peak * 0.45, when + 0.25);
  gain.gain.exponentialRampToValueAtTime(0.0001, when + dur + 0.35);
  gain.connect(filter).connect(master);
  const partials = [[1, 1], [2, 0.42], [3, 0.2], [4, 0.1], [5, 0.05]];
  const oscs = partials.map(([k, a]) => {
    const o = ac.createOscillator();
    o.type = k === 1 ? 'triangle' : 'sine';
    o.frequency.value = f * k * (1 + (k - 1) * 0.0007); // slight string stiffness
    const g = ac.createGain(); g.gain.value = a;
    o.connect(g).connect(gain);
    o.start(when); o.stop(when + dur + 0.4);
    return o;
  });
  const handle = { oscs, gain };
  active.add(handle);
  oscs[0].onended = () => active.delete(handle);
}

/** Stop everything that is sounding. */
export function stopAll() {
  if (!ctx) return;
  const now = ctx.currentTime;
  for (const h of active) { try { h.gain.gain.cancelScheduledValues(now); h.gain.gain.setTargetAtTime(0.0001, now, 0.02); h.oscs.forEach(o => o.stop(now + 0.1)); } catch { /* already stopped */ } }
  active.clear();
}

/** Play MIDI notes together (a chord). */
export function playChord(midis, { dur = 1.6 } = {}) {
  if (!audio()) return;
  const t = ctx.currentTime + 0.03;
  midis.forEach(m => voice(m, t, dur, 0.7));
}

/** Play MIDI notes one after another (scale, arpeggio, melody). Returns total seconds.
    onNote(i) is called as note i sounds, so the page can light it up in time. */
export function playSequence(midis, { tempo = 132, gap = 1, hold = 0.9, then = null, onNote = null } = {}) {
  if (!audio()) return 0;
  const step = (60 / tempo) * gap;
  const t = ctx.currentTime + 0.03;
  midis.forEach((m, i) => (Array.isArray(m) ? m : [m]).forEach(n => voice(n, t + i * step, step * hold, 0.8)));
  if (onNote) midis.forEach((_, i) => setTimeout(() => onNote(i, step), (0.03 + i * step) * 1000));
  if (then) setTimeout(then, (midis.length * step + 0.3) * 1000);
  return midis.length * step;
}

/** Arpeggio then chord. */
export function playArpeggioChord(midis, opts = {}) {
  const secs = playSequence(midis, { tempo: 220, ...opts });
  if (!ctx) return;
  setTimeout(() => playChord(midis), secs * 1000);
}

/** Play a progression: each entry is an array of MIDI notes. */
export function playProgression(chords, { tempo = 80, beatsEach = 2, onChord } = {}) {
  if (!audio()) return;
  const dur = (60 / tempo) * beatsEach;
  const t = ctx.currentTime + 0.05;
  chords.forEach((c, i) => {
    c.forEach(m => voice(m, t + i * dur, dur * 0.95, 0.6));
    if (onChord) setTimeout(() => onChord(i), (i * dur + 0.05) * 1000);
  });
  if (onChord) setTimeout(() => onChord(-1), (chords.length * dur + 0.1) * 1000);
}

/** A short click (metronome, rhythm demos). accent: louder, higher. */
function click(when, accent = false, pitch = null) {
  const o = ctx.createOscillator(), g = ctx.createGain();
  o.type = 'square';
  o.frequency.value = pitch || (accent ? 1760 : 1175);
  g.gain.setValueAtTime(accent ? 0.28 : 0.16, when);
  g.gain.exponentialRampToValueAtTime(0.0001, when + 0.05);
  o.connect(g).connect(master);
  o.start(when); o.stop(when + 0.06);
}

/**
 * Plays rhythm layers for `bars` bars. layers: [{ pulses, pitch, accents: Set of pulse indexes }]
 * each layer divides the bar evenly into `pulses` (3 against 2, clave patterns via `hits`).
 */
export function playRhythm(layers, { tempo = 90, beatsPerBar = 4, bars = 2, onHit = null } = {}) {
  if (!audio()) return 0;
  const barSecs = (60 / tempo) * beatsPerBar;
  const t = ctx.currentTime + 0.05;
  for (let b = 0; b < bars; b++) {
    layers.forEach((L, li) => {
      const hits = L.hits || Array.from({ length: L.pulses }, (_, i) => i);
      for (const i of hits) {
        const at = b * barSecs + (i / L.pulses) * barSecs;
        click(t + at, L.accents?.has?.(i) ?? i === 0, L.pitch);
        // onHit(layer, pulse, bar) as each click sounds.
        if (onHit) setTimeout(() => onHit(li, i, b), (0.05 + at) * 1000);
      }
    });
  }
  return bars * barSecs;
}

/* ---------------- metronome ---------------- */

let metro = null;
/** Start a metronome; returns a stop function. */
export function metronome({ tempo = 90, beats = 4, onBeat } = {}) {
  if (!audio()) return () => {};
  metro?.stop();
  let next = ctx.currentTime + 0.06, beat = 0, stopped = false;
  const tick = () => {
    if (stopped) return;
    while (next < ctx.currentTime + 0.12) {
      click(next, beat % beats === 0);
      const b = beat % beats;
      if (onBeat) setTimeout(() => !stopped && onBeat(b), Math.max(0, (next - ctx.currentTime) * 1000));
      next += 60 / tempo; beat++;
    }
    metro.timer = setTimeout(tick, 25);
  };
  metro = { stop: () => { stopped = true; clearTimeout(metro?.timer); metro = null; } };
  tick();
  return metro.stop;
}

export const isPlayable = () => Boolean(globalThis.AudioContext || globalThis.webkitAudioContext);
