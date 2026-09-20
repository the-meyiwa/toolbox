// Short transform-only motion; no layout animation or persistent animation loop.
const closing = new WeakSet();

export function removeMenu(menu) {
  if (!menu || closing.has(menu)) return;
  const reduced = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  if (reduced || typeof menu.animate !== 'function') { menu.remove(); return; }
  closing.add(menu);
  menu.style.pointerEvents = 'none';
  menu.setAttribute('aria-hidden', 'true');
  menu.inert = true;
  // Release the ID immediately so reopening cannot select the departing menu.
  menu.removeAttribute('id');
  const animation = menu.animate([
    { opacity: 1, transform: 'perspective(900px) rotateX(0deg) scale(1)' },
    { opacity: 0, transform: 'perspective(900px) rotateX(-5deg) scale(.97)' },
  ], { duration: 120, easing: 'cubic-bezier(.4,0,1,1)', fill: 'forwards' });
  animation.finished.catch(() => {}).finally(() => menu.remove());
}
