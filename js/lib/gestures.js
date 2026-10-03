/* ============================================================
   TOOLBOX — Touch gestures

   Two gestures, both off with Settings → General → Swipe gestures:

   1. Swipe in from the left edge: go back. A round arrow follows the
      finger and fills as the swipe nears the distance that counts;
      let go past it and it goes back, let go short of it and the
      arrow slips away. What "back" means is decided in one place
      (`back()` in app.js): close the sheet that is open, else leave
      the tool, else step back through the pages.
   2. Swipe sideways on Home, Tools or Files: move to the next or
      previous of the three, like the tabs in the bar below. The page
      follows the finger a little and the move is skipped if the swipe
      starts on anything that scrolls or draws sideways (a chip row,
      a map, a code editor, a slider, a field).

   A phone's own edge swipe (iOS Safari, Android's system Back) is
   the system's and cannot be switched off from a web page; it ends
   in the same place, because the page keeps its history in step
   (see back-stack.js) and `leaveTool()` in app.js.

   Transform and opacity only.
   ============================================================ */

import { getSetting } from './settings.js';

const EDGE = 22;                // px from the left edge where a swipe counts as "from the edge"
const COMMIT = 84;              // px of travel that commits an edge swipe
const OUT = 'cubic-bezier(.22, 1, .36, 1)';
const reduced = () => { try { return matchMedia('(prefers-reduced-motion: reduce)').matches; } catch { return false; } };
const enabled = () => getSetting('swipeGestures') !== false;
const buzz = (ms = 8) => { try { if (getSetting('hapticAudio') !== false) navigator.vibrate?.(ms); } catch { /* unsupported */ } };

/** True where a sideways drag belongs to the thing under the finger, not to page switching. */
function ownsSideways(el) {
  for (let n = el; n && n !== document.body && n.nodeType === 1; n = n.parentElement) {
    const tag = n.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || tag === 'CANVAS' || tag === 'VIDEO' || tag === 'AUDIO' || tag === 'IFRAME') return true;
    if (n.isContentEditable || n.hasAttribute?.('data-no-gesture')) return true;
    if (n.matches?.('.leaflet-container, .cm-editor, .monaco-editor, [role="slider"], [role="tablist"], .category-chip-bar, .ia-chips')) return true;
    if (n.scrollWidth > n.clientWidth + 6) {
      const ox = getComputedStyle(n).overflowX;
      if (ox === 'auto' || ox === 'scroll') return true;
    }
  }
  return false;
}

const overlayOpen = () => !!document.querySelector('[aria-modal="true"]:not([hidden]), .asp.is-open, .stg-backdrop.is-open, .ia-backdrop.is-open');

/**
 * Installs both gestures.
 *   back()            what the edge swipe does; returns false when there is nowhere to go back to
 *   main()            'home' | 'tools' | 'saved' when one of the three main pages is showing, else null
 *   goMain(name, dir) moves to a main page (dir: 1 = forward, -1 = back)
 */
export function installGestures({ back, main, goMain }) {
  if (typeof window === 'undefined' || !('ontouchstart' in window)) return () => {};
  const ORDER = ['home', 'tools', 'saved'];
  let g = null;                  // the gesture in progress
  let bubble = null;

  function makeBubble() {
    const el = document.createElement('div');
    el.className = 'tb-edge-swipe';
    el.setAttribute('aria-hidden', 'true');
    el.innerHTML = '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 18l-6-6 6-6"/></svg>';
    document.body.appendChild(el);
    return el;
  }
  function paintBubble(dx, y) {
    if (!bubble) return;
    const p = Math.min(dx / COMMIT, 1);
    const x = Math.min(dx * 0.6, 62) - 40;
    bubble._y = y;
    bubble.style.transform = `translate(${x}px, ${y - 22}px) scale(${0.6 + p * 0.4})`;
    bubble.style.opacity = String(Math.min(1, p * 1.4));
    bubble.classList.toggle('is-ready', dx >= COMMIT);
  }
  function endBubble(commit) {
    const el = bubble; bubble = null;
    if (!el) return;
    const y = (el._y || 0) - 22;
    if (reduced() || !el.animate) { el.remove(); return; }
    const now = getComputedStyle(el).transform;
    el.animate(commit
      ? [{ transform: now, opacity: 1 }, { transform: now, opacity: 0 }]
      : [{ transform: now, opacity: el.style.opacity || 1 }, { transform: `translate(-48px, ${y}px) scale(.6)`, opacity: 0 }],
    { duration: commit ? 220 : 240, easing: OUT, fill: 'forwards' }).finished.then(() => el.remove(), () => el.remove());
  }

  function view() { return document.querySelector('.page-view:not(.hidden)'); }

  function onStart(e) {
    if (!enabled() || g || e.touches.length !== 1) return;
    if (overlayOpen() && e.touches[0].clientX > EDGE) return;
    const t = e.touches[0];
    const fromEdge = t.clientX <= EDGE && !e.target.closest?.('[data-no-edge-swipe]');
    const m = main();
    if (!fromEdge && !(m && !overlayOpen() && !ownsSideways(e.target))) return;
    g = { kind: fromEdge ? 'edge' : 'page', x0: t.clientX, y0: t.clientY, t0: performance.now(), dx: 0, state: 'wait', view: fromEdge ? null : view(), main: m };
  }

  function onMove(e) {
    if (!g) return;
    const t = e.touches[0];
    const dx = t.clientX - g.x0;
    const dy = t.clientY - g.y0;
    g.dx = dx;
    if (g.state === 'wait') {
      if (Math.abs(dy) > 14 && Math.abs(dy) > Math.abs(dx) * 0.9) { g = null; return; }   // it is a scroll
      if (g.kind === 'edge' && dx > 9 && dx > Math.abs(dy) * 1.3) { g.state = 'drag'; bubble = makeBubble(); }
      else if (g.kind === 'page' && Math.abs(dx) > 14 && Math.abs(dx) > Math.abs(dy) * 1.8) { g.state = 'drag'; }
      else return;
    }
    if (e.cancelable) e.preventDefault();
    if (g.kind === 'edge') paintBubble(Math.max(0, dx), t.clientY);
    else if (g.view) {
      const i = ORDER.indexOf(g.main);
      const dir = dx < 0 ? 1 : -1;
      const has = ORDER[i + dir] !== undefined;
      const follow = (has ? 0.34 : 0.12) * dx;                 // resistance at either end
      g.view.style.transform = `translateX(${Math.max(-60, Math.min(60, follow))}px)`;
      g.view.style.opacity = String(1 - Math.min(Math.abs(follow) / 260, 0.25));
    }
  }

  function settle(el, commit) {
    if (!el) return;
    const from = el.style.transform || 'none';
    const o = el.style.opacity || '1';
    el.style.transform = ''; el.style.opacity = '';
    if (reduced() || !el.animate || commit) return;
    el.animate([{ transform: from, opacity: o }, { transform: 'none', opacity: 1 }], { duration: 320, easing: OUT });
  }

  function onEnd() {
    if (!g) return;
    const cur = g; g = null;
    if (cur.state !== 'drag') return;
    const dt = Math.max(1, performance.now() - cur.t0);
    const v = Math.abs(cur.dx) / dt;
    if (cur.kind === 'edge') {
      const go = cur.dx >= COMMIT || (v > 0.55 && cur.dx >= 44);
      if (go && back() !== false) { buzz(); endBubble(true); } else endBubble(false);
      return;
    }
    const i = ORDER.indexOf(cur.main);
    const dir = cur.dx < 0 ? 1 : -1;
    const next = ORDER[i + dir];
    const go = next && (Math.abs(cur.dx) >= 72 || (v > 0.5 && Math.abs(cur.dx) >= 36));
    if (go) { settle(cur.view, true); buzz(6); goMain(next, dir); } else settle(cur.view, false);
  }

  function onCancel() {
    if (!g) return;
    const cur = g; g = null;
    if (cur.kind === 'edge') endBubble(false); else settle(cur.view, false);
  }

  document.addEventListener('touchstart', onStart, { passive: true });
  document.addEventListener('touchmove', onMove, { passive: false });
  document.addEventListener('touchend', onEnd, { passive: true });
  document.addEventListener('touchcancel', onCancel, { passive: true });
  return () => {
    document.removeEventListener('touchstart', onStart);
    document.removeEventListener('touchmove', onMove);
    document.removeEventListener('touchend', onEnd);
    document.removeEventListener('touchcancel', onCancel);
  };
}
