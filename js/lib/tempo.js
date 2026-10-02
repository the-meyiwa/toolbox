/* ============================================================
   TOOLBOX — Tempo

   One speed for the whole app, set to how Settings moves on a phone:
   things settle in about a fifth of a second and lists arrive almost
   together. Every script animation (element.animate) passes through
   here, so a 640ms flourish written anywhere plays in under 300ms, and
   staggers shrink so a cascade never makes people wait.

   Left alone: endless loops (spinners, shimmer), long ambient motion
   (1.6s or more), and any call that opts out with { tempo: false }.
   The stylesheets were tuned to the same curve (the duration tokens in
   css/tokens.css and the timings in each stylesheet).
   ============================================================ */

/** Shortened duration: quick things stay quick, long ones are pulled in hard. */
export const tempoDuration = (ms) => (ms <= 180 ? ms : Math.round(180 + (ms - 180) * 0.28));
/** Shortened delay: cascades stay ordered but nearly simultaneous. */
export const tempoDelay = (ms) => Math.round(Math.min(ms * 0.35, 220));

export function installTempo() {
  if (typeof Element === 'undefined' || !Element.prototype.animate || Element.prototype.animate.__tempo) return;
  const native = Element.prototype.animate;
  const tuned = function animate(keyframes, options) {
    if (options && typeof options === 'object' && options.tempo !== false) {
      const d = Number(options.duration);
      const loops = options.iterations === Infinity || options.iterations > 1;
      if (!loops && Number.isFinite(d) && d < 1600) {
        options = { ...options, duration: tempoDuration(d), ...(options.delay ? { delay: tempoDelay(Number(options.delay) || 0) } : {}) };
      }
    } else if (typeof options === 'number' && options < 1600) {
      options = tempoDuration(options);
    }
    return native.call(this, keyframes, options);
  };
  tuned.__tempo = true;
  Element.prototype.animate = tuned;
}

// Installed as soon as this module loads, before any other module can animate.
installTempo();
