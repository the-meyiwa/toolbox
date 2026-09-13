export function initScrollNarrative() {
  const supportView = document.getElementById('support-view');
  if (!supportView) return;

  const container = supportView.querySelector('.about-story-container');
  const scenes = supportView.querySelectorAll('.about-scene');
  if (!container || !scenes.length) return;

  // Cinematic scroll animation logic
  const handleScroll = () => {
    if (supportView.classList.contains('hidden')) return;

    // Use Intersection Observer or Scroll position
    // Since we're keeping it simple and responsive:
    const viewportHeight = window.innerHeight;
    
    scenes.forEach((scene, index) => {
      const rect = scene.getBoundingClientRect();
      const sceneCenter = rect.top + rect.height / 2;
      const viewportCenter = viewportHeight / 2;
      
      const distance = Math.abs(sceneCenter - viewportCenter);
      const maxDistance = viewportHeight;
      
      // Calculate opacity and scale based on distance from center
      let opacity = 1 - (distance / maxDistance) * 1.5;
      if (opacity < 0.1) opacity = 0.1;
      if (opacity > 1) opacity = 1;
      
      let scale = 1 - (distance / maxDistance) * 0.1;
      if (scale < 0.9) scale = 0.9;
      if (scale > 1) scale = 1;

      scene.style.opacity = opacity;
      scene.style.transform = \`scale(\${scale}) translateY(\${(distance / maxDistance) * 20}px)\`;
      scene.style.transition = 'opacity 0.1s ease-out, transform 0.1s ease-out';
    });
  };

  window.addEventListener('scroll', handleScroll, { passive: true });
  
  // Call once when support view is opened
  const observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      if (mutation.attributeName === 'class') {
        if (!supportView.classList.contains('hidden')) {
          handleScroll();
        }
      }
    });
  });
  observer.observe(supportView, { attributes: true });
}
