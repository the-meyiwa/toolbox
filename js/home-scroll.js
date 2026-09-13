/* ============================================================
   TOOLBOX — Home Page Scroll & Storytelling Coordinator
   Coordinates vertical slide transitions and snap states.
   ============================================================ */

export function initHomeScrollNarrative() {
  const homeView = document.getElementById('home-view');
  if (!homeView) return;

  const slides = homeView.querySelectorAll('.home-story-slide');
  if (!slides.length) return;

  const prefersReduced = () => window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const updateSlides = () => {
    if (homeView.classList.contains('hidden')) return;

    if (prefersReduced()) {
      slides.forEach(slide => {
        slide.classList.add('slide-active');
      });
      return;
    }

    const viewportHeight = window.innerHeight;
    const viewportCenter = viewportHeight / 2;

    slides.forEach((slide) => {
      const rect = slide.getBoundingClientRect();
      const slideCenter = rect.top + rect.height / 2;
      const distance = Math.abs(slideCenter - viewportCenter);
      const isClosest = distance < viewportHeight * 0.55;
      slide.classList.toggle('slide-active', isClosest);
    });
  };

  window.addEventListener('scroll', updateSlides, { passive: true });
  window.addEventListener('resize', updateSlides, { passive: true });

  const observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      if (mutation.attributeName === 'class' && !homeView.classList.contains('hidden')) {
        setTimeout(updateSlides, 50);
      }
    });
  });
  observer.observe(homeView, { attributes: true });

  // Handle smooth scroll clicks for internal slide navigation
  homeView.addEventListener('click', (e) => {
    const link = e.target.closest('a[href^="#home-slide-"]');
    if (link) {
      e.preventDefault();
      const targetId = link.getAttribute('href').slice(1);
      const targetEl = document.getElementById(targetId);
      if (targetEl) {
        targetEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }
  });

  updateSlides();
}
