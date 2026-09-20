export function initScrollNarrative() {
  const supportView = document.getElementById('support-view');
  if (!supportView) return;

  const tiles = supportView.querySelectorAll('.about-chapter');
  if (!tiles.length) return;

  const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const prefersReduced = () => motion.matches;
  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
  let frame = 0;

  const updateNarrative = () => {
    frame = 0;
    if (supportView.classList.contains('hidden')) return;

    supportView.classList.toggle('story-motion', !prefersReduced());
    const bounds = supportView.getBoundingClientRect();
    supportView.style.setProperty('--story-progress', clamp(-bounds.top / Math.max(1, bounds.height - window.innerHeight), 0, 1));

    const viewportHeight = window.innerHeight;
    tiles.forEach((tile) => {
      const rect = tile.getBoundingClientRect();
      if (rect.bottom < -viewportHeight || rect.top > viewportHeight * 2) return;
      const travel = Math.max(1, viewportHeight + rect.height);
      const progress = prefersReduced() ? .5 : clamp((viewportHeight - rect.top) / travel, 0, 1);
      const centered = (progress - .5) * 2;
      const enter = prefersReduced() ? 1 : clamp((progress - .02) / .14, 0, 1);
      const exit = prefersReduced() ? 0 : clamp((progress - .76) / .18, 0, 1);
      const visibility = prefersReduced() ? 1 : Math.min(enter, 1 - exit);
      const phase = (offset) => prefersReduced() ? 1 : clamp((progress - offset) / .18, 0, 1);
      tile.style.setProperty('--chapter-progress', progress.toFixed(4));
      tile.style.setProperty('--chapter-drift', `${centered * 72}px`);
      tile.style.setProperty('--chapter-turn', `${centered * -14}deg`);
      tile.style.setProperty('--chapter-spread', `${Math.abs(centered) * 64}px`);
      tile.style.setProperty('--chapter-reveal', visibility.toFixed(3));
      tile.style.setProperty('--chapter-exit', exit.toFixed(3));
      tile.style.setProperty('--chapter-enter', enter.toFixed(3));
      tile.style.setProperty('--story-step-1', phase(.12).toFixed(3));
      tile.style.setProperty('--story-step-2', phase(.25).toFixed(3));
      tile.style.setProperty('--story-step-3', phase(.38).toFixed(3));
      tile.classList.toggle('is-story-active', progress > .16 && progress < .84);
    });
  };

  const schedule = () => { if (!frame) frame = requestAnimationFrame(updateNarrative); };
  window.addEventListener('scroll', schedule, { passive: true });
  window.addEventListener('resize', schedule, { passive: true });
  motion.addEventListener('change', schedule);

  const observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      if (mutation.attributeName === 'class' && !supportView.classList.contains('hidden')) {
        schedule();
      }
    });
  });
  observer.observe(supportView, { attributes: true, attributeFilter: ['class'] });

  // Initial trigger
  updateNarrative();
}
