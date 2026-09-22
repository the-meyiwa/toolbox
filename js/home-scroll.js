/* ============================================================
   TOOLBOX — Home page motion
   Sections below the hero rise into place the first time they are
   scrolled into view. Reduced motion shows everything at once.
   ============================================================ */

export function initHomeScrollNarrative() {
  const homeView = document.getElementById('home-view');
  if (!homeView) return;

  const sections = homeView.querySelectorAll('.home-story-slide');
  const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

  if (!reduce && 'IntersectionObserver' in window) {
    const io = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        entry.target.classList.remove('reveal-pending');
        entry.target.classList.add('slide-active');
        io.unobserve(entry.target);
      }
    }, { rootMargin: '0px 0px -12% 0px', threshold: 0.08 });
    sections.forEach((section) => {
      section.classList.add('reveal-pending');
      io.observe(section);
    });
  } else {
    sections.forEach((section) => section.classList.add('slide-active'));
  }

  homeView.addEventListener('click', (e) => {
    const link = e.target.closest('a[href^="#home-slide-"]');
    if (!link) return;
    e.preventDefault();
    document.getElementById(link.getAttribute('href').slice(1))
      ?.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
  });
}
