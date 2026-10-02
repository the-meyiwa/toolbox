/* ============================================================
   TOOLBOX — Home motion

   Home is one column, and it arrives as one: the question rises
   word by word, the search settles, then the thread draws down from
   it, through your shortcuts (one after another) to the Assistant.
   It replays, quicker, each time you come back to Home.

   Only transform and opacity move; reduced motion shows it at once.
   The suggestion web has its own motion (js/lib/suggestion-web.js).
   ============================================================ */

const reduced = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
const GLIDE = 'cubic-bezier(.22, 1, .36, 1)';

/** Splits the title into words once, so each can rise on its own. */
function splitWords(title) {
  if (!title || title.dataset.split) return;
  const words = title.textContent.trim().split(/\s+/);
  title.setAttribute('aria-label', title.textContent.trim());
  title.innerHTML = words.map(w => `<span class="lp-w" aria-hidden="true">${w}</span>`).join(' ');
  title.dataset.split = '1';
}

export function initHomeScrollNarrative() {
  const home = document.getElementById('home-view');
  if (!home) return;
  const title = home.querySelector('.lp-title');
  splitWords(title);
  let played = false;
  let running = [];

  const play = () => {
    if (home.classList.contains('hidden')) return;
    running.forEach(a => a.cancel());
    running = [];
    if (reduced() || typeof Element.prototype.animate !== 'function') return;
    const quick = played;
    played = true;
    const k = quick ? 0.55 : 1;
    const go = (el, frames, delay, duration = 700) => {
      if (!el) return;
      running.push(el.animate(frames, { duration: duration * k, delay: delay * k, easing: GLIDE, fill: 'backwards' }));
    };
    const rise = (d = 12) => [{ opacity: 0, transform: `translateY(${d}px)` }, { opacity: 1, transform: 'none' }];

    go(home.querySelector('.lp-kicker'), [{ opacity: 0 }, { opacity: 1 }], 0, 600);
    home.querySelectorAll('.lp-w').forEach((w, i) => {
      w.style.display = 'inline-block';
      go(w, [{ opacity: 0, transform: 'translateY(.45em)', filter: 'blur(4px)' }, { opacity: 1, transform: 'none', filter: 'blur(0)' }], 80 + i * 70, 760);
    });
    go(home.querySelector('.lp-sub'), rise(8), 360);
    go(home.querySelector('.lp-search'), [{ opacity: 0, transform: 'translateY(14px) scale(.98)' }, { opacity: 1, transform: 'none' }], 460, 820);
    go(home.querySelector('.home-search-keys'), [{ opacity: 0 }, { opacity: 1 }], 760, 500);

    // The thread draws down from the search, through the shortcuts, to the Assistant.
    const quickRow = home.querySelector('.home-quick');
    const thread = (el, delay) => {
      if (!el) return;
      el.classList.add('lp-undrawn');
      void el.offsetWidth;
      setTimeout(() => el.classList.remove('lp-undrawn'), delay * k);
    };
    thread(quickRow, 700);
    [...(quickRow?.children || [])].forEach((chip, i) => go(chip, rise(8), 820 + i * 55, 560));
    thread(home.querySelector('.lp-assistant'), 1050);
    go(home.querySelector('.lp-ask'), rise(10), 1180, 700);
  };

  // Home is shown and hidden by toggling .hidden; play each time it goes from hidden to shown.
  let shown = false;
  const check = () => {
    const now = !home.classList.contains('hidden');
    if (now && !shown) requestAnimationFrame(play);
    shown = now;
  };
  new MutationObserver(check).observe(home, { attributes: true, attributeFilter: ['class'] });
  check();
}
