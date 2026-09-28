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
  const bentoCount = view.querySelector('#about-bento-tools');
  if (bentoCount) bentoCount.dataset.countTo = String(TOOLS.length);
  const catCount = view.querySelector('#about-cat-count');
  if (catCount) catCount.dataset.countTo = String(categorised(TOOLS).length);

  splitHeadlines(view);
  buildBurst(view);
  buildMarquee(view);

  const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const bar = view.querySelector('.about-progress span');
  let frame = 0;

  // With CSS scroll timelines (about.css) the scenes move with the browser's
  // own scroll at the display's full rate (120 Hz on ProMotion), so this
  // script only has to reveal each chapter once. Everything below the early
  // return is the fallback for browsers without scroll timelines.
  const nativeMotion = () => !motion.matches && typeof CSS !== 'undefined' && CSS.supports?.('animation-timeline: view()');
  const reveal = (ch) => {
    if (ch.classList.contains('is-in')) return;
    ch.classList.add('is-in');
    ch.querySelectorAll('[data-count-to]').forEach(animateCount);
  };
  if (nativeMotion() && typeof IntersectionObserver !== 'undefined') {
    // Same trigger as the fallback: the chapter reaches 75% down the screen and still shows in the top 80%.
    const io = new IntersectionObserver((entries) => entries.forEach((e) => { if (e.isIntersecting) reveal(e.target); }), { rootMargin: '-20% 0px -25% 0px' });
    chapters.forEach((ch) => io.observe(ch));
    initExtras(view);
    // Replay the entrances each time the page is opened.
    new MutationObserver(() => {
      if (view.classList.contains('hidden')) chapters.forEach((ch) => ch.classList.remove('is-in'));
      else chapters.forEach((ch) => { io.unobserve(ch); io.observe(ch); });
    }).observe(view, { attributes: true, attributeFilter: ['class'] });
    return;
  }

  // Geometry is measured once (and again on resize or when the page is
  // shown), so scrolling only does arithmetic: no layout reads per frame,
  // which is what made phones stutter. Custom properties are written only
  // to chapters near the screen, and only when the value changes.
  let geo = [];
  let viewTop = 0, viewH = 1;
  const measure = () => {
    const sy = window.scrollY;
    const vb = view.getBoundingClientRect();
    viewTop = vb.top + sy; viewH = vb.height;
    geo = chapters.map((ch) => {
      const r = ch.getBoundingClientRect();
      const stage = ch.querySelector('.about-stage');
      return {
        ch, top: r.top + sy, h: r.height,
        stageH: stage ? stage.offsetHeight : window.innerHeight,
        stick: parseFloat(getComputedStyle(stage || ch).top) || 0,
        last: -1,
      };
    });
  };

  const update = () => {
    frame = 0;
    if (view.classList.contains('hidden')) return;
    const vh = window.innerHeight;
    const y = window.scrollY;
    if (bar) bar.style.transform = `scaleX(${clamp((y - viewTop) / Math.max(1, viewH - vh), 0, 1).toFixed(4)})`;
    for (const g of geo) {
      const top = g.top - y;
      const bottom = top + g.h;
      const near = top < vh * 1.5 && bottom > -vh * 0.5;
      const p = motion.matches ? 1 : clamp((g.stick - top) / Math.max(1, g.h - g.stageH), 0, 1);
      const q = near ? Math.round(p * 1000) / 1000 : (p > 0.5 ? 1 : 0);
      if (q !== g.last) { g.ch.style.setProperty('--p', String(q)); g.last = q; }
      if (top < vh * 0.75 && bottom > vh * 0.2) reveal(g.ch);
    }
  };

  const schedule = () => { if (!frame) frame = requestAnimationFrame(update); };
  const remeasure = () => { measure(); schedule(); };
  window.addEventListener('scroll', schedule, { passive: true });
  window.addEventListener('resize', remeasure, { passive: true });
  motion.addEventListener?.('change', remeasure);
  if (typeof ResizeObserver !== 'undefined') new ResizeObserver(remeasure).observe(view);

  initExtras(view);

  // Replay the entrances each time the page is opened.
  new MutationObserver(() => {
    if (view.classList.contains('hidden')) {
      chapters.forEach((ch) => ch.classList.remove('is-in'));
    } else {
      requestAnimationFrame(remeasure);
    }
  }).observe(view, { attributes: true, attributeFilter: ['class'] });

  measure();
  update();
}

/* Pointer spotlight and marquee: shared by both motion paths. */
function initExtras(view) {
  initShowcase(view);
  // A soft spotlight follows a mouse pointer. It is its own composited
  // layer moved by transform, so it never restyles the page.
  if (window.matchMedia('(hover: hover) and (pointer: fine)').matches) {
    const spot = document.createElement('div');
    spot.className = 'about-spot';
    spot.setAttribute('aria-hidden', 'true');
    view.prepend(spot);
    let sx = 0, sy = 0, sf = 0;
    view.addEventListener('pointermove', (e) => {
      sx = e.clientX; sy = e.clientY;
      if (!sf) sf = requestAnimationFrame(() => { sf = 0; spot.style.transform = `translate3d(${sx}px, ${sy}px, 0)`; });
    }, { passive: true });
  }

  // The marquee only runs while it is on screen.
  const marquee = view.querySelector('.about-marquee');
  if (marquee && typeof IntersectionObserver !== 'undefined') {
    new IntersectionObserver(([e]) => marquee.classList.toggle('is-running', e.isIntersecting)).observe(marquee);
  } else marquee?.classList.add('is-running');
}

/* "Why Toolbox": cards rise in one after another, numbers count up, and on a mouse each card
   tilts toward the pointer with a light that follows it (transform and custom properties only). */
function initShowcase(view) {
  const show = view.querySelector('.about-showcase');
  const friends = view.querySelector('.about-friends');
  if (!show) return;
  const reveal = (el) => { el.classList.add('is-in'); el.querySelectorAll('[data-count-to]').forEach(animateCount); };
  if (typeof IntersectionObserver === 'undefined') { reveal(show); friends && reveal(friends); }
  else {
    const io = new IntersectionObserver((entries) => entries.forEach((e) => { if (e.isIntersecting) { reveal(e.target); io.unobserve(e.target); } }), { rootMargin: '0px 0px -15% 0px' });
    io.observe(show);
    if (friends) io.observe(friends);
    new MutationObserver(() => {
      if (!view.classList.contains('hidden')) return;
      [show, friends].filter(Boolean).forEach((el) => { el.classList.remove('is-in'); io.observe(el); });
    }).observe(view, { attributes: true, attributeFilter: ['class'] });
  }
  if (!window.matchMedia('(hover: hover) and (pointer: fine)').matches || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  view.querySelectorAll('.bento-card, .korelearn-card').forEach((card) => {
    let raf = 0, ev = null;
    card.addEventListener('pointermove', (e) => {
      ev = e;
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        const r = card.getBoundingClientRect();
        const x = (ev.clientX - r.left) / r.width, y = (ev.clientY - r.top) / r.height;
        card.style.setProperty('--rx', `${((0.5 - y) * 6).toFixed(2)}deg`);
        card.style.setProperty('--ry', `${((x - 0.5) * 8).toFixed(2)}deg`);
        card.style.setProperty('--gx', `${(x * 100).toFixed(1)}%`);
        card.style.setProperty('--gy', `${(y * 100).toFixed(1)}%`);
      });
    }, { passive: true });
    card.addEventListener('pointerleave', () => { card.style.setProperty('--rx', '0deg'); card.style.setProperty('--ry', '0deg'); });
  });
}
