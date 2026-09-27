/* ============================================================
   Morse Code — translate both ways (it works out which way you
   mean) and play the result as sound, at a chosen speed and pitch.
   ============================================================ */

import { makeTextTool } from '../lib/kit/text-tool.js';
import { toMorse, fromMorse, looksLikeMorse, morseTimings } from '../lib/transforms/text-ops.js';

let audio = null;

function play(code, wpm, pitch, button) {
  stop();
  const Ctx = globalThis.AudioContext || globalThis.webkitAudioContext;
  if (!Ctx || !code.trim()) return;
  const ctx = new Ctx();
  const unit = 1.2 / Math.max(5, Math.min(40, wpm));
  const osc = ctx.createOscillator(); const gain = ctx.createGain();
  osc.frequency.value = pitch; osc.type = 'sine'; gain.gain.value = 0;
  osc.connect(gain).connect(ctx.destination);
  let t = ctx.currentTime + 0.05;
  for (const [on, units] of morseTimings(code)) {
    if (on) { gain.gain.setTargetAtTime(0.5, t, 0.004); gain.gain.setTargetAtTime(0, t + units * unit, 0.004); }
    t += units * unit;
  }
  osc.start(); osc.stop(t + 0.1);
  audio = { ctx, button };
  button.textContent = 'Stop';
  osc.onended = () => stop();
}

function stop() {
  if (!audio) return;
  const { ctx, button } = audio; audio = null;
  ctx.close().catch(() => {});
  if (button) button.textContent = 'Play sound';
}

const tool = makeTextTool({
  id: 'morse-code',
  produces: ['text'],
  sample: 'SOS — meet at dawn',
  fields: [
    { key: 'dir', label: 'Direction', type: 'seg', options: [['auto', 'Detect'], ['to', 'Text → Morse'], ['from', 'Morse → Text']], value: 'auto' },
    { key: 'wpm', label: 'Speed', type: 'range', min: 5, max: 40, value: 18, unit: ' wpm' },
    { key: 'pitch', label: 'Pitch', type: 'range', min: 300, max: 1000, step: 10, value: 600, unit: ' Hz' },
  ],
  run(input, v) {
    const toText = v.dir === 'from' || (v.dir === 'auto' && looksLikeMorse(input));
    return { text: toText ? fromMorse(input) : toMorse(input), stats: [['direction', toText ? 'Morse → text' : 'text → Morse']] };
  },
  mounted(container, api) {
    const bar = container.querySelector('.kit-pane:last-child .kit-pane-actions');
    const btn = document.createElement('button');
    btn.type = 'button'; btn.className = 'btn btn-primary btn-sm'; btn.textContent = 'Play sound';
    bar.prepend(btn);
    btn.addEventListener('click', () => {
      if (audio) return stop();
      const input = api.input.value;
      const code = looksLikeMorse(input) ? input : toMorse(input);
      play(code, api.values.wpm, api.values.pitch, btn);
    });
  },
});

const destroy = tool.destroy;
tool.destroy = function () { stop(); destroy.call(this); };
export default tool;
