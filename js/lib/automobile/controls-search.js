/* ============================================================
   Controls search — turns a plain description ("button on the
   door", "orange light that looks like an engine", "lever on
   the right", "the handle for the landing gear") into a cluster
   of controls and, when one clearly stands out, a control.
   Shared by every vehicle's controls library.

   Clusters may set `lamps: true` (a panel of warning lights) and
   `stalk: 'left' | 'right'` (a lever beside the wheel); the
   Corolla's ids `cluster`, `light-stalk` and `wiper-stalk` imply
   them.
   ============================================================ */

export const allControls = (cl) => cl.rows.flat();

const BASE_STOP = 'the a an of my on in at to for is it what whats what\'s this that there these those do does and or with button buttons switch switches thing one mean means used use why how can i me some little small near next'.split(' ');
const words = (s) => (String(s || '').toLowerCase().replace(/[’']/g, '').match(/[a-z0-9/]+/g) || []);

export function makeFinder(CLUSTERS, { stop = [] } = {}) {
  const STOP = new Set([...BASE_STOP, ...stop]);
  const isLamps = (cl) => cl.lamps === true || cl.id === 'cluster';
  const stalkSide = (cl) => cl.stalk || (cl.id === 'wiper-stalk' ? 'right' : cl.id === 'light-stalk' ? 'left' : null);
  return function findControls(query) {
    const q = String(query || '').toLowerCase();
    const qw = words(q).filter(w => !STOP.has(w));
    if (!qw.length) return null;
    const has = (a) => new RegExp(`(^|[^a-z0-9])${a.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&')}([^a-z0-9]|$)`).test(q);
    const phraseHit = (list) => list.reduce((s, a) => s + (a.length > 1 && has(a) ? (a.includes(' ') ? 4 : 2.5) : 0), 0);
    // Intent: "light / symbol on the dash" means a lamp; "button / switch" means something you press;
    // "lever / stalk on the left / right" means that stalk.
    const wantsLamp = /\b(light|lamp|symbol|icon|indicator|warning)s?\b/.test(q) && /\b(dash|dashboard|cluster|came on|comes on|lit|on the dash|flashing|blinking|symbol|icon|warning|orange|amber|yellow|red|green|blue|looks like|shaped like|shape of)\b/.test(q);
    const wantsPress = /\b(button|switch|press|knob)\b/.test(q);
    const wantsLever = /\b(lever|stalk)\b/.test(q);
    const side = /\bright\b/.test(q) ? 'right' : /\bleft\b/.test(q) ? 'left' : null;
    const intent = (cl) => {
      let b = 0;
      if (wantsLamp) b += isLamps(cl) ? 4 : 0;
      if (wantsPress && isLamps(cl) && !wantsLamp) b -= 2;
      if (wantsLever && /lever/i.test(cl.name)) b += 2 + (side && stalkSide(cl) === side ? 3 : 0);
      return b;
    };
    const wordHit = (text) => { const t = new Set(words(text)); return qw.reduce((s, w) => s + (t.has(w) ? 1 : 0), 0); };
    const ctlScore = (ctl) => phraseHit(ctl.keywords || []) * 1.3 + wordHit(`${ctl.label} ${ctl.what}`) * 0.6 + wordHit((ctl.keywords || []).join(' ')) * 0.8;
    const scored = CLUSTERS.map(cl => {
      const score = phraseHit(cl.aliases) + wordHit(`${cl.name} ${cl.where}`) * 1.2 + intent(cl);
      let best = null;
      for (const ctl of allControls(cl)) {
        const s = ctlScore(ctl);
        if (!best || s > best.s) best = { ctl, s };
      }
      return { cl, score: score + (best ? best.s * 0.7 : 0), best };
    }).sort((a, b) => b.score - a.score);
    const top = scored[0];
    if (!top || top.score < 0.5) return null;
    const second = scored[1];
    const ctlScores = allControls(top.cl).map(ctlScore).sort((a, b) => b - a);
    const standout = top.best && top.best.s >= 1.5 && top.best.s >= (ctlScores[1] || 0) * 1.5;
    return {
      cluster: top.cl,
      control: standout ? top.best.ctl : null,
      confidence: second ? top.score / (top.score + second.score) : 1,
      alternatives: scored.slice(1, 4).filter(x => x.score > 0.5).map(x => x.cl.id),
    };
  };
}
