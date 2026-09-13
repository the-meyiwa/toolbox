export function initScrollNarrative() {
  const supportView = document.getElementById('support-view');
  if (!supportView) return;

  const tiles = supportView.querySelectorAll('.about-tile');
  if (!tiles.length) return;

  const prefersReduced = () => window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const updateNarrative = () => {
    if (supportView.classList.contains('hidden')) return;

    if (prefersReduced()) {
      tiles.forEach((tile) => {
        tile.style.opacity = '1';
        tile.style.transform = 'none';
        tile.style.filter = 'none';
      });
      return;
    }

    const viewportHeight = window.innerHeight;
    const viewportCenter = viewportHeight / 2;

    tiles.forEach((tile) => {
      const rect = tile.getBoundingClientRect();
      const tileCenter = rect.top + rect.height / 2;
      const distance = Math.abs(tileCenter - viewportCenter);
      const threshold = viewportHeight * 0.55;

      const progress = Math.min(distance / threshold, 1);
      const opacity = Math.max(0.08, 1 - progress * 1.15);
      const scale = 1 - progress * 0.04;
      const translateY = (tileCenter < viewportCenter ? -1 : 1) * (progress * 20);
      const blur = progress * 2.5;

      tile.style.opacity = opacity.toFixed(3);
      tile.style.transform = `translate3d(0, ${translateY.toFixed(1)}px, 0) scale(${scale.toFixed(3)})`;
      tile.style.filter = blur > 0.4 ? `blur(${blur.toFixed(1)}px)` : 'none';
      tile.classList.toggle('tile-active', progress < 0.35);
    });
  };

  window.addEventListener('scroll', updateNarrative, { passive: true });
  window.addEventListener('resize', updateNarrative, { passive: true });

  const observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      if (mutation.attributeName === 'class' && !supportView.classList.contains('hidden')) {
        setTimeout(updateNarrative, 40);
      }
    });
  });
  observer.observe(supportView, { attributes: true });

  // Initial trigger
  updateNarrative();
}
