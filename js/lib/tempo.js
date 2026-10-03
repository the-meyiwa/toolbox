/* ============================================================
   TOOLBOX — Tempo

   Animations play at the durations they were designed with. An
   earlier version shortened every animation globally; that made the
   motion feel clipped, so these helpers now pass values through
   unchanged. Smoothness comes from animating only transform and
   opacity (compositor work), not from speed.
   ============================================================ */

/** Kept for callers: durations are no longer shortened. */
export const tempoDuration = (ms) => ms;
/** Kept for callers: delays are no longer shortened. */
export const tempoDelay = (ms) => ms;

/** No longer wraps Element.prototype.animate. */
export function installTempo() {}
