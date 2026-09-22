/* ============================================================
   TOOLBOX — About: scroll-driven story
   Each .about-chapter is a tall track with a pinned stage. This file
   writes the chapter's progress through its track to --p (0 → 1) and
   marks chapters .is-in when their stage is on screen; about.css turns
   those two signals into every movement on the page.
   ============================================================ */

import { TOOLS, categorised } from './registry/index.js';

const clamp = (v, min, max) => Math.max(min, Math.min(max, v));

function splitHeadlines(root) {
  root.querySelectorAll('[data-split]').forEach((el) => {
    if (el.dataset.splitDone) return;
    el.dataset.splitDone = '1';
    const words = el.textContent.trim().split(/\s+/);
    el.setAttribute('aria-label', el.textContent.trim());
    el.innerHTML = words.map((w, i) => `<span class="w" aria-hidden="true"><span style="--wi:${i}">${w}</span></span>`).join(' ');
  });
  // Stagger the paragraphs that follow each headline.
  root.querySelectorAll('.about-copy').forEach((copy) => {
    [...copy.querySelectorAll('.about-lead, .about-text, .about-quote, .about-stats, :scope > .btn')]
      .forEach((el, i) => el.style.setProperty('--li', i));
  });
}

function buildBurst(root) {
  const burst = root.querySelector('#about-burst');
  if (!burst || burst.childElementCount) return;
  const picks = TOOLS.filter((t) => t.icon && !t.hidden).slice(0, 60);
  const step = Math.max(1, Math.floor(picks.length / 20));
  const chosen = picks.filter((_, i) => i % step === 0).slice(0, 20);
  // Two rings around the core.
  chosen.forEach((tool, i) => {
    const ring = i < 8 ? 0 : 1;
    const count = ring === 0 ? 8 : chosen.length - 8;
    const idx = ring === 0 ? i : i - 8;
    const angle = (idx / count) * Math.PI * 2 + (ring ? Math.PI / count : 0);
    const radius = ring === 0 ? 130 : 220;
    const el = document.createElement('span');
    el.className = 'burst-tile';
    el.innerHTML = tool.icon;
    el.style.setProperty('--tx', `${Math.round(Math.cos(angle) * radius * 1.15)}px`);
    el.style.setProperty('--ty', `${Math.round(Math.sin(angle) * radius * .8)}px`);
    el.style.setProperty('--rot', `${(i % 2 ? 1 : -1) * (60 + (i * 37) % 120)}deg`);
    el.style.setProperty('--d', (ring + (idx % 3) * .25).toFixed(2));
    burst.appendChild(el);
  });
}

function buildMarquee(root) {
  const rows = [root.querySelector('#about-marquee-1'), root.querySelector('#about-marquee-2')];
  if (!rows[0] || rows[0].childElementCount) return;
  const visible = TOOLS.filter((t) => !t.hidden);
  const half = Math.ceil(visible.length / 2);
  [visible.slice(0, half), visible.slice(half)].forEach((list, r) => {
    const html = list.map((t) => `<span>${t.icon || ''}${t.name}</span>`).join('');
    rows[r].innerHTML = html + html; // doubled so the loop is seamless
  });
}

function animateCount(el) {
  const target = Number(el.dataset.countTo) || 0;
  const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  if (reduce) { el.textContent = target; return; }
  const start = performance.now();
  const dur = 1400;
  const tick = (now) => {
    const t = clamp((now - start) / dur, 0, 1);
    const eased = 1 - Math.pow(1 - t, 4);
    el.textContent = Math.round(target * eased);
    if (t < 1) requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}

export function initScrollNarrative() {
  const view = document.getElementById('support-view');
  if (!view) return;
  const chapters = [...view.querySelectorAll('.about-chapter')];
  if (!chapters.length) return;

  // Real numbers, never hard-coded.
  const toolCount = view.querySelector('#about-tool-count');
  if (toolCount) toolCount.dataset.countTo = String(TOOLS.length);
  const catCount = view.querySelector('#about-cat-count');
  if (catCount) catCount.dataset.countTo = String(categorised(TOOLS).length);

  splitHeadlines(view);
  buildBurst(view);
  buildMarquee(view);

  const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
  let frame = 0;

  const update = () => {
    frame = 0;
    if (view.classList.contains('hidden')) return;
    const vh = window.innerHeight;
    const bounds = view.getBoundingClientRect();
    view.style.setProperty('--story-progress', clamp(-bounds.top / Math.max(1, bounds.height - vh), 0, 1).toFixed(4));

    for (const ch of chapters) {
      const r = ch.getBoundingClientRect();
      const stage = ch.querySelector('.about-stage');
      const stageH = stage ? stage.offsetHeight : vh;
      const travel = Math.max(1, r.height - stageH);
      const top = parseFloat(getComputedStyle(stage || ch).top) || 0;
      const p = motion.matches ? 1 : clamp((top - r.top) / travel, 0, 1);
      ch.style.setProperty('--p', p.toFixed(4));
      const onScreen = r.top < vh * 0.75 && r.bottom > vh * 0.2;
      if (onScreen && !ch.classList.contains('is-in')) {
        ch.classList.add('is-in');
        ch.querySelectorAll('[data-count-to]').forEach(animateCount);
      }
    }
  };

  const schedule = () => { if (!frame) frame = requestAnimationFrame(update); };
  window.addEventListener('scroll', schedule, { passive: true });
  window.addEventListener('resize', schedule, { passive: true });
  motion.addEventListener?.('change', schedule);

  // A soft spotlight follows the pointer.
  view.addEventListener('pointermove', (e) => {
    view.style.setProperty('--mx', `${e.clientX}px`);
    view.style.setProperty('--my', `${e.clientY}px`);
  }, { passive: true });

  // Replay the entrances each time the page is opened.
  new MutationObserver(() => {
    if (view.classList.contains('hidden')) {
      chapters.forEach((ch) => ch.classList.remove('is-in'));
    } else {
      schedule();
    }
  }).observe(view, { attributes: true, attributeFilter: ['class'] });

  update();
}
