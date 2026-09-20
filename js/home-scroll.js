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

  let frame = 0;
  const schedule = () => {
    if (frame || homeView.classList.contains('hidden')) return;
    frame = requestAnimationFrame(() => { frame = 0; updateSlides(); });
  };
  window.addEventListener('scroll', schedule, { passive: true });
  window.addEventListener('resize', schedule, { passive: true });

  const observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      if (mutation.attributeName === 'class' && !homeView.classList.contains('hidden')) {
        schedule();
      }
    });
  });
  observer.observe(homeView, { attributes: true, attributeFilter: ['class'] });

  // Handle smooth scroll clicks for internal slide navigation
  homeView.addEventListener('click', (e) => {
    const link = e.target.closest('a[href^="#home-slide-"]');
    if (link) {
      e.preventDefault();
      const targetId = link.getAttribute('href').slice(1);
      const targetEl = document.getElementById(targetId);
      if (targetEl) {
        targetEl.scrollIntoView({ behavior: prefersReduced() ? 'instant' : 'smooth', block: 'start' });
      }
    }
  });

  updateSlides();
}
