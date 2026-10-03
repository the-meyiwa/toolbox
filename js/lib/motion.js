/* ============================================================
   Motion layer: the parts of css/motion.css that need measuring.

   1. Switchers. Any radio group, tab list or *-seg / *-tabs bar that
      has no indicator of its own gets one that glides to the active
      item: a pill when the active item has a background, an underline
      when it has only a colour or a border. It follows aria-checked,
      aria-selected, aria-pressed, .active and .is-active, so no
      component has to call anything.
   2. Sliders. input[type=range] gets --mo-p, the filled share of its
      track, kept current as it moves.
   3. <details> open and close by animating their height with WAAPI.

   One MutationObserver finds new controls as tools render; each
   switcher gets its own observer and ResizeObserver. Only transform,
   size of the (absolutely positioned) indicator and opacity move.
   ============================================================ */

const GROUP_SEL = [
  '[role="radiogroup"]', '[role="tablist"]', '.pw-seg', '.segmented-switcher',
  '[class$="-seg"]', '[class*="-seg "]', '[class$="-tabs"]', '[class*="-tabs "]', '[class$="-tabbar"]',
].join(',');
const ITEM_SEL = ':scope > button, :scope > [role="tab"], :scope > [role="radio"], :scope > a';
/* Components that already draw their own indicator are left alone. */
const OWN_IND = '.segmented-slider-pill, [class*="-ind"], [class*="indicator"], [class*="glider"], [class*="-pill-bg"], .mo-seg-ind';
const reduced = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

const isActive = (el) => el.getAttribute('aria-checked') === 'true' || el.getAttribute('aria-selected') === 'true'
  || el.getAttribute('aria-pressed') === 'true' || el.classList.contains('active') || el.classList.contains('is-active')
  || el.classList.contains('selected') || el.classList.contains('is-selected');

const transparent = (c) => !c || c === 'transparent' || /rgba\([^)]*,\s*0\)$/.test(c);
const enhanced = new WeakSet();

function enhanceGroup(group) {
  if (enhanced.has(group)) return;
  enhanced.add(group);
  const items = () => [...group.querySelectorAll(ITEM_SEL)];
  if (items().length < 2 || group.querySelector(OWN_IND)) return;

  let style = null;               // 'pill' | 'underline', decided from the first active item
  const ind = document.createElement('span');
  ind.className = 'mo-seg-ind';
  ind.setAttribute('aria-hidden', 'true');

  const measure = (first = false) => {
    const active = items().find(isActive);
    for (const el of items()) el.classList.toggle('mo-active', el === active);
    if (!active || !active.offsetParent) { group.classList.remove('mo-ready'); return; }
    if (!style) {
      // Read the item's own active look before the indicator takes it over.
      // Read the settled look: a transition may be mid-way from transparent.
      const prev = active.style.transition;
      active.style.transition = 'none';
      const cs = getComputedStyle(active);
      const bg = cs.backgroundColor;
      const snapshot = { radius: cs.borderRadius, shadow: cs.boxShadow, color: cs.color, line: cs.borderBottomColor, lineW: cs.borderBottomWidth };
      active.style.transition = prev;
      // A switcher sitting on a filled track is a pill switcher even if its
      // active item paints nothing; a bare row of tabs is an underline one.
      const track = !transparent(getComputedStyle(group).backgroundColor);
      style = !transparent(bg) || track ? 'pill' : 'underline';
      group.classList.add('mo-seg', style === 'pill' ? 'mo-pill' : 'mo-underline');
      if (getComputedStyle(group).position === 'static') group.style.position = 'relative';
      if (!transparent(bg)) ind.style.setProperty('--mo-bg', bg);
      ind.style.setProperty('--mo-r', snapshot.radius);
      if (!transparent(bg)) ind.style.setProperty('--mo-shadow', snapshot.shadow === 'none' ? 'none' : snapshot.shadow);
      ind.style.setProperty('--mo-line', transparent(snapshot.line) || snapshot.lineW === '0px' ? snapshot.color : snapshot.line);
      group.prepend(ind);
      first = true;
    }
    // offsetLeft/Top are relative to the group, which is the offset parent.
    const x = active.offsetLeft; const y = active.offsetTop;
    if (first || reduced()) group.classList.add('mo-instant');
    ind.style.setProperty('--mo-x', `${x}px`);
    ind.style.setProperty('--mo-y', `${y}px`);
    ind.style.setProperty('--mo-w', `${active.offsetWidth}px`);
    ind.style.setProperty('--mo-h', `${active.offsetHeight}px`);
    if (first || reduced()) { void ind.offsetWidth; requestAnimationFrame(() => group.classList.remove('mo-instant')); }
    group.classList.add('mo-ready');
  };

  let frame = 0;
  const schedule = () => { if (!frame) frame = requestAnimationFrame(() => { frame = 0; measure(); }); };
  new MutationObserver(schedule).observe(group, { subtree: true, attributes: true, attributeFilter: ['class', 'aria-checked', 'aria-selected', 'aria-pressed', 'hidden'], childList: true });
  if (typeof ResizeObserver === 'function') new ResizeObserver(schedule).observe(group);
  // Clicks settle before the component updates its state, so measure after.
  group.addEventListener('click', () => requestAnimationFrame(schedule));
  requestAnimationFrame(() => measure(true));
}

/* ---------- sliders ---------- */

function fillRange(r) {
  const min = Number(r.min || 0); const max = Number(r.max || 100); const v = Number(r.value);
  r.style.setProperty('--mo-p', `${max > min ? ((v - min) / (max - min)) * 100 : 0}%`);
}

/* ---------- details ---------- */

/* Opening snaps the section open (one layout) and its contents settle in; closing lets them
   lift away first. Only transform and opacity animate, so a long page never re-lays out per frame. */
function animateDetails(d, summary) {
  summary.addEventListener('click', (e) => {
    if (reduced() || typeof d.animate !== 'function') return;
    e.preventDefault();
    if (d.classList.contains('mo-animating')) return;
    const parts = [...d.children].filter(n => n !== summary);
    d.classList.add('mo-animating');
    const done = () => d.classList.remove('mo-animating');
    if (!d.open) {
      d.open = true;
      const anims = parts.map((n, i) => n.animate([{ opacity: 0, transform: 'translateY(-6px)' }, { opacity: 1, transform: 'none' }],
        { duration: 200, delay: Math.min(i, 4) * 18, easing: 'cubic-bezier(.22, 1, .36, 1)', fill: 'backwards', tempo: false }));
      Promise.all(anims.map(a => a.finished)).then(done, done);
    } else {
      const anims = parts.map(n => n.animate([{ opacity: 1, transform: 'none' }, { opacity: 0, transform: 'translateY(-4px)' }],
        { duration: 130, easing: 'cubic-bezier(.4, 0, 1, 1)', fill: 'forwards', tempo: false }));
      const close = () => { d.open = false; anims.forEach(a => a.cancel()); done(); };
      Promise.all(anims.map(a => a.finished)).then(close, close);
    }
  });
}

/* ---------- discovery ---------- */

function scan(root) {
  if (!root.querySelectorAll) return;
  if (root.matches?.(GROUP_SEL)) enhanceGroup(root);
  root.querySelectorAll(GROUP_SEL).forEach(enhanceGroup);
  root.querySelectorAll('input[type="range"]').forEach((r) => { if (!r.dataset.moRange) { r.dataset.moRange = '1'; fillRange(r); } });
  root.querySelectorAll('details > summary').forEach((s) => { const d = s.parentElement; if (!d.dataset.moDetails) { d.dataset.moDetails = '1'; animateDetails(d, s); } });
}

export function installMotion(root = document.body) {
  if (typeof window === 'undefined' || window.__toolboxMotion) return;
  window.__toolboxMotion = true;
  document.addEventListener('input', (e) => { if (e.target?.type === 'range') fillRange(e.target); }, true);
  document.addEventListener('change', (e) => { if (e.target?.type === 'range') fillRange(e.target); }, true);
  scan(root);
  let pending = [];
  let frame = 0;
  new MutationObserver((records) => {
    for (const r of records) for (const n of r.addedNodes) if (n.nodeType === 1) pending.push(n);
    if (!frame) frame = requestAnimationFrame(() => { frame = 0; const list = pending; pending = []; list.forEach(scan); });
  }).observe(root, { childList: true, subtree: true });
}
